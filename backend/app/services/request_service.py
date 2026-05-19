from typing import Any

from ..domain import add_audit, assert_request_status, now_text, request_by_id
from ..errors import ApiError


def create_request(store: Any, *, payload: dict[str, Any]) -> dict[str, Any]:
    def mutate(state: dict[str, Any]) -> dict[str, Any]:
        request_id = f"REQ-2026-{state['requestSeq']:03d}"
        state["requestSeq"] += 1
        new_request = {
            "id": request_id,
            "requester": payload["requester"],
            "department": payload["department"],
            "labType": payload["labType"],
            "priority": payload["priority"],
            "dueDate": payload["dueDate"],
            "goal": payload["goal"],
            "status": "pending_approval",
            "samples": [
                {
                    "id": payload["sampleCode"],
                    "material": payload["material"],
                    "quantity": payload["quantity"],
                    "status": "created",
                }
            ],
            "wips": [],
        }
        state["requests"].insert(0, new_request)
        add_audit(
            state,
            f"{request_id} submitted by {new_request['requester']}",
            new_request["requester"],
            action="request.create",
            target_type="request",
            target_id=request_id,
        )
        return {"message": f"{request_id} submitted for approval"}

    return store.update(mutate)


def _find_or_404(state: dict[str, Any], request_id: str) -> dict[str, Any]:
    current = request_by_id(state, request_id)
    if not current:
        raise ApiError("Request not found", 404)
    return current


def approve(store: Any, *, request_id: str, actor: str) -> dict[str, Any]:
    def mutate(state: dict[str, Any]) -> dict[str, Any]:
        current = _find_or_404(state, request_id)
        assert_request_status(current, ("pending_approval",), "approve")
        current["status"] = "approved"
        add_audit(
            state,
            f"{current['id']} approved",
            actor,
            action="request.approve",
            target_type="request",
            target_id=current["id"],
        )
        return {"message": f"{current['id']} approved"}

    return store.update(mutate)


def reject(store: Any, *, request_id: str, actor: str, reason: str) -> dict[str, Any]:
    def mutate(state: dict[str, Any]) -> dict[str, Any]:
        current = _find_or_404(state, request_id)
        assert_request_status(current, ("pending_approval",), "reject")
        current["status"] = "rejected"
        current["rejectReason"] = reason or "Rejected by supervisor"
        add_audit(
            state,
            f"{current['id']} rejected",
            actor,
            action="request.reject",
            target_type="request",
            target_id=current["id"],
        )
        return {"message": f"{current['id']} rejected"}

    return store.update(mutate)


def receive(store: Any, *, request_id: str, actor: str) -> dict[str, Any]:
    def mutate(state: dict[str, Any]) -> dict[str, Any]:
        current = _find_or_404(state, request_id)
        assert_request_status(current, ("approved",), "receive")
        current["status"] = "received"
        current["receivedAt"] = now_text()
        for sample in current["samples"]:
            sample["status"] = "received"
        add_audit(
            state,
            f"{current['id']} received by lab",
            actor,
            action="request.receive",
            target_type="request",
            target_id=current["id"],
        )
        return {"message": f"{current['id']} received"}

    return store.update(mutate)


def split(store: Any, *, request_id: str, actor: str) -> dict[str, Any]:
    def mutate(state: dict[str, Any]) -> dict[str, Any]:
        current = _find_or_404(state, request_id)
        assert_request_status(current, ("received",), "split")
        source = current["samples"][0] if current["samples"] else None
        if not source:
            raise ApiError("No sample to split", 409)
        current["status"] = "split"
        source["status"] = "split"
        if not current["wips"]:
            total = max(1, int(source.get("quantity") or 1))
            first_qty = 1 if total == 1 else total // 2
            second_qty = total - first_qty
            current["wips"] = [
                {
                    "id": f"{source['id']}-A",
                    "source": source["id"],
                    "quantity": first_qty,
                    "purpose": f"{current['labType']} primary",
                    "status": "queued",
                }
            ]
            if second_qty > 0:
                current["wips"].append(
                    {
                        "id": f"{source['id']}-B",
                        "source": source["id"],
                        "quantity": second_qty,
                        "purpose": f"{current['labType']} backup",
                        "status": "queued",
                    }
                )
        add_audit(
            state,
            f"{current['id']} split into {', '.join(wip['id'] for wip in current['wips'])}",
            actor,
            action="request.split",
            target_type="request",
            target_id=current["id"],
        )
        return {"message": f"{current['id']} split into WIP"}

    return store.update(mutate)


def close(store: Any, *, request_id: str, actor: str) -> dict[str, Any]:
    def mutate(state: dict[str, Any]) -> dict[str, Any]:
        current = _find_or_404(state, request_id)
        assert_request_status(current, ("completed", "in_progress"), "close")
        current["status"] = "closed"
        current["closedAt"] = now_text()
        add_audit(
            state,
            f"{current['id']} closed",
            actor,
            action="request.close",
            target_type="request",
            target_id=current["id"],
        )
        return {"message": f"{current['id']} closed"}

    return store.update(mutate)
