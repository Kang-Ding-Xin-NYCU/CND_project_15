from typing import Any

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from ..auth import require_roles
from ..errors import ApiError
from ..http_utils import read_json_body, require_fields
from ..services import machine_event_service

router = APIRouter(prefix="/api/machine-events", tags=["machine-events"])


@router.post("", response_model=None)
async def process_machine_event(request: Request) -> JSONResponse:
    require_roles(request.state.user, "operator")
    body = await read_json_body(request)
    require_fields(body, ["equipmentId", "eventType"])
    payload: dict[str, Any] = body.get("payload") or {}
    if not isinstance(payload, dict):
        raise ApiError("payload must be an object", 400)

    result = machine_event_service.process_event(
        request.app.state.store,
        equipment_id=str(body["equipmentId"]),
        event_type=str(body["eventType"]),
        job_id=str(body.get("jobId") or ""),
        payload=payload,
        actor=str(body.get("actor") or "Machine"),
    )
    return JSONResponse(result, status_code=201)
