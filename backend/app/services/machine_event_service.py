from typing import Any

from ..domain import add_audit, job_by_id, machine_by_id, now_text
from ..errors import ApiError
from .alarm_service import create_alarm_in_state, create_threshold_alarm_if_needed
from .dispatch_service import complete_job_in_state

ALLOWED_EVENT_TYPES = ("completed", "alarm", "measurement")


def _require_job_id(job_id: str, event_type: str) -> None:
    if not job_id.strip():
        raise ApiError(f"jobId is required for {event_type} events", 400)


def process_event(
    store: Any,
    *,
    equipment_id: str,
    event_type: str,
    job_id: str,
    payload: dict[str, Any],
    actor: str,
) -> dict[str, Any]:
    normalized_event_type = event_type.strip().lower()
    if normalized_event_type not in ALLOWED_EVENT_TYPES:
        raise ApiError("eventType must be one of: completed, alarm, measurement", 400)

    def mutate(state: dict[str, Any]) -> dict[str, Any]:
        machine = machine_by_id(state, equipment_id)
        if not machine:
            raise ApiError("Equipment not found", 404)

        effective_actor = actor or "Machine"
        if normalized_event_type == "completed":
            _require_job_id(job_id, normalized_event_type)
            job = job_by_id(state, job_id)
            if not job:
                raise ApiError("Job not found", 404)
            if job.get("equipmentId") != machine["id"]:
                raise ApiError("Job does not belong to selected equipment", 409)
            complete_job_in_state(
                state,
                job=job,
                actor=effective_actor,
                action="complete from machine event",
                history_action="machine.completed",
                history_note="Machine completed event",
                result_source="machine_event.completed",
                payload=payload,
            )
            add_audit(state, f"{machine['name']} completed {job['id']} via machine event", effective_actor)
            return {"message": "event processed"}

        if normalized_event_type == "alarm":
            create_alarm_in_state(
                state,
                machine=machine,
                severity=str(payload.get("severity") or "Medium"),
                message=str(payload.get("message") or f"{machine['name']} reported an alarm"),
                actor=effective_actor,
                source="machine_event",
            )
            return {"message": "event processed"}

        _require_job_id(job_id, normalized_event_type)
        job = job_by_id(state, job_id)
        if not job:
            raise ApiError("Job not found", 404)
        if job.get("equipmentId") != machine["id"]:
            raise ApiError("Job does not belong to selected equipment", 409)
        measurement_time = now_text()
        job.setdefault("history", []).append(
            {
                "action": "machine.measurement",
                "actor": effective_actor,
                "occurredAt": measurement_time,
                "note": str(payload.get("note") or "Measurement event"),
                "payload": payload,
            }
        )
        create_threshold_alarm_if_needed(state, machine=machine, payload=payload, actor=effective_actor)
        add_audit(state, f"{machine['name']} measurement appended to {job['id']}", effective_actor)
        return {"message": "event processed"}

    return store.update(mutate)
