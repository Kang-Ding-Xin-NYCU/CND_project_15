from datetime import datetime
from typing import Any


def now_text() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def add_audit(state: dict[str, Any], message: str, actor: str = "System") -> None:
    state["audit"].insert(0, {"message": message, "actor": actor, "occurredAt": now_text()})


def request_by_id(state: dict[str, Any], request_id: str) -> dict[str, Any] | None:
    return next((request for request in state["requests"] if request["id"] == request_id), None)


def job_by_id(state: dict[str, Any], job_id: str) -> dict[str, Any] | None:
    return next((job for job in state["jobs"] if job["id"] == job_id), None)


def machine_by_id(state: dict[str, Any], equipment_id: str) -> dict[str, Any] | None:
    return next((machine for machine in state["equipment"] if machine["id"] == equipment_id), None)


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

