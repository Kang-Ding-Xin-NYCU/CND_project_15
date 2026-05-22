from typing import Any
from urllib.parse import unquote

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from ..auth import require_roles
from ..errors import ApiError
from ..http_utils import body_number, body_text, read_json_body, require_fields
from ..services import request_service

router = APIRouter(prefix="/api/requests", tags=["requests"])

_ACTION_ROLES = {
    "approve": ("supervisor",),
    "reject": ("supervisor",),
    "receive": ("operator",),
    "split": ("operator",),
    "close": ("operator",),
}


@router.get("")
async def list_requests(request: Request) -> list[dict[str, Any]]:
    return request.app.state.store.read()["requests"]


@router.post("", response_model=None)
async def create_request(request: Request) -> JSONResponse:
    require_roles(request.state.user, "fab")
    body = await read_json_body(request)
    require_fields(
        body,
        ["requester", "department", "labType", "priority", "dueDate", "sampleCode", "material", "quantity", "goal"],
    )
    result = request_service.create_request(
        request.app.state.store,
        payload={
            "requester": body_text(body, "requester"),
            "department": body_text(body, "department"),
            "labType": body_text(body, "labType"),
            "priority": body_text(body, "priority"),
            "dueDate": body_text(body, "dueDate"),
            "goal": body_text(body, "goal"),
            "sampleCode": body_text(body, "sampleCode"),
            "material": body_text(body, "material"),
            "quantity": body_number(body, "quantity", 1),
        },
    )
    return JSONResponse(result, status_code=201)


@router.post("/{request_id}/{action}")
async def request_action(request_id: str, action: str, request: Request) -> dict[str, Any]:
    if action not in _ACTION_ROLES:
        raise ApiError("API route not found", 404)
    require_roles(request.state.user, *_ACTION_ROLES[action])
    body = await read_json_body(request)
    target_id = unquote(request_id)

    if action == "approve":
        return request_service.approve(
            request.app.state.store,
            request_id=target_id,
            actor=body.get("actor") or "Lab Supervisor",
        )
    if action == "reject":
        return request_service.reject(
            request.app.state.store,
            request_id=target_id,
            actor=body.get("actor") or "Lab Supervisor",
            reason=str(body.get("reason") or ""),
        )

    actor = body.get("actor") or "Lab Operator"
    if action == "receive":
        return request_service.receive(request.app.state.store, request_id=target_id, actor=actor)
    if action == "split":
        wips_body = body.get("wips", [])
        if not isinstance(wips_body, list):
            raise ApiError("wips must be an array", 400)
        return request_service.split(
            request.app.state.store,
            request_id=target_id,
            actor=actor,
            wips=wips_body,
        )
    return request_service.close(request.app.state.store, request_id=target_id, actor=actor)
