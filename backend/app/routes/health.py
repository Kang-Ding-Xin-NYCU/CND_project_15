from typing import Any

from fastapi import APIRouter, Request

from ..services import state_service

router = APIRouter(prefix="/api", tags=["health"])


@router.get("/health")
def health(request: Request) -> dict[str, Any]:
    return state_service.health(request.app.state.store)
