from typing import Any

from ..domain import add_audit, machine_by_id, now_text
from ..errors import ApiError


def change_status(
    store: Any,
    *,
    equipment_id: str,
    status: str,
    severity: str,
    message: str,
    actor: str,
) -> dict[str, Any]:
    def mutate(state: dict[str, Any]) -> dict[str, Any]:
        machine = machine_by_id(state, equipment_id)
        if not machine:
            raise ApiError("Equipment not found", 404)
        machine["status"] = status
        if status == "alarm":
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
        add_audit(state, f"{machine['name']} status changed to {status}", actor)
        return {"message": f"{machine['name']} status updated"}

    return store.update(mutate)
