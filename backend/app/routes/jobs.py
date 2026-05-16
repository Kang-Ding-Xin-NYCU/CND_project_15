from typing import Any
from urllib.parse import unquote

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from ..auth import require_roles
from ..errors import ApiError
from ..http_utils import body_text, read_json_body, require_fields
from ..services import dispatch_service

router = APIRouter(prefix="/api", tags=["jobs"])


@router.get("/jobs")
def list_jobs(request: Request) -> list[dict[str, Any]]:
    return request.app.state.store.read()["jobs"]


@router.post("/dispatch-jobs", response_model=None)
async def create_dispatch_job(request: Request) -> JSONResponse:
    require_roles(request.state.user, "operator")
    body = await read_json_body(request)
    require_fields(body, ["requestId", "wipId", "equipmentId", "recipeId"])
    result = dispatch_service.create_job(
        request.app.state.store,
        request_id=str(body["requestId"]),
        wip_id=str(body["wipId"]),
        equipment_id=str(body["equipmentId"]),
        recipe_id=str(body["recipeId"]),
        operator=body.get("operator") or "Lab Operator",
        note=body_text(body, "note"),
    )
    return JSONResponse(result, status_code=201)


@router.get("/dispatch-jobs/{job_id}/history")
def dispatch_job_history(job_id: str, request: Request) -> dict[str, Any]:
    return dispatch_service.job_history(request.app.state.store, job_id=unquote(job_id))


@router.post("/dispatch-jobs/{job_id}/{action}")
async def dispatch_job_action(job_id: str, action: str, request: Request) -> dict[str, Any]:
    if action not in ("load", "unload"):
        raise ApiError("API route not found", 404)
    require_roles(request.state.user, "operator")
    body = await read_json_body(request)
    actor = str(body.get("actor") or "")
    target_id = unquote(job_id)

    if action == "load":
        return dispatch_service.load_job(request.app.state.store, job_id=target_id, actor=actor)
    return dispatch_service.unload_job(request.app.state.store, job_id=target_id, actor=actor)
