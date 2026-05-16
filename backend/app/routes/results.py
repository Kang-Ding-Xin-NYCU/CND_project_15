from typing import Any

from fastapi import APIRouter, Request

from ..errors import ApiError

router = APIRouter(prefix="/api/results", tags=["results"])


@router.get("")
def list_results(request: Request) -> list[dict[str, Any]]:
    return request.app.state.store.read()["results"]


@router.get("/{result_id}")
def get_result(result_id: str, request: Request) -> dict[str, Any]:
    result = next(
        (item for item in request.app.state.store.read()["results"] if item["id"] == result_id),
        None,
    )
    if not result:
        raise ApiError("Result not found", 404)
    return result
