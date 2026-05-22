from typing import Any
from urllib.parse import unquote

from fastapi import APIRouter, Request

from ..auth import require_roles
from ..http_utils import body_text, read_json_body, require_fields
from ..services import user_service

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("")
async def list_users(request: Request) -> dict[str, list[dict[str, Any]]]:
    require_roles(request.state.user, "admin")
    return {"users": user_service.list_users(request.app.state.store)}


@router.post("")
async def create_user(request: Request) -> dict[str, Any]:
    require_roles(request.state.user, "admin")
    body = await read_json_body(request)
    require_fields(body, ["username", "name", "role"])
    return user_service.create_user(
        request.app.state.store,
        username=body_text(body, "username"),
        name=body_text(body, "name"),
        role=body_text(body, "role"),
        department=body_text(body, "department"),
        site=body_text(body, "site"),
        actor=str(body.get("actor") or request.state.user.get("name") or "System Admin"),
    )


@router.patch("/{user_id}/role")
async def update_user_role(user_id: str, request: Request) -> dict[str, Any]:
    require_roles(request.state.user, "admin")
    body = await read_json_body(request)
    require_fields(body, ["role"])
    return user_service.update_user_role(
        request.app.state.store,
        user_id=unquote(user_id),
        role=body_text(body, "role"),
        actor=str(body.get("actor") or request.state.user.get("name") or "System Admin"),
    )
