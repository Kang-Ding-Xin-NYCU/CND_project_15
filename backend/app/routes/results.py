from typing import Any

from fastapi import APIRouter, Query, Request

from ..errors import ApiError

router = APIRouter(prefix="/api/results", tags=["results"])


def _result_job(state: dict[str, Any], result: dict[str, Any]) -> dict[str, Any] | None:
    return next((job for job in state["jobs"] if job["id"] == result.get("jobId")), None)


def _result_matches(
    state: dict[str, Any],
    result: dict[str, Any],
    *,
    request_id: str | None,
    job_id: str | None,
    equipment_id: str | None,
    recipe_id: str | None,
) -> bool:
    metadata = result.get("metadata") if isinstance(result.get("metadata"), dict) else {}
    job = _result_job(state, result)
    result_equipment_id = metadata.get("equipmentId") or (job or {}).get("equipmentId")
    result_recipe_id = metadata.get("recipeId") or (job or {}).get("recipeId")

    return all(
        [
            not request_id or result.get("requestId") == request_id,
            not job_id or result.get("jobId") == job_id,
            not equipment_id or result_equipment_id == equipment_id,
            not recipe_id or result_recipe_id == recipe_id,
        ]
    )


@router.get("")
async def list_results(
    request: Request,
    request_id: str | None = Query(None, alias="requestId"),
    job_id: str | None = Query(None, alias="jobId"),
    equipment_id: str | None = Query(None, alias="equipmentId"),
    recipe_id: str | None = Query(None, alias="recipeId"),
) -> list[dict[str, Any]]:
    state = request.app.state.store.read()
    return [
        result
        for result in state["results"]
        if _result_matches(
            state,
            result,
            request_id=request_id,
            job_id=job_id,
            equipment_id=equipment_id,
            recipe_id=recipe_id,
        )
    ]


@router.get("/{result_id}")
async def get_result(result_id: str, request: Request) -> dict[str, Any]:
    result = next(
        (item for item in request.app.state.store.read()["results"] if item["id"] == result_id),
        None,
    )
    if not result:
        raise ApiError("Result not found", 404)
    return result
