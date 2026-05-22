from datetime import datetime
from typing import Any

from .errors import ApiError


def now_text() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def add_audit(
    state: dict[str, Any],
    message: str,
    actor: str = "System",
    *,
    action: str | None = None,
    target_type: str | None = None,
    target_id: str | None = None,
) -> None:
    row: dict[str, Any] = {"message": message, "actor": actor, "occurredAt": now_text()}
    if action:
        row["action"] = action
    if target_type:
        row["targetType"] = target_type
    if target_id:
        row["targetId"] = target_id
    state["audit"].insert(0, row)


def request_by_id(state: dict[str, Any], request_id: str) -> dict[str, Any] | None:
    return next((request for request in state["requests"] if request["id"] == request_id), None)


def user_by_id(state: dict[str, Any], user_id: str) -> dict[str, Any] | None:
    return next((user for user in state["users"] if user["id"] == user_id), None)


def job_by_id(state: dict[str, Any], job_id: str) -> dict[str, Any] | None:
    return next((job for job in state["jobs"] if job["id"] == job_id), None)


def machine_by_id(state: dict[str, Any], equipment_id: str) -> dict[str, Any] | None:
    return next((machine for machine in state["equipment"] if machine["id"] == equipment_id), None)


def machine_type(machine: dict[str, Any]) -> str:
    explicit_type = str(machine.get("type") or "").strip()
    if explicit_type:
        return explicit_type
    raw_id = str(machine.get("id") or "")
    parts = raw_id.split("-")
    if len(parts) >= 3 and parts[0] == "EQ":
        return parts[1]
    return str(machine.get("name") or raw_id or "UNKNOWN").split("-")[0]


def refresh_equipment_utilization(state: dict[str, Any]) -> None:
    groups: dict[str, list[dict[str, Any]]] = {}
    for machine in state.get("equipment", []):
        if machine.get("status") == "busy":
            machine["status"] = "running"
        groups.setdefault(machine_type(machine), []).append(machine)

    for machines in groups.values():
        total = len(machines)
        running = sum(1 for machine in machines if machine.get("status") == "running")
        utilization = round((running / total) * 100) if total else 0
        for machine in machines:
            machine["utilization"] = utilization


def recipe_by_id(state: dict[str, Any], recipe_id: str) -> dict[str, Any] | None:
    return next((recipe for recipe in state["recipes"] if recipe["id"] == recipe_id), None)


def equipment_name(state: dict[str, Any], equipment_id: str) -> str:
    machine = machine_by_id(state, equipment_id)
    return machine["name"] if machine else equipment_id


def recipe_name(state: dict[str, Any], recipe_id: str) -> str:
    recipe = recipe_by_id(state, recipe_id)
    return recipe["name"] if recipe else recipe_id


def dispatchable_items(request: dict[str, Any]) -> list[dict[str, Any]]:
    return request["wips"] if request["wips"] else request["samples"]


def set_item_status(request: dict[str, Any], item_id: str, status: str) -> None:
    for item in [*request["wips"], *request["samples"]]:
        if item["id"] == item_id:
            item["status"] = status


def assert_request_status(request: dict[str, Any], allowed_statuses: list[str] | tuple[str, ...], action: str) -> None:
    if request.get("status") not in allowed_statuses:
        allowed = ", ".join(allowed_statuses)
        raise ApiError(f"Cannot {action} request in status {request.get('status')}; expected one of: {allowed}", 409)


def assert_job_status(job: dict[str, Any], allowed_statuses: list[str] | tuple[str, ...], action: str) -> None:
    if job.get("status") not in allowed_statuses:
        allowed = ", ".join(allowed_statuses)
        raise ApiError(f"Cannot {action} job in status {job.get('status')}; expected one of: {allowed}", 409)
