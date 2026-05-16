from typing import Any

from ..domain import add_audit, machine_by_id, now_text
from ..errors import ApiError


def acknowledge(store: Any, *, alarm_id: str, actor: str) -> dict[str, Any]:
    def mutate(state: dict[str, Any]) -> dict[str, Any]:
        alarm = next((item for item in state["alarms"] if item["id"] == alarm_id), None)
        if not alarm:
            raise ApiError("Alarm not found", 404)
        alarm["status"] = "closed"
        alarm["acknowledgedAt"] = now_text()
        alarm["acknowledgedBy"] = actor
        machine = machine_by_id(state, alarm["equipmentId"])
        if machine and machine["status"] == "alarm":
            machine["status"] = "maintenance"
        add_audit(state, f"{alarm['id']} acknowledged", alarm["acknowledgedBy"])
        return {"message": f"{alarm['id']} acknowledged"}

    return store.update(mutate)


def simulate(store: Any, *, actor: str) -> dict[str, Any]:
    def mutate(state: dict[str, Any]) -> dict[str, Any]:
        machine = next((item for item in state["equipment"] if item["status"] != "alarm"), state["equipment"][0])
        machine["status"] = "alarm"
        alarm_id = f"ALM-{state['alarmSeq']:03d}"
        state["alarmSeq"] += 1
        state["alarms"].insert(
            0,
            {
                "id": alarm_id,
                "equipmentId": machine["id"],
                "severity": "Medium",
                "message": f"{machine['name']} reported an alarm",
                "status": "alarm",
                "createdAt": now_text(),
            },
        )
        add_audit(state, f"{machine['name']} simulated alarm {alarm_id}", actor)
        return {"message": f"{alarm_id} simulated"}

    return store.update(mutate)
