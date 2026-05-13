import json
from typing import Any
from urllib.parse import unquote

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from .auth import TOKEN_TTL_SECONDS, authenticate_header, public_user, require_roles, sign_jwt, verify_password
from .cache import CACHE_UNAVAILABLE, create_redis_cache
from .config import (
    DEFAULT_DATA_FILE,
    DEFAULT_PORT,
    HTTPS_ENABLED,
    MONGO_DB_NAME,
    MONGO_URL,
    REDIS_URL,
    TLS_CERT_FILE,
    TLS_KEY_FILE,
)
from .dashboard import create_dashboard
from .domain import (
    add_audit,
    dispatchable_items,
    equipment_name,
    job_by_id,
    machine_by_id,
    now_text,
    recipe_by_id,
    recipe_name,
    request_by_id,
    set_item_status,
)
from .errors import ApiError
from .store import create_store


def _json_error(message: str, status_code: int) -> JSONResponse:
    return JSONResponse({"error": message}, status_code=status_code)


async def _read_json_body(request: Request) -> dict[str, Any]:
    raw = await request.body()
    if not raw:
        return {}
    if len(raw) > 1_000_000:
        raise ApiError("Payload too large", 413)
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ApiError("Invalid JSON body", 400) from exc
    if not isinstance(payload, dict):
        raise ApiError("JSON body must be an object", 400)
    return payload


def _require_fields(body: dict[str, Any], fields: list[str]) -> None:
    missing = [field for field in fields if str(body.get(field, "")).strip() == ""]
    if missing:
        raise ApiError(f"Missing required fields: {', '.join(missing)}", 400)


def _body_text(body: dict[str, Any], key: str, default: str = "") -> str:
    return str(body.get(key, default)).strip()


def _body_number(body: dict[str, Any], key: str, default: int = 0) -> int | float:
    value = body.get(key, default)
    try:
        number = float(value)
    except (TypeError, ValueError):
        return default
    return int(number) if number.is_integer() else number


def _cache_hit(value: Any) -> bool:
    return value is not None and value is not CACHE_UNAVAILABLE


def create_app(store: Any | None = None) -> FastAPI:
    app = FastAPI(title="Cloud LIMS Backend", version="1.0.0")
    app.state.store = store or create_store(
        DEFAULT_DATA_FILE,
        cache=create_redis_cache(REDIS_URL),
        mongo_url=MONGO_URL,
        db_name=MONGO_DB_NAME,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "Authorization"],
    )

    @app.exception_handler(ApiError)
    async def api_error_handler(_: Request, exc: ApiError) -> JSONResponse:
        return _json_error(exc.message, exc.status_code)

    @app.exception_handler(StarletteHTTPException)
    async def http_error_handler(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        return _json_error(str(exc.detail), exc.status_code)

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
        return _json_error(str(exc), 422)

    @app.exception_handler(Exception)
    async def generic_error_handler(_: Request, exc: Exception) -> JSONResponse:
        return _json_error(str(exc) or "Internal server error", 500)

    @app.middleware("http")
    async def authenticate_api_requests(request: Request, call_next: Any) -> JSONResponse:
        path = request.url.path
        public_route = (request.method == "GET" and path == "/api/health") or (
            request.method == "POST" and path == "/api/auth/login"
        )
        if path.startswith("/api/") and request.method != "OPTIONS" and not public_route:
            try:
                request.state.user = authenticate_header(request.headers.get("authorization"), request.app.state.store.cache)
            except ApiError as exc:
                return _json_error(exc.message, exc.status_code)
        return await call_next(request)

    @app.get("/api/health")
    def health(request: Request) -> dict[str, Any]:
        store = request.app.state.store
        return {
            "status": "ok",
            "store": store.driver,
            "cache": "redis" if getattr(store.cache, "enabled", False) else "none",
        }

    @app.post("/api/auth/login", response_model=None)
    async def login(request: Request):
        body = await _read_json_body(request)
        _require_fields(body, ["username", "password"])
        store = request.app.state.store
        state = store.read()
        user = next((item for item in state["users"] if item["username"] == body["username"]), None)
        if not user or not verify_password(str(body["password"]), user):
            raise ApiError("Invalid username or password", 401)

        safe_user = public_user(user)
        token_data = sign_jwt(
            {
                "sub": user["id"],
                "username": user["username"],
                "name": user["name"],
                "role": user["role"],
            }
        )
        if getattr(store.cache, "enabled", False):
            store.cache.set_json(f"session:{token_data['payload']['jti']}", safe_user, TOKEN_TTL_SECONDS)

        def mutate(current_state: dict[str, Any]) -> dict[str, Any]:
            add_audit(current_state, f"{user['name']} logged in", user["name"])
            return {}

        store.update(mutate)
        return {"token": token_data["token"], "user": safe_user, "expiresAt": token_data["payload"]["exp"]}

    @app.get("/api/auth/me")
    def me(request: Request) -> dict[str, Any]:
        return {"user": request.state.user}

    @app.post("/api/auth/logout")
    def logout(request: Request) -> dict[str, str]:
        store = request.app.state.store
        if getattr(store.cache, "enabled", False):
            store.cache.delete(f"session:{request.state.user.get('jti')}")
        return {"message": "Logged out"}

    @app.get("/api/state")
    def state(request: Request) -> dict[str, Any]:
        store = request.app.state.store
        if getattr(store.cache, "enabled", False):
            cached_state = store.cache.get_json("state")
            if _cache_hit(cached_state):
                return cached_state
        current_state = store.read()
        if getattr(store.cache, "enabled", False):
            store.cache.set_json("state", current_state, 20)
        return current_state

    @app.post("/api/reset")
    def reset(request: Request) -> dict[str, Any]:
        require_roles(request.state.user, "admin")
        return {"state": request.app.state.store.reset(), "message": "Demo data reset"}

    @app.get("/api/dashboard")
    def dashboard(request: Request) -> dict[str, Any]:
        store = request.app.state.store
        if getattr(store.cache, "enabled", False):
            cached_dashboard = store.cache.get_json("dashboard")
            if _cache_hit(cached_dashboard):
                return cached_dashboard
        payload = create_dashboard(store.read())
        if getattr(store.cache, "enabled", False):
            store.cache.set_json("dashboard", payload, 30)
        return payload

    @app.get("/api/requests")
    def list_requests(request: Request) -> list[dict[str, Any]]:
        return request.app.state.store.read()["requests"]

    @app.get("/api/equipment")
    def list_equipment(request: Request) -> list[dict[str, Any]]:
        return request.app.state.store.read()["equipment"]

    @app.get("/api/jobs")
    def list_jobs(request: Request) -> list[dict[str, Any]]:
        return request.app.state.store.read()["jobs"]

    @app.get("/api/results")
    def list_results(request: Request) -> list[dict[str, Any]]:
        return request.app.state.store.read()["results"]

    @app.get("/api/results/{result_id}")
    def get_result(result_id: str, request: Request) -> dict[str, Any]:
        result = next((item for item in request.app.state.store.read()["results"] if item["id"] == result_id), None)
        if not result:
            raise ApiError("Result not found", 404)
        return result

    @app.get("/api/alarms")
    def list_alarms(request: Request) -> list[dict[str, Any]]:
        return request.app.state.store.read()["alarms"]

    @app.get("/api/audit")
    def list_audit(request: Request, limit: int = 20) -> list[dict[str, Any]]:
        return request.app.state.store.read()["audit"][: max(0, min(limit, 200))]

    @app.post("/api/requests", response_model=None)
    async def create_request(request: Request):
        require_roles(request.state.user, "fab")
        body = await _read_json_body(request)
        _require_fields(
            body,
            ["requester", "department", "labType", "priority", "dueDate", "sampleCode", "material", "quantity", "goal"],
        )

        def mutate(state: dict[str, Any]) -> dict[str, Any]:
            request_id = f"REQ-2026-{state['requestSeq']:03d}"
            state["requestSeq"] += 1
            new_request = {
                "id": request_id,
                "requester": _body_text(body, "requester"),
                "department": _body_text(body, "department"),
                "labType": _body_text(body, "labType"),
                "priority": _body_text(body, "priority"),
                "dueDate": _body_text(body, "dueDate"),
                "goal": _body_text(body, "goal"),
                "status": "pending_approval",
                "samples": [
                    {
                        "id": _body_text(body, "sampleCode"),
                        "material": _body_text(body, "material"),
                        "quantity": _body_number(body, "quantity", 1),
                        "status": "created",
                    }
                ],
                "wips": [],
            }
            state["requests"].insert(0, new_request)
            add_audit(state, f"{request_id} submitted by {new_request['requester']}", new_request["requester"])
            return {"message": f"{request_id} submitted for approval"}

        return JSONResponse(request.app.state.store.update(mutate), status_code=201)

    @app.post("/api/requests/{request_id}/{action}")
    async def request_action(request_id: str, action: str, request: Request) -> dict[str, Any]:
        action_roles = {
            "approve": ("supervisor",),
            "reject": ("supervisor",),
            "receive": ("operator",),
            "split": ("operator",),
            "close": ("operator",),
        }
        if action not in action_roles:
            raise ApiError("API route not found", 404)
        require_roles(request.state.user, *action_roles[action])
        body = await _read_json_body(request)

        def mutate(state: dict[str, Any]) -> dict[str, Any]:
            current_request = request_by_id(state, unquote(request_id))
            if not current_request:
                raise ApiError("Request not found", 404)

            actor = body.get("actor") or "Lab Operator"
            if action == "approve":
                current_request["status"] = "approved"
                add_audit(state, f"{current_request['id']} approved", body.get("actor") or "Lab Supervisor")
                return {"message": f"{current_request['id']} approved"}

            if action == "reject":
                current_request["status"] = "rejected"
                current_request["rejectReason"] = body.get("reason") or "Rejected by supervisor"
                add_audit(state, f"{current_request['id']} rejected", body.get("actor") or "Lab Supervisor")
                return {"message": f"{current_request['id']} rejected"}

            if action == "receive":
                current_request["status"] = "received"
                current_request["receivedAt"] = now_text()
                for sample in current_request["samples"]:
                    sample["status"] = "received"
                add_audit(state, f"{current_request['id']} received by lab", actor)
                return {"message": f"{current_request['id']} received"}

            if action == "split":
                source = current_request["samples"][0] if current_request["samples"] else None
                if not source:
                    raise ApiError("No sample to split", 409)
                current_request["status"] = "split"
                source["status"] = "split"
                if not current_request["wips"]:
                    total = max(1, int(source.get("quantity") or 1))
                    first_qty = 1 if total == 1 else total // 2
                    second_qty = total - first_qty
                    current_request["wips"] = [
                        {
                            "id": f"{source['id']}-A",
                            "source": source["id"],
                            "quantity": first_qty,
                            "purpose": f"{current_request['labType']} primary",
                            "status": "queued",
                        }
                    ]
                    if second_qty > 0:
                        current_request["wips"].append(
                            {
                                "id": f"{source['id']}-B",
                                "source": source["id"],
                                "quantity": second_qty,
                                "purpose": f"{current_request['labType']} backup",
                                "status": "queued",
                            }
                        )
                add_audit(
                    state,
                    f"{current_request['id']} split into {', '.join(wip['id'] for wip in current_request['wips'])}",
                    actor,
                )
                return {"message": f"{current_request['id']} split into WIP"}

            current_request["status"] = "closed"
            current_request["closedAt"] = now_text()
            add_audit(state, f"{current_request['id']} closed", actor)
            return {"message": f"{current_request['id']} closed"}

        return request.app.state.store.update(mutate)

    @app.post("/api/dispatch-jobs", response_model=None)
    async def create_dispatch_job(request: Request):
        require_roles(request.state.user, "operator")
        body = await _read_json_body(request)
        _require_fields(body, ["requestId", "wipId", "equipmentId", "recipeId"])

        def mutate(state: dict[str, Any]) -> dict[str, Any]:
            current_request = request_by_id(state, body["requestId"])
            machine = machine_by_id(state, body["equipmentId"])
            recipe = recipe_by_id(state, body["recipeId"])
            if not current_request or not machine or not recipe:
                raise ApiError("Request, equipment, or recipe not found", 404)
            if not any(item["id"] == body["wipId"] for item in dispatchable_items(current_request)):
                raise ApiError("Selected WIP/sample does not belong to request", 409)
            if machine["status"] in ["maintenance", "alarm"]:
                raise ApiError("Equipment is not dispatchable", 409)

            job_id = f"JOB-2026-{state['jobSeq']:03d}"
            state["jobSeq"] += 1
            actor = body.get("operator") or "Lab Operator"
            job = {
                "id": job_id,
                "requestId": current_request["id"],
                "wipId": body["wipId"],
                "equipmentId": machine["id"],
                "recipeId": recipe["id"],
                "operator": actor,
                "status": "queued",
                "note": _body_text(body, "note"),
                "history": [{"action": "dispatch", "actor": actor, "occurredAt": now_text(), "note": "Dispatched"}],
            }
            state["jobs"].insert(0, job)
            current_request["status"] = "in_progress"
            set_item_status(current_request, body["wipId"], "queued")
            add_audit(state, f"{current_request['id']} dispatched as {job_id} on {machine['name']}", actor)
            return {"message": f"{job_id} dispatched"}

        return JSONResponse(request.app.state.store.update(mutate), status_code=201)

    @app.get("/api/dispatch-jobs/{job_id}/history")
    def dispatch_job_history(job_id: str, request: Request) -> dict[str, Any]:
        job = job_by_id(request.app.state.store.read(), unquote(job_id))
        if not job:
            raise ApiError("Job not found", 404)
        return {"history": job.get("history", [])}

    @app.post("/api/dispatch-jobs/{job_id}/{action}")
    async def dispatch_job_action(job_id: str, action: str, request: Request) -> dict[str, Any]:
        if action not in ["load", "unload"]:
            raise ApiError("API route not found", 404)
        require_roles(request.state.user, "operator")
        body = await _read_json_body(request)

        def mutate(state: dict[str, Any]) -> dict[str, Any]:
            job = job_by_id(state, unquote(job_id))
            if not job:
                raise ApiError("Job not found", 404)
            current_request = request_by_id(state, job["requestId"])
            machine = machine_by_id(state, job["equipmentId"])
            actor = body.get("actor") or job.get("operator") or "Lab Operator"

            if action == "load":
                job["status"] = "running"
                job.setdefault("history", []).append({"action": "load", "actor": actor, "occurredAt": now_text(), "note": "Loaded"})
                if machine:
                    machine["status"] = "busy"
                    machine["utilization"] = min(96, int(machine.get("utilization", 0)) + 8)
                if current_request:
                    current_request["status"] = "in_progress"
                    set_item_status(current_request, job["wipId"], "loaded")
                add_audit(state, f"{job['id']} loaded", actor)
                return {"message": f"{job['id']} loaded"}

            job["status"] = "completed"
            job.setdefault("history", []).append({"action": "unload", "actor": actor, "occurredAt": now_text(), "note": "Unloaded"})
            if machine:
                machine["status"] = "idle"
                machine["utilization"] = min(99, int(machine.get("utilization", 0)) + 5)
            if current_request:
                current_request["status"] = "closed"
                current_request["closedAt"] = now_text()
                set_item_status(current_request, job["wipId"], "processed")

            result_id = f"RST-{job['id'].replace('JOB-', '')}"
            if not any(result["id"] == result_id for result in state["results"]):
                state["results"].insert(
                    0,
                    {
                        "id": result_id,
                        "requestId": job["requestId"],
                        "jobId": job["id"],
                        "summary": f"{equipment_name(state, job['equipmentId'])} finished {recipe_name(state, job['recipeId'])}",
                        "rawData": f"s3://lims-demo/raw/{job['id']}.csv",
                        "report": f"s3://lims-demo/report/{job['requestId']}.pdf",
                        "createdAt": now_text(),
                    },
                )
            add_audit(state, f"{job['id']} unloaded and result captured", actor)
            return {"message": f"{job['id']} completed"}

        return request.app.state.store.update(mutate)

    @app.post("/api/equipment/{equipment_id}/status")
    async def change_equipment_status(equipment_id: str, request: Request) -> dict[str, Any]:
        require_roles(request.state.user, "operator")
        body = await _read_json_body(request)
        _require_fields(body, ["status"])

        def mutate(state: dict[str, Any]) -> dict[str, Any]:
            machine = machine_by_id(state, unquote(equipment_id))
            if not machine:
                raise ApiError("Equipment not found", 404)
            machine["status"] = body["status"]
            if body["status"] == "alarm":
                alarm_id = f"ALM-{state['alarmSeq']:03d}"
                state["alarmSeq"] += 1
                state["alarms"].insert(
                    0,
                    {
                        "id": alarm_id,
                        "equipmentId": machine["id"],
                        "severity": body.get("severity") or "Medium",
                        "message": body.get("message") or f"{machine['name']} reported an alarm",
                        "status": "alarm",
                        "createdAt": now_text(),
                    },
                )
            add_audit(state, f"{machine['name']} status changed to {body['status']}", body.get("actor") or "Lab Operator")
            return {"message": f"{machine['name']} status updated"}

        return request.app.state.store.update(mutate)

    @app.post("/api/recipes", response_model=None)
    async def create_recipe(request: Request):
        require_roles(request.state.user, "admin")
        body = await _read_json_body(request)
        _require_fields(body, ["equipmentId", "name", "version", "parameters"])

        def mutate(state: dict[str, Any]) -> dict[str, Any]:
            if not machine_by_id(state, body["equipmentId"]):
                raise ApiError("Equipment not found", 404)
            recipe_id = f"RCP-{state['recipeSeq']:03d}"
            state["recipeSeq"] += 1
            state["recipes"].insert(
                0,
                {
                    "id": recipe_id,
                    "equipmentId": body["equipmentId"],
                    "name": _body_text(body, "name"),
                    "version": _body_text(body, "version"),
                    "parameters": _body_text(body, "parameters"),
                    "active": True,
                },
            )
            add_audit(state, f"{recipe_id} recipe created", body.get("actor") or "System Admin")
            return {"message": f"{recipe_id} created"}

        return JSONResponse(request.app.state.store.update(mutate), status_code=201)

    @app.post("/api/alarms/{alarm_id}/ack")
    async def acknowledge_alarm(alarm_id: str, request: Request) -> dict[str, Any]:
        require_roles(request.state.user, "operator")
        body = await _read_json_body(request)

        def mutate(state: dict[str, Any]) -> dict[str, Any]:
            alarm = next((item for item in state["alarms"] if item["id"] == unquote(alarm_id)), None)
            if not alarm:
                raise ApiError("Alarm not found", 404)
            alarm["status"] = "closed"
            alarm["acknowledgedAt"] = now_text()
            alarm["acknowledgedBy"] = body.get("actor") or "Lab Operator"
            machine = machine_by_id(state, alarm["equipmentId"])
            if machine and machine["status"] == "alarm":
                machine["status"] = "maintenance"
            add_audit(state, f"{alarm['id']} acknowledged", alarm["acknowledgedBy"])
            return {"message": f"{alarm['id']} acknowledged"}

        return request.app.state.store.update(mutate)

    @app.post("/api/alarms/simulate", response_model=None)
    async def simulate_alarm(request: Request):
        require_roles(request.state.user, "operator")
        body = await _read_json_body(request)

        def mutate(state: dict[str, Any]) -> dict[str, Any]:
            machine = next((item for item in state["equipment"] if item["status"] != "alarm"), state["equipment"][0])
            machine["status"] = "alarm"
            alarm_id = f"ALM-{state['alarmSeq']:03d}"
            state["alarmSeq"] += 1
            state["alarms"].insert(
                0,
                {
                    "id": alarm_id,
                    "equipmentId": machine["id"],
                    "severity": "Medium",
                    "message": f"{machine['name']} reported an alarm",
                    "status": "alarm",
                    "createdAt": now_text(),
                },
            )
            add_audit(state, f"{machine['name']} simulated alarm {alarm_id}", body.get("actor") or "System")
            return {"message": f"{alarm_id} simulated"}

        return JSONResponse(request.app.state.store.update(mutate), status_code=201)

    return app


app = create_app()


def run() -> None:
    import uvicorn

    ssl_options = {}
    if HTTPS_ENABLED:
        if not TLS_KEY_FILE or not TLS_CERT_FILE:
            raise RuntimeError("HTTPS requires TLS_KEY_FILE and TLS_CERT_FILE")
        ssl_options = {"ssl_keyfile": TLS_KEY_FILE, "ssl_certfile": TLS_CERT_FILE}
    uvicorn.run("app.main:app", host="0.0.0.0", port=DEFAULT_PORT, **ssl_options)


if __name__ == "__main__":
    run()
