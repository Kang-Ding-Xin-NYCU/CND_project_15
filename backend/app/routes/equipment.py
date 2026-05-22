from typing import Any
from urllib.parse import unquote

from fastapi import APIRouter, Request

from ..auth import require_roles
from ..errors import ApiError
from ..http_utils import read_json_body, require_fields
from ..services import equipment_service

router = APIRouter(prefix="/api/equipment", tags=["equipment"])


@router.post("/{equipment_id}/status")
async def change_equipment_status(equipment_id: str, request: Request) -> dict[str, Any]:
    require_roles(request.state.user, "operator")
    body = await read_json_body(request)
    require_fields(body, ["status"])
    return equipment_service.change_status(
        request.app.state.store,
        equipment_id=unquote(equipment_id),
        status=str(body["status"]),
        severity=str(body.get("severity") or ""),
        message=str(body.get("message") or ""),
        actor=str(body.get("actor") or "Lab Operator"),
    )


@router.put("/types")
async def configure_equipment_types(request: Request) -> dict[str, Any]:
    require_roles(request.state.user, "supervisor")
    body = await read_json_body(request)
    raw_types = body.get("types", [])
    if not isinstance(raw_types, list):
        raise ApiError("types must be an array", 400)
    return equipment_service.configure_types(
        request.app.state.store,
        types=raw_types,
        actor=str(body.get("actor") or "Lab Supervisor"),
    )
