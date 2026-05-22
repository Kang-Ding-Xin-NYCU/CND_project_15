from typing import Any

from fastapi import APIRouter, Request

from ..http_utils import read_json_body, require_fields
from ..services import auth_service

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=None)
async def login(request: Request) -> dict[str, Any]:
    body = await read_json_body(request)
    require_fields(body, ["username", "password"])
    return auth_service.login(
        request.app.state.store,
        username=str(body["username"]),
        password=str(body["password"]),
    )


@router.get("/me")
async def me(request: Request) -> dict[str, Any]:
    return {"user": request.state.user}


@router.post("/logout")
async def logout(request: Request) -> dict[str, str]:
    return auth_service.logout(request.app.state.store, jti=request.state.user.get("jti"))


@router.patch("/password")
async def change_password(request: Request) -> dict[str, str]:
    body = await read_json_body(request)
    require_fields(body, ["currentPassword", "newPassword"])
    return auth_service.change_password(
        request.app.state.store,
        user_id=str(request.state.user["id"]),
        current_password=str(body["currentPassword"]),
        new_password=str(body["newPassword"]),
        actor=str(request.state.user.get("name") or request.state.user.get("username") or "System"),
    )
