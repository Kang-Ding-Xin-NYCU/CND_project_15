from typing import Any

from ..domain import add_audit, machine_by_id, now_text, refresh_equipment_utilization
from ..errors import ApiError


def _payload_number(payload: dict[str, Any], *keys: str) -> float | None:
    for key in keys:
        value = payload.get(key)
        if value is None or value == "":
            continue
        try:
            return float(value)
        except (TypeError, ValueError):
            return None
    return None


def create_alarm_in_state(
    state: dict[str, Any],
    *,
    machine: dict[str, Any],
    severity: str,
    message: str,
    actor: str,
    source: str,
) -> dict[str, Any]:
    machine["status"] = "alarm"
    refresh_equipment_utilization(state)
    alarm_id = f"ALM-{state['alarmSeq']:03d}"
    state["alarmSeq"] += 1
    alarm = {
        "id": alarm_id,
        "equipmentId": machine["id"],
        "severity": severity or "Medium",
        "message": message or f"{machine['name']} reported an alarm",
        "status": "alarm",
        "source": source,
        "createdAt": now_text(),
    }
    state["alarms"].insert(0, alarm)
    add_audit(state, f"{machine['name']} raised alarm {alarm_id}", actor)
    return alarm


def create_threshold_alarm_if_needed(
    state: dict[str, Any],
    *,
    machine: dict[str, Any],
    payload: dict[str, Any],
    actor: str,
) -> dict[str, Any] | None:
    value = _payload_number(payload, "value", "measurementValue")
    threshold = _payload_number(payload, "threshold", "alarmThreshold", "limit")
    if value is None or threshold is None:
        return None

    direction = str(payload.get("direction") or "above").lower()
    exceeded = value < threshold if direction in ("below", "min", "less_than") else value > threshold
    if not exceeded:
        return None

    metric = str(payload.get("metric") or payload.get("name") or "measurement")
    unit = str(payload.get("unit") or "")
    value_text = f"{value:g}{unit}"
    threshold_text = f"{threshold:g}{unit}"
    message = str(
        payload.get("message") or f"{machine['name']} {metric} {value_text} exceeded threshold {threshold_text}"
    )
    return create_alarm_in_state(
        state,
        machine=machine,
        severity=str(payload.get("severity") or "High"),
        message=message,
        actor=actor,
        source="threshold",
    )


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
            refresh_equipment_utilization(state)
        add_audit(state, f"{alarm['id']} acknowledged", alarm["acknowledgedBy"])
        return {"message": f"{alarm['id']} acknowledged"}

    return store.update(mutate)


def simulate(store: Any, *, actor: str) -> dict[str, Any]:
    def mutate(state: dict[str, Any]) -> dict[str, Any]:
        machine = next((item for item in state["equipment"] if item["status"] != "alarm"), state["equipment"][0])
        alarm = create_alarm_in_state(
            state,
            machine=machine,
            severity="Medium",
            message=f"{machine['name']} reported an alarm",
            actor=actor,
            source="simulate",
        )
        return {"message": f"{alarm['id']} simulated"}

    return store.update(mutate)
