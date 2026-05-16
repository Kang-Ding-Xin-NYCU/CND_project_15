from typing import Any
from urllib.parse import unquote

from fastapi import APIRouter, Request

from ..auth import require_roles
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
