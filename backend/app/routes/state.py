"""Read-only state and admin reset endpoints, plus generic list GETs."""

from typing import Any

from fastapi import APIRouter, Request

from ..auth import require_roles
from ..services import state_service

router = APIRouter(prefix="/api", tags=["state"])


@router.get("/state")
def get_state(request: Request) -> dict[str, Any]:
    return state_service.read_state(request.app.state.store)


@router.get("/dashboard")
def get_dashboard(request: Request) -> dict[str, Any]:
    return state_service.read_dashboard(request.app.state.store)


@router.post("/reset")
def reset(request: Request) -> dict[str, Any]:
    require_roles(request.state.user, "admin")
    return state_service.reset(request.app.state.store)


@router.get("/audit")
def list_audit(request: Request, limit: int = 20) -> list[dict[str, Any]]:
    return request.app.state.store.read()["audit"][: max(0, min(limit, 200))]


@router.get("/equipment")
def list_equipment(request: Request) -> list[dict[str, Any]]:
    return request.app.state.store.read()["equipment"]
