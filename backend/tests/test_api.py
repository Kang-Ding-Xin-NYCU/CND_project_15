import sys
from pathlib import Path

import httpx
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.auth import sign_jwt
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
async def test_login_rejects_invalid_password(tmp_path):
    transport = httpx.ASGITransport(app=make_app(tmp_path))
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.post(
            "/api/auth/login",
            json={"username": "operator", "password": "wrong-password"},
        )

        assert response.status_code == 401
        assert response.json()["error"] == "Invalid username or password"


@pytest.mark.anyio
async def test_expired_jwt_is_rejected(tmp_path):
    transport = httpx.ASGITransport(app=make_app(tmp_path))
    token = sign_jwt({"sub": "USR-003", "username": "operator", "name": "Lab Operator", "role": "operator"}, ttl_seconds=-1)[
        "token"
    ]
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.get("/api/state", headers={"Authorization": f"Bearer {token}"})

        assert response.status_code == 401
        assert response.json()["error"] == "Token expired"


@pytest.mark.anyio
async def test_request_can_move_through_full_lab_flow_with_rbac(tmp_path):
    transport = httpx.ASGITransport(app=make_app(tmp_path))
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        fab_token = await login(client, "fab")
        supervisor_token = await login(client, "supervisor")
        operator_token = await login(client, "operator")

        payload = await json_request(
            client,
            "POST",
            "/api/requests",
            token=fab_token,
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

        payload = await json_request(client, "POST", f"/api/requests/{request_id}/approve", token=supervisor_token, json={})
        assert payload["state"]["requests"][0]["status"] == "approved"

        payload = await json_request(client, "POST", f"/api/requests/{request_id}/receive", token=operator_token, json={})
        assert payload["state"]["requests"][0]["status"] == "received"

        payload = await json_request(
            client,
            "POST",
            f"/api/requests/{request_id}/split",
            token=operator_token,
            json={
                "wips": [
                    {"quantity": 2, "purpose": "SEM primary"},
                    {"quantity": 2, "purpose": "SEM backup"},
                ]
            },
        )
        current_request = next(item for item in payload["state"]["requests"] if item["id"] == request_id)
        assert current_request["status"] == "split"
        assert len(current_request["wips"]) == 2

        payload = await json_request(
            client,
            "POST",
            "/api/dispatch-jobs",
            token=operator_token,
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

        payload = await json_request(client, "POST", f"/api/dispatch-jobs/{job_id}/load", token=operator_token, json={})
        assert payload["state"]["jobs"][0]["status"] == "running"

        payload = await json_request(client, "POST", f"/api/dispatch-jobs/{job_id}/unload", token=operator_token, json={})
        closed_request = next(item for item in payload["state"]["requests"] if item["id"] == request_id)
        assert payload["state"]["jobs"][0]["status"] == "completed"
        assert closed_request["status"] == "closed"
        assert payload["state"]["results"][0]["jobId"] == job_id


@pytest.mark.anyio
async def test_rbac_rejects_fab_approval(tmp_path):
    transport = httpx.ASGITransport(app=make_app(tmp_path))
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        fab_token = await login(client, "fab")

        response = await client.post(
            "/api/requests/REQ-2026-001/approve",
            headers={"Authorization": f"Bearer {fab_token}"},
            json={},
        )

        assert response.status_code == 403
        assert response.json()["error"] == "Forbidden: insufficient role"


@pytest.mark.anyio
async def test_rbac_rejects_supervisor_dispatch(tmp_path):
    transport = httpx.ASGITransport(app=make_app(tmp_path))
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        supervisor_token = await login(client, "supervisor")

        response = await client.post(
            "/api/dispatch-jobs",
            headers={"Authorization": f"Bearer {supervisor_token}"},
            json={
                "requestId": "REQ-2026-002",
                "wipId": "WIP-002-A",
                "equipmentId": "EQ-XRD-02",
                "recipeId": "RCP-002",
            },
        )

        assert response.status_code == 403
        assert response.json()["error"] == "Forbidden: insufficient role"


@pytest.mark.anyio
async def test_request_actions_enforce_state_transitions(tmp_path):
    transport = httpx.ASGITransport(app=make_app(tmp_path))
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        operator_token = await login(client, "operator")
        supervisor_token = await login(client, "supervisor")

        receive_too_early = await client.post(
            "/api/requests/REQ-2026-001/receive",
            headers={"Authorization": f"Bearer {operator_token}"},
            json={},
        )
        assert receive_too_early.status_code == 409
        assert "Cannot receive request in status pending_approval" in receive_too_early.json()["error"]

        approved = await json_request(
            client,
            "POST",
            "/api/requests/REQ-2026-001/approve",
            token=supervisor_token,
            json={},
        )
        assert next(item for item in approved["state"]["requests"] if item["id"] == "REQ-2026-001")["status"] == "approved"

        approve_again = await client.post(
            "/api/requests/REQ-2026-001/approve",
            headers={"Authorization": f"Bearer {supervisor_token}"},
            json={},
        )
        assert approve_again.status_code == 409
        assert "Cannot approve request in status approved" in approve_again.json()["error"]

        split_before_receive = await client.post(
            "/api/requests/REQ-2026-001/split",
            headers={"Authorization": f"Bearer {operator_token}"},
            json={},
        )
        assert split_before_receive.status_code == 409
        assert "Cannot split request in status approved" in split_before_receive.json()["error"]


@pytest.mark.anyio
async def test_dispatch_rejects_invalid_request_and_recipe_pairing(tmp_path):
    transport = httpx.ASGITransport(app=make_app(tmp_path))
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        operator_token = await login(client, "operator")

        pending_request = await client.post(
            "/api/dispatch-jobs",
            headers={"Authorization": f"Bearer {operator_token}"},
            json={
                "requestId": "REQ-2026-001",
                "wipId": "SMP-001",
                "equipmentId": "EQ-SEM-01",
                "recipeId": "RCP-001",
            },
        )
        assert pending_request.status_code == 409
        assert "Cannot dispatch request in status pending_approval" in pending_request.json()["error"]

        wrong_recipe = await client.post(
            "/api/dispatch-jobs",
            headers={"Authorization": f"Bearer {operator_token}"},
            json={
                "requestId": "REQ-2026-002",
                "wipId": "WIP-002-A",
                "equipmentId": "EQ-SEM-01",
                "recipeId": "RCP-002",
            },
        )
        assert wrong_recipe.status_code == 409
        assert wrong_recipe.json()["error"] == "Recipe does not belong to selected equipment"

        alarm_machine = await client.post(
            "/api/dispatch-jobs",
            headers={"Authorization": f"Bearer {operator_token}"},
            json={
                "requestId": "REQ-2026-002",
                "wipId": "WIP-002-A",
                "equipmentId": "EQ-PROBE-04",
                "recipeId": "RCP-001",
            },
        )
        assert alarm_machine.status_code == 409
        assert alarm_machine.json()["error"] == "Equipment is not dispatchable"


@pytest.mark.anyio
async def test_job_actions_enforce_state_transitions(tmp_path):
    transport = httpx.ASGITransport(app=make_app(tmp_path))
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        operator_token = await login(client, "operator")

        unload_missing_load = await client.post(
            "/api/dispatch-jobs/JOB-2026-001/unload",
            headers={"Authorization": f"Bearer {operator_token}"},
            json={},
        )
        assert unload_missing_load.status_code == 200

        load_completed = await client.post(
            "/api/dispatch-jobs/JOB-2026-001/load",
            headers={"Authorization": f"Bearer {operator_token}"},
            json={},
        )
        assert load_completed.status_code == 409
        assert "Cannot load job in status completed" in load_completed.json()["error"]


@pytest.mark.anyio
async def test_admin_can_manage_recipes_but_operator_cannot(tmp_path):
    transport = httpx.ASGITransport(app=make_app(tmp_path))
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        operator_token = await login(client, "operator")
        admin_token = await login(client, "admin")
        body = {
            "equipmentId": "EQ-SEM-01",
            "name": "RBAC Recipe",
            "version": "1.0.0",
            "parameters": "voltage=2kV",
        }

        denied = await client.post("/api/recipes", headers={"Authorization": f"Bearer {operator_token}"}, json=body)
        assert denied.status_code == 403

        created = await client.post("/api/recipes", headers={"Authorization": f"Bearer {admin_token}"}, json=body)
        assert created.status_code == 201
        assert created.json()["state"]["recipes"][0]["name"] == "RBAC Recipe"


@pytest.mark.anyio
async def test_alarm_can_be_simulated_and_acknowledged_by_operator(tmp_path):
    transport = httpx.ASGITransport(app=make_app(tmp_path))
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        token = await login(client, "operator")

        simulated = await json_request(client, "POST", "/api/alarms/simulate", token=token, json={})
        alarm = simulated["state"]["alarms"][0]
        assert alarm["status"] == "alarm"

        acknowledged = await json_request(client, "POST", f"/api/alarms/{alarm['id']}/ack", token=token, json={})
        assert acknowledged["state"]["alarms"][0]["status"] == "closed"
