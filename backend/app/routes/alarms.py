from typing import Any
from urllib.parse import unquote

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from ..auth import require_roles
from ..http_utils import read_json_body
from ..services import alarm_service

router = APIRouter(prefix="/api/alarms", tags=["alarms"])


@router.get("")
async def list_alarms(request: Request) -> list[dict[str, Any]]:
    return request.app.state.store.read()["alarms"]


@router.post("/{alarm_id}/ack")
async def acknowledge_alarm(alarm_id: str, request: Request) -> dict[str, Any]:
    require_roles(request.state.user, "operator")
    body = await read_json_body(request)
    return alarm_service.acknowledge(
        request.app.state.store,
        alarm_id=unquote(alarm_id),
        actor=str(body.get("actor") or "Lab Operator"),
    )


@router.post("/simulate", response_model=None)
async def simulate_alarm(request: Request) -> JSONResponse:
    require_roles(request.state.user, "operator")
    body = await read_json_body(request)
    result = alarm_service.simulate(
        request.app.state.store,
        actor=str(body.get("actor") or "System"),
    )
    return JSONResponse(result, status_code=201)
