from typing import Any
from urllib.parse import unquote

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from ..auth import require_roles
from ..http_utils import body_text, read_json_body, require_fields
from ..services import recipe_service

router = APIRouter(prefix="/api/recipes", tags=["recipes"])


@router.post("", response_model=None)
async def create_recipe(request: Request) -> JSONResponse:
    require_roles(request.state.user, "admin")
    body = await read_json_body(request)
    require_fields(body, ["equipmentId", "name", "version", "parameters"])
    result = recipe_service.create_recipe(
        request.app.state.store,
        equipment_id=str(body["equipmentId"]),
        name=body_text(body, "name"),
        version=body_text(body, "version"),
        parameters=body_text(body, "parameters"),
        actor=str(body.get("actor") or "System Admin"),
    )
    return JSONResponse(result, status_code=201)


@router.post("/{recipe_id}/deactivate")
async def deactivate_recipe(recipe_id: str, request: Request) -> dict[str, Any]:
    require_roles(request.state.user, "admin")
    body = await read_json_body(request)
    return recipe_service.deactivate_recipe(
        request.app.state.store,
        recipe_id=unquote(recipe_id),
        actor=str(body.get("actor") or "System Admin"),
    )
