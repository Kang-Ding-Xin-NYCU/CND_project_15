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


async def _prepare_received_request(client, *, sample_code="SMP-T-100", quantity=6):
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
            "sampleCode": sample_code,
            "material": "Wafer Lot T",
            "quantity": str(quantity),
            "goal": "Validate split rules",
        },
    )
    request_id = payload["state"]["requests"][0]["id"]
    await json_request(client, "POST", f"/api/requests/{request_id}/approve", token=supervisor_token, json={})
    await json_request(client, "POST", f"/api/requests/{request_id}/receive", token=operator_token, json={})
    return request_id, operator_token


@pytest.mark.anyio
async def test_manual_split_creates_n_wips_with_quantities(tmp_path):
    transport = httpx.ASGITransport(app=make_app(tmp_path))
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        request_id, operator_token = await _prepare_received_request(client, sample_code="SMP-T-200", quantity=6)

        payload = await json_request(
            client,
            "POST",
            f"/api/requests/{request_id}/split",
            token=operator_token,
            json={
                "wips": [
                    {"quantity": 2, "purpose": "SEM primary"},
                    {"quantity": 2, "purpose": "SEM backup"},
                    {"quantity": 2, "purpose": "SEM retain"},
                ]
            },
        )

        current_request = next(item for item in payload["state"]["requests"] if item["id"] == request_id)
        assert current_request["status"] == "split"
        assert current_request["samples"][0]["status"] == "split"
        assert [wip["id"] for wip in current_request["wips"]] == ["SMP-T-200-A", "SMP-T-200-B", "SMP-T-200-C"]
        assert [wip["quantity"] for wip in current_request["wips"]] == [2, 2, 2]
        assert all(wip["status"] == "queued" for wip in current_request["wips"])
        assert current_request["wips"][0]["purpose"] == "SEM primary"


@pytest.mark.anyio
async def test_split_rejects_total_quantity_over_sample(tmp_path):
    transport = httpx.ASGITransport(app=make_app(tmp_path))
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        request_id, operator_token = await _prepare_received_request(client, sample_code="SMP-T-300", quantity=4)

        response = await client.post(
            f"/api/requests/{request_id}/split",
            headers={"Authorization": f"Bearer {operator_token}"},
            json={"wips": [{"quantity": 3, "purpose": "x"}, {"quantity": 3, "purpose": "y"}]},
        )

        assert response.status_code == 400
        assert "exceeds sample quantity" in response.json()["error"]


@pytest.mark.anyio
async def test_split_rejects_empty_wips(tmp_path):
    transport = httpx.ASGITransport(app=make_app(tmp_path))
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        request_id, operator_token = await _prepare_received_request(client, sample_code="SMP-T-400", quantity=4)

        response = await client.post(
            f"/api/requests/{request_id}/split",
            headers={"Authorization": f"Bearer {operator_token}"},
            json={"wips": []},
        )

        assert response.status_code == 400
        assert "At least one WIP is required" in response.json()["error"]


@pytest.mark.anyio
async def test_split_rejects_non_positive_quantity(tmp_path):
    transport = httpx.ASGITransport(app=make_app(tmp_path))
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        request_id, operator_token = await _prepare_received_request(client, sample_code="SMP-T-500", quantity=4)

        response = await client.post(
            f"/api/requests/{request_id}/split",
            headers={"Authorization": f"Bearer {operator_token}"},
            json={"wips": [{"quantity": 0, "purpose": "zero"}]},
        )

        assert response.status_code == 400
        assert "must be greater than 0" in response.json()["error"]


@pytest.mark.anyio
async def test_dispatch_rejects_re_dispatching_same_wip(tmp_path):
    transport = httpx.ASGITransport(app=make_app(tmp_path))
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        operator_token = await login(client, "operator")

        first = await json_request(
            client,
            "POST",
            "/api/dispatch-jobs",
            token=operator_token,
            json={
                "requestId": "REQ-2026-002",
                "wipId": "WIP-002-A",
                "equipmentId": "EQ-XRD-02",
                "recipeId": "RCP-002",
            },
        )
        assert first["state"]["jobs"][0]["status"] == "queued"
        dispatched_wip = next(
            wip
            for req in first["state"]["requests"]
            if req["id"] == "REQ-2026-002"
            for wip in req["wips"]
            if wip["id"] == "WIP-002-A"
        )
        assert dispatched_wip["status"] == "dispatched"

        second = await client.post(
            "/api/dispatch-jobs",
            headers={"Authorization": f"Bearer {operator_token}"},
            json={
                "requestId": "REQ-2026-002",
                "wipId": "WIP-002-A",
                "equipmentId": "EQ-XRD-02",
                "recipeId": "RCP-002",
            },
        )

        assert second.status_code == 409
        assert "Cannot dispatch request in status in_progress" in second.json()["error"]


@pytest.mark.anyio
async def test_audit_log_includes_action_and_target_metadata(tmp_path):
    transport = httpx.ASGITransport(app=make_app(tmp_path))
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        await _prepare_received_request(client, sample_code="SMP-T-600", quantity=4)
        operator_token = await login(client, "operator")

        rows = await json_request(client, "GET", "/api/audit", token=operator_token)

        recent_actions = [row.get("action") for row in rows if row.get("action")]
        assert "request.receive" in recent_actions
        assert "request.approve" in recent_actions
        assert "request.create" in recent_actions

        tagged = next(row for row in rows if row.get("action") == "request.receive")
        assert tagged["targetType"] == "request"
        assert tagged["targetId"].startswith("REQ-")
        assert tagged["message"]
        assert tagged["actor"]


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


@pytest.mark.anyio
async def test_admin_can_deactivate_recipe_and_dispatch_rejects_inactive_recipe(tmp_path):
    transport = httpx.ASGITransport(app=make_app(tmp_path))
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        admin_token = await login(client, "admin")
        operator_token = await login(client, "operator")

        deactivated = await json_request(
            client,
            "POST",
            "/api/recipes/RCP-001/deactivate",
            token=admin_token,
            json={"actor": "System Admin"},
        )
        recipe = next(item for item in deactivated["state"]["recipes"] if item["id"] == "RCP-001")
        assert recipe["active"] is False
        assert deactivated["message"] == "RCP-001 deactivated"

        rejected = await client.post(
            "/api/dispatch-jobs",
            headers={"Authorization": f"Bearer {operator_token}"},
            json={
                "requestId": "REQ-2026-002",
                "wipId": "WIP-002-A",
                "equipmentId": "EQ-SEM-01",
                "recipeId": "RCP-001",
            },
        )
        assert rejected.status_code == 409
        assert rejected.json()["error"] == "Recipe is inactive"

        dashboard = await json_request(client, "GET", "/api/dashboard", token=operator_token)
        assert dashboard["recipeActiveCount"] == {"active": 2, "inactive": 1}


@pytest.mark.anyio
async def test_machine_completed_event_finishes_job_and_creates_result_metadata(tmp_path):
    transport = httpx.ASGITransport(app=make_app(tmp_path))
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        operator_token = await login(client, "operator")

        payload = await json_request(
            client,
            "POST",
            "/api/machine-events",
            token=operator_token,
            json={
                "equipmentId": "EQ-FTIR-03",
                "eventType": "completed",
                "jobId": "JOB-2026-001",
                "actor": "FTIR-03",
                "payload": {
                    "rawUri": "s3://machine/ftir/JOB-2026-001.csv",
                    "reportUri": "s3://machine/ftir/JOB-2026-001.pdf",
                    "measurements": {"contamination": "pass"},
                },
            },
        )

        job = next(item for item in payload["state"]["jobs"] if item["id"] == "JOB-2026-001")
        request_item = next(item for item in payload["state"]["requests"] if item["id"] == "REQ-2026-003")
        machine = next(item for item in payload["state"]["equipment"] if item["id"] == "EQ-FTIR-03")
        result = payload["state"]["results"][0]

        assert payload["message"] == "event processed"
        assert job["status"] == "completed"
        assert request_item["status"] == "closed"
        assert machine["status"] == "idle"
        assert result["jobId"] == "JOB-2026-001"
        assert result["rawData"] == "s3://machine/ftir/JOB-2026-001.csv"
        assert result["report"] == "s3://machine/ftir/JOB-2026-001.pdf"
        assert result["metadata"]["source"] == "machine_event.completed"
        assert result["metadata"]["recipeVersion"] == "1.4.3"
        assert result["metadata"]["payload"]["measurements"]["contamination"] == "pass"
        assert result["rawDataMetadata"]["format"] == "csv"
        assert result["reportMetadata"]["format"] == "pdf"

        dashboard = await json_request(client, "GET", "/api/dashboard", token=operator_token)
        assert dashboard["resultCount"] == 1
        assert dashboard["latestResults"][0]["id"] == result["id"]
        assert dashboard["resultByEquipment"] == {"EQ-FTIR-03": 1}
        assert dashboard["equipmentStatusCount"]["idle"] == 3
        assert dashboard["alarmBySeverity"]["High"] == 1

        result_by_request = await json_request(client, "GET", "/api/results?requestId=REQ-2026-003", token=operator_token)
        result_by_job = await json_request(client, "GET", "/api/results?jobId=JOB-2026-001", token=operator_token)
        result_by_equipment = await json_request(client, "GET", "/api/results?equipmentId=EQ-FTIR-03", token=operator_token)
        result_by_recipe = await json_request(client, "GET", "/api/results?recipeId=RCP-003", token=operator_token)
        result_mismatch = await json_request(client, "GET", "/api/results?equipmentId=EQ-SEM-01", token=operator_token)
        single_result = await json_request(client, "GET", f"/api/results/{result['id']}", token=operator_token)

        assert [item["id"] for item in result_by_request] == [result["id"]]
        assert [item["id"] for item in result_by_job] == [result["id"]]
        assert [item["id"] for item in result_by_equipment] == [result["id"]]
        assert [item["id"] for item in result_by_recipe] == [result["id"]]
        assert result_mismatch == []
        assert single_result["metadata"]["equipmentId"] == "EQ-FTIR-03"


@pytest.mark.anyio
async def test_machine_alarm_event_creates_alarm_and_marks_equipment_alarm(tmp_path):
    transport = httpx.ASGITransport(app=make_app(tmp_path))
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        operator_token = await login(client, "operator")

        payload = await json_request(
            client,
            "POST",
            "/api/machine-events",
            token=operator_token,
            json={
                "equipmentId": "EQ-SEM-01",
                "eventType": "alarm",
                "actor": "SEM-01",
                "payload": {"severity": "Critical", "message": "Vacuum pressure over threshold"},
            },
        )

        machine = next(item for item in payload["state"]["equipment"] if item["id"] == "EQ-SEM-01")
        alarm = payload["state"]["alarms"][0]
        assert payload["message"] == "event processed"
        assert machine["status"] == "alarm"
        assert alarm["equipmentId"] == "EQ-SEM-01"
        assert alarm["severity"] == "Critical"
        assert alarm["message"] == "Vacuum pressure over threshold"
        assert alarm["source"] == "machine_event"


@pytest.mark.anyio
async def test_machine_measurement_event_appends_history_and_threshold_alarm(tmp_path):
    transport = httpx.ASGITransport(app=make_app(tmp_path))
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        operator_token = await login(client, "operator")

        payload = await json_request(
            client,
            "POST",
            "/api/machine-events",
            token=operator_token,
            json={
                "equipmentId": "EQ-FTIR-03",
                "eventType": "measurement",
                "jobId": "JOB-2026-001",
                "actor": "FTIR-03",
                "payload": {
                    "metric": "chamberTemp",
                    "value": 96,
                    "threshold": 90,
                    "unit": "C",
                    "severity": "High",
                },
            },
        )

        job = next(item for item in payload["state"]["jobs"] if item["id"] == "JOB-2026-001")
        machine = next(item for item in payload["state"]["equipment"] if item["id"] == "EQ-FTIR-03")
        alarm = payload["state"]["alarms"][0]
        assert payload["message"] == "event processed"
        assert job["status"] == "running"
        assert job["history"][-1]["action"] == "machine.measurement"
        assert job["history"][-1]["payload"]["metric"] == "chamberTemp"
        assert machine["status"] == "alarm"
        assert alarm["equipmentId"] == "EQ-FTIR-03"
        assert alarm["severity"] == "High"
        assert alarm["source"] == "threshold"


@pytest.mark.anyio
async def test_recipe_deactivate_returns_404_for_unknown_recipe(tmp_path):
    transport = httpx.ASGITransport(app=make_app(tmp_path))
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        admin_token = await login(client, "admin")

        response = await client.post(
            "/api/recipes/RCP-999/deactivate",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"actor": "System Admin"},
        )

        assert response.status_code == 404
        assert response.json()["error"] == "Recipe not found"


@pytest.mark.anyio
async def test_machine_event_rejects_invalid_contracts(tmp_path):
    transport = httpx.ASGITransport(app=make_app(tmp_path))
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        operator_token = await login(client, "operator")
        headers = {"Authorization": f"Bearer {operator_token}"}

        invalid_type = await client.post(
            "/api/machine-events",
            headers=headers,
            json={"equipmentId": "EQ-FTIR-03", "eventType": "started", "payload": {}},
        )
        assert invalid_type.status_code == 400
        assert invalid_type.json()["error"] == "eventType must be one of: completed, alarm, measurement"

        invalid_payload = await client.post(
            "/api/machine-events",
            headers=headers,
            json={"equipmentId": "EQ-FTIR-03", "eventType": "alarm", "payload": ["not", "an", "object"]},
        )
        assert invalid_payload.status_code == 400
        assert invalid_payload.json()["error"] == "payload must be an object"

        missing_job = await client.post(
            "/api/machine-events",
            headers=headers,
            json={"equipmentId": "EQ-FTIR-03", "eventType": "completed", "payload": {}},
        )
        assert missing_job.status_code == 400
        assert missing_job.json()["error"] == "jobId is required for completed events"

        wrong_equipment = await client.post(
            "/api/machine-events",
            headers=headers,
            json={
                "equipmentId": "EQ-SEM-01",
                "eventType": "measurement",
                "jobId": "JOB-2026-001",
                "payload": {},
            },
        )
        assert wrong_equipment.status_code == 409
        assert wrong_equipment.json()["error"] == "Job does not belong to selected equipment"


@pytest.mark.anyio
async def test_machine_completed_event_is_not_repeatable(tmp_path):
    transport = httpx.ASGITransport(app=make_app(tmp_path))
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        operator_token = await login(client, "operator")
        body = {
            "equipmentId": "EQ-FTIR-03",
            "eventType": "completed",
            "jobId": "JOB-2026-001",
            "payload": {},
        }

        first = await client.post("/api/machine-events", headers={"Authorization": f"Bearer {operator_token}"}, json=body)
        second = await client.post("/api/machine-events", headers={"Authorization": f"Bearer {operator_token}"}, json=body)

        assert first.status_code == 201
        assert second.status_code == 409
        assert "Cannot complete from machine event job in status completed" in second.json()["error"]
