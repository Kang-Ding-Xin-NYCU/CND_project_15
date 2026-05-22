from typing import Any

from ..domain import (
    add_audit,
    assert_job_status,
    assert_request_status,
    dispatchable_items,
    equipment_name,
    job_by_id,
    machine_by_id,
    now_text,
    recipe_by_id,
    recipe_name,
    request_by_id,
    set_item_status,
)
from ..errors import ApiError


def complete_job_in_state(
    state: dict[str, Any],
    *,
    job: dict[str, Any],
    actor: str,
    action: str,
    history_action: str,
    history_note: str,
    result_source: str,
    payload: dict[str, Any] | None = None,
) -> None:
    assert_job_status(job, ("running", "loaded"), action)

    current_request = request_by_id(state, job["requestId"])
    machine = machine_by_id(state, job["equipmentId"])
    recipe = recipe_by_id(state, job["recipeId"]) or {}
    effective_actor = actor or job.get("operator") or "Lab Operator"
    completed_at = now_text()

    job["status"] = "completed"
    job.setdefault("history", []).append(
        {"action": history_action, "actor": effective_actor, "occurredAt": completed_at, "note": history_note}
    )
    if machine:
        machine["status"] = "idle"
        machine["utilization"] = min(99, int(machine.get("utilization", 0)) + 5)
    if current_request:
        current_request["status"] = "closed"
        current_request["closedAt"] = completed_at
        set_item_status(current_request, job["wipId"], "processed")

    result_id = f"RST-{job['id'].replace('JOB-', '')}"
    if not any(result["id"] == result_id for result in state["results"]):
        result_payload = payload or {}
        raw_data_uri = str(
            result_payload.get("rawData") or result_payload.get("rawUri") or f"s3://lims-demo/raw/{job['id']}.csv"
        )
        report_uri = str(
            result_payload.get("report") or result_payload.get("reportUri") or f"s3://lims-demo/report/{job['requestId']}.pdf"
        )
        state["results"].insert(
            0,
            {
                "id": result_id,
                "requestId": job["requestId"],
                "jobId": job["id"],
                "summary": f"{equipment_name(state, job['equipmentId'])} finished {recipe_name(state, job['recipeId'])}",
                "rawData": raw_data_uri,
                "report": report_uri,
                "metadata": {
                    "source": result_source,
                    "capturedBy": effective_actor,
                    "equipmentId": job["equipmentId"],
                    "equipmentName": equipment_name(state, job["equipmentId"]),
                    "recipeId": job["recipeId"],
                    "recipeName": recipe_name(state, job["recipeId"]),
                    "recipeVersion": recipe.get("version", ""),
                    "wipId": job.get("wipId", ""),
                    "operator": job.get("operator", ""),
                    "payload": result_payload,
                },
                "rawDataMetadata": {
                    "uri": raw_data_uri,
                    "format": str(result_payload.get("rawFormat") or "csv"),
                    "capturedAt": completed_at,
                },
                "reportMetadata": {
                    "uri": report_uri,
                    "format": str(result_payload.get("reportFormat") or "pdf"),
                    "generatedAt": completed_at,
                },
                "createdAt": completed_at,
            },
        )
    add_audit(
        state,
        f"{job['id']} completed and result captured",
        effective_actor,
        action=f"job.{history_action}",
        target_type="job",
        target_id=job["id"],
    )


def create_job(
    store: Any,
    *,
    request_id: str,
    wip_id: str,
    equipment_id: str,
    recipe_id: str,
    operator: str,
    note: str,
) -> dict[str, Any]:
    def mutate(state: dict[str, Any]) -> dict[str, Any]:
        current_request = request_by_id(state, request_id)
        machine = machine_by_id(state, equipment_id)
        recipe = recipe_by_id(state, recipe_id)
        if not current_request or not machine or not recipe:
            raise ApiError("Request, equipment, or recipe not found", 404)
        assert_request_status(current_request, ("received", "split"), "dispatch")
        target_wip = next(
            (item for item in dispatchable_items(current_request) if item["id"] == wip_id),
            None,
        )
        if not target_wip:
            raise ApiError("Selected WIP/sample does not belong to request", 409)
        if target_wip.get("status") != "queued":
            raise ApiError(
                f"WIP {wip_id} is not dispatchable (status: {target_wip.get('status')})",
                409,
            )
        active_job_statuses = {"queued", "running", "loaded"}
        if any(
            job["requestId"] == current_request["id"]
            and job["wipId"] == wip_id
            and job.get("status") in active_job_statuses
            for job in state["jobs"]
        ):
            raise ApiError(f"WIP {wip_id} already has an active job", 409)
        if machine["status"] in ["maintenance", "alarm"]:
            raise ApiError("Equipment is not dispatchable", 409)
        if recipe.get("equipmentId") != machine["id"]:
            raise ApiError("Recipe does not belong to selected equipment", 409)
        if recipe.get("active") is False:
            raise ApiError("Recipe is inactive", 409)

        job_id = f"JOB-2026-{state['jobSeq']:03d}"
        state["jobSeq"] += 1
        job = {
            "id": job_id,
            "requestId": current_request["id"],
            "wipId": wip_id,
            "equipmentId": machine["id"],
            "recipeId": recipe["id"],
            "operator": operator,
            "status": "queued",
            "note": note,
            "history": [{"action": "dispatch", "actor": operator, "occurredAt": now_text(), "note": "Dispatched"}],
        }
        state["jobs"].insert(0, job)
        current_request["status"] = "in_progress"
        set_item_status(current_request, wip_id, "dispatched")
        add_audit(
            state,
            f"{current_request['id']} dispatched as {job_id} on {machine['name']}",
            operator,
            action="job.dispatch",
            target_type="job",
            target_id=job_id,
        )
        return {"message": f"{job_id} dispatched"}

    return store.update(mutate)


def job_history(store: Any, *, job_id: str) -> dict[str, Any]:
    job = job_by_id(store.read(), job_id)
    if not job:
        raise ApiError("Job not found", 404)
    return {"history": job.get("history", [])}


def load_job(store: Any, *, job_id: str, actor: str) -> dict[str, Any]:
    def mutate(state: dict[str, Any]) -> dict[str, Any]:
        job = job_by_id(state, job_id)
        if not job:
            raise ApiError("Job not found", 404)
        assert_job_status(job, ("queued",), "load")

        current_request = request_by_id(state, job["requestId"])
        machine = machine_by_id(state, job["equipmentId"])
        effective_actor = actor or job.get("operator") or "Lab Operator"

        job["status"] = "running"
        job.setdefault("history", []).append(
            {"action": "load", "actor": effective_actor, "occurredAt": now_text(), "note": "Loaded"}
        )
        if machine:
            machine["status"] = "busy"
            machine["utilization"] = min(96, int(machine.get("utilization", 0)) + 8)
        if current_request:
            current_request["status"] = "in_progress"
            set_item_status(current_request, job["wipId"], "loaded")
        add_audit(
            state,
            f"{job['id']} loaded",
            effective_actor,
            action="job.load",
            target_type="job",
            target_id=job["id"],
        )
        return {"message": f"{job['id']} loaded"}

    return store.update(mutate)


def unload_job(store: Any, *, job_id: str, actor: str) -> dict[str, Any]:
    def mutate(state: dict[str, Any]) -> dict[str, Any]:
        job = job_by_id(state, job_id)
        if not job:
            raise ApiError("Job not found", 404)
        complete_job_in_state(
            state,
            job=job,
            actor=actor,
            action="unload",
            history_action="unload",
            history_note="Unloaded",
            result_source="dispatch.unload",
        )
        return {"message": f"{job['id']} completed"}

    return store.update(mutate)
