from typing import Any

from .domain import machine_type, refresh_equipment_utilization


def _count_by(items: list[dict[str, Any]], key: str) -> dict[str, int]:
    counts: dict[str, int] = {}
    for item in items:
        value = str(item.get(key) or "unknown")
        counts[value] = counts.get(value, 0) + 1
    return counts


def create_dashboard(state: dict[str, Any]) -> dict[str, Any]:
    refresh_equipment_utilization(state)
    request_by_status: dict[str, int] = {}
    for request in state["requests"]:
        request_by_status[request["status"]] = request_by_status.get(request["status"], 0) + 1

    recipe_active_count = {
        "active": len([recipe for recipe in state["recipes"] if recipe.get("active") is not False]),
        "inactive": len([recipe for recipe in state["recipes"] if recipe.get("active") is False]),
    }

    result_by_equipment: dict[str, int] = {}
    for result in state["results"]:
        metadata = result.get("metadata") if isinstance(result.get("metadata"), dict) else {}
        equipment_id = str(metadata.get("equipmentId") or "unknown")
        result_by_equipment[equipment_id] = result_by_equipment.get(equipment_id, 0) + 1

    equipment_type_utilization: list[dict[str, Any]] = []
    by_type: dict[str, list[dict[str, Any]]] = {}
    for machine in state["equipment"]:
        by_type.setdefault(machine_type(machine), []).append(machine)
    for type_name, machines in sorted(by_type.items()):
        total = len(machines)
        running = sum(1 for machine in machines if machine.get("status") == "running")
        equipment_type_utilization.append(
            {
                "type": type_name,
                "running": running,
                "total": total,
                "utilization": round((running / total) * 100) if total else 0,
            }
        )

    return {
        "pendingApproval": len([item for item in state["requests"] if item["status"] == "pending_approval"]),
        "pendingReceive": len([item for item in state["requests"] if item["status"] == "approved"]),
        "runningJobs": len([job for job in state["jobs"] if job["status"] in ["queued", "loaded", "running"]]),
        "activeAlarms": len([alarm for alarm in state["alarms"] if alarm["status"] == "alarm"]),
        "resultCount": len(state["results"]),
        "latestResults": state["results"][:5],
        "alarmBySeverity": _count_by(state["alarms"], "severity"),
        "equipmentStatusCount": _count_by(state["equipment"], "status"),
        "recipeActiveCount": recipe_active_count,
        "resultByEquipment": result_by_equipment,
        "equipmentUtilization": [
            {
                "id": machine["id"],
                "name": machine["name"],
                "type": machine_type(machine),
                "utilization": machine["utilization"],
                "status": machine["status"],
            }
            for machine in state["equipment"]
        ],
        "equipmentTypeUtilization": equipment_type_utilization,
        "requestByStatus": request_by_status,
        "operatorActions": state["audit"][:20],
    }
