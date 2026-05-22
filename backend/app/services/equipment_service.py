from typing import Any

from ..domain import add_audit, machine_by_id, machine_type, now_text, refresh_equipment_utilization
from ..errors import ApiError

ALLOWED_EQUIPMENT_STATUSES = ("idle", "running", "alarm", "maintenance")
OPERATOR_SETTABLE_STATUSES = ("idle", "alarm", "maintenance")


def _type_slug(value: str) -> str:
    slug = "".join(ch for ch in value.upper().strip().replace(" ", "-") if ch.isalnum() or ch == "-")
    return slug.strip("-") or "TYPE"


def _status(value: str) -> str:
    normalized = str(value or "").strip().lower()
    return "running" if normalized == "busy" else normalized


def _active_equipment_ids(state: dict[str, Any]) -> set[str]:
    return {
        job["equipmentId"]
        for job in state.get("jobs", [])
        if job.get("status") in {"queued", "running", "loaded"}
    }


def equipment_type_summary(state: dict[str, Any]) -> list[dict[str, Any]]:
    groups: dict[str, list[dict[str, Any]]] = {}
    for machine in state.get("equipment", []):
        groups.setdefault(machine_type(machine), []).append(machine)

    summaries = []
    for type_name, machines in sorted(groups.items()):
        total = len(machines)
        running = sum(1 for machine in machines if _status(machine.get("status")) == "running")
        sample = machines[0]
        summaries.append(
            {
                "type": type_name,
                "count": total,
                "running": running,
                "utilization": round((running / total) * 100) if total else 0,
                "area": sample.get("area", ""),
                "capability": sample.get("capability", ""),
            }
        )
    return summaries


def configure_types(store: Any, *, types: list[Any], actor: str) -> dict[str, Any]:
    normalized: list[dict[str, Any]] = []
    seen: set[str] = set()
    for index, item in enumerate(types):
        if not isinstance(item, dict):
            raise ApiError(f"types[{index}] must be an object", 400)
        raw_type = str(item.get("type") or "").strip().upper()
        if not raw_type:
            raise ApiError(f"types[{index}].type is required", 400)
        type_name = _type_slug(raw_type)
        if type_name in seen:
            raise ApiError(f"Duplicate equipment type: {type_name}", 400)
        seen.add(type_name)
        try:
            count = int(item.get("count"))
        except (TypeError, ValueError) as exc:
            raise ApiError(f"types[{index}].count must be an integer", 400) from exc
        if count < 1:
            raise ApiError(f"types[{index}].count must be greater than 0", 400)
        if count > 50:
            raise ApiError(f"types[{index}].count must be at most 50", 400)
        normalized.append(
            {
                "type": type_name,
                "count": count,
                "area": str(item.get("area") or f"Lab {type_name}").strip(),
                "capability": str(item.get("capability") or type_name).strip(),
            }
        )
    if not normalized:
        raise ApiError("At least one equipment type is required", 400)

    def mutate(state: dict[str, Any]) -> dict[str, Any]:
        active_ids = _active_equipment_ids(state)
        by_type: dict[str, list[dict[str, Any]]] = {}
        for machine in state["equipment"]:
            by_type.setdefault(machine_type(machine), []).append(machine)

        next_equipment: list[dict[str, Any]] = []
        retained_ids: set[str] = set()
        for spec in normalized:
            existing = sorted(by_type.get(spec["type"], []), key=lambda machine: str(machine.get("id", "")))
            for index in range(spec["count"]):
                if index < len(existing):
                    machine = dict(existing[index])
                    machine["type"] = spec["type"]
                    machine["area"] = spec["area"]
                    machine["capability"] = spec["capability"]
                    machine["status"] = _status(machine.get("status")) or "idle"
                else:
                    sequence = index + 1
                    machine = {
                        "id": f"EQ-{spec['type']}-{sequence:02d}",
                        "type": spec["type"],
                        "name": f"{spec['type']}-{sequence:02d}",
                        "area": spec["area"],
                        "capability": spec["capability"],
                        "status": "idle",
                        "utilization": 0,
                    }
                retained_ids.add(machine["id"])
                next_equipment.append(machine)

        removed_active = sorted(active_ids - retained_ids)
        if removed_active:
            raise ApiError(f"Cannot remove equipment with active jobs: {', '.join(removed_active)}", 409)

        state["equipment"] = next_equipment
        refresh_equipment_utilization(state)
        summary = ", ".join(f"{item['type']} x{item['count']}" for item in normalized)
        add_audit(
            state,
            f"Equipment types configured: {summary}",
            actor or "Lab Supervisor",
            action="equipment.types.configure",
            target_type="equipment",
        )
        return {
            "message": "Equipment types updated",
            "equipmentTypes": equipment_type_summary(state),
        }

    return store.update(mutate)


def change_status(
    store: Any,
    *,
    equipment_id: str,
    status: str,
    severity: str,
    message: str,
    actor: str,
) -> dict[str, Any]:
    target_status = _status(status)
    if target_status not in OPERATOR_SETTABLE_STATUSES:
        raise ApiError("status must be one of: idle, alarm, maintenance", 400)

    def mutate(state: dict[str, Any]) -> dict[str, Any]:
        machine = machine_by_id(state, equipment_id)
        if not machine:
            raise ApiError("Equipment not found", 404)
        current_status = _status(machine.get("status"))
        if target_status == "idle" and (current_status == "running" or equipment_id in _active_equipment_ids(state)):
            raise ApiError("Running equipment cannot be set to idle manually", 409)

        machine["status"] = target_status
        if target_status == "alarm":
            alarm_id = f"ALM-{state['alarmSeq']:03d}"
            state["alarmSeq"] += 1
            state["alarms"].insert(
                0,
                {
                    "id": alarm_id,
                    "equipmentId": machine["id"],
                    "severity": severity or "Medium",
                    "message": message or f"{machine['name']} reported an alarm",
                    "status": "alarm",
                    "createdAt": now_text(),
                },
            )
        refresh_equipment_utilization(state)
        add_audit(state, f"{machine['name']} status changed to {target_status}", actor)
        return {"message": f"{machine['name']} status updated"}

    return store.update(mutate)
