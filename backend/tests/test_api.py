import sys
from pathlib import Path

import httpx
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.cache import NoopCache
from app.main import create_app
from app.store import create_store


@pytest.fixture
def anyio_backend():
    return "asyncio"


def make_app(tmp_path):
    store = create_store(str(tmp_path / "state.json"), cache=NoopCache(), mongo_url="")
    return create_app(store=store)


async def json_request(client, method, path, token=None, **kwargs):
    headers = {"Content-Type": "application/json", **kwargs.pop("headers", {})}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    response = await client.request(method, path, headers=headers, **kwargs)
    payload = response.json()
    if response.status_code >= 400:
        raise AssertionError(payload.get("error") or f"HTTP {response.status_code}")
    return payload


async def login(client, username="operator"):
    payload = await json_request(
        client,
        "POST",
        "/api/auth/login",
        json={"username": username, "password": "password123"},
    )
    assert payload["token"]
    return payload["token"]


@pytest.mark.anyio
async def test_protected_api_rejects_missing_jwt(tmp_path):
    transport = httpx.ASGITransport(app=make_app(tmp_path))
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.get("/api/state")

        assert response.status_code == 401
        assert response.json()["error"] == "Missing bearer token"


@pytest.mark.anyio
async def test_request_can_move_through_full_lab_flow(tmp_path):
    transport = httpx.ASGITransport(app=make_app(tmp_path))
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        token = await login(client)

        payload = await json_request(
            client,
            "POST",
            "/api/requests",
            token=token,
            json={
                "requester": "Test User",
                "department": "Fab Test",
                "labType": "SEM",
                "priority": "High",
                "dueDate": "2026-05-20",
                "sampleCode": "SMP-T-001",
                "material": "Wafer Lot T01",
                "quantity": "4",
                "goal": "Validate API flow",
            },
        )
        request_id = payload["state"]["requests"][0]["id"]
        assert payload["state"]["requests"][0]["status"] == "pending_approval"

        payload = await json_request(client, "POST", f"/api/requests/{request_id}/approve", token=token, json={})
        assert payload["state"]["requests"][0]["status"] == "approved"

        payload = await json_request(client, "POST", f"/api/requests/{request_id}/receive", token=token, json={})
        assert payload["state"]["requests"][0]["status"] == "received"

        payload = await json_request(client, "POST", f"/api/requests/{request_id}/split", token=token, json={})
        current_request = next(item for item in payload["state"]["requests"] if item["id"] == request_id)
        assert current_request["status"] == "split"
        assert len(current_request["wips"]) == 2

        payload = await json_request(
            client,
            "POST",
            "/api/dispatch-jobs",
            token=token,
            json={
                "requestId": request_id,
                "wipId": current_request["wips"][0]["id"],
                "equipmentId": "EQ-SEM-01",
                "recipeId": "RCP-001",
                "operator": "Tester",
                "note": "API test dispatch",
            },
        )
        job_id = payload["state"]["jobs"][0]["id"]
        assert payload["state"]["jobs"][0]["status"] == "queued"

        payload = await json_request(client, "POST", f"/api/dispatch-jobs/{job_id}/load", token=token, json={})
        assert payload["state"]["jobs"][0]["status"] == "running"

        payload = await json_request(client, "POST", f"/api/dispatch-jobs/{job_id}/unload", token=token, json={})
        closed_request = next(item for item in payload["state"]["requests"] if item["id"] == request_id)
        assert payload["state"]["jobs"][0]["status"] == "completed"
        assert closed_request["status"] == "closed"
        assert payload["state"]["results"][0]["jobId"] == job_id


@pytest.mark.anyio
async def test_alarm_can_be_simulated_and_acknowledged(tmp_path):
    transport = httpx.ASGITransport(app=make_app(tmp_path))
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        token = await login(client)

        simulated = await json_request(client, "POST", "/api/alarms/simulate", token=token, json={})
        alarm = simulated["state"]["alarms"][0]
        assert alarm["status"] == "alarm"

        acknowledged = await json_request(client, "POST", f"/api/alarms/{alarm['id']}/ack", token=token, json={})
        assert acknowledged["state"]["alarms"][0]["status"] == "closed"
