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


_WIP_SUFFIXES = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"


def split(store: Any, *, request_id: str, actor: str, wips: list[dict[str, Any]]) -> dict[str, Any]:
    def mutate(state: dict[str, Any]) -> dict[str, Any]:
        current = _find_or_404(state, request_id)
        assert_request_status(current, ("received",), "split")
        source = current["samples"][0] if current["samples"] else None
        if not source:
            raise ApiError("No sample to split", 409)

        if len(wips) < 1:
            raise ApiError("At least one WIP is required", 400)
        if len(wips) > len(_WIP_SUFFIXES):
            raise ApiError(f"Cannot split into more than {len(_WIP_SUFFIXES)} WIPs", 400)

        quantities: list[int] = []
        for index, wip in enumerate(wips):
            if not isinstance(wip, dict):
                raise ApiError(f"wips[{index}] must be an object", 400)
            try:
                qty = int(wip.get("quantity"))
            except (TypeError, ValueError) as exc:
                raise ApiError(f"wips[{index}].quantity must be an integer", 400) from exc
            if qty <= 0:
                raise ApiError(f"wips[{index}].quantity must be greater than 0", 400)
            quantities.append(qty)

        sample_qty = int(source.get("quantity") or 0)
        total_qty = sum(quantities)
        if total_qty > sample_qty:
            raise ApiError(
                f"Total WIP quantity {total_qty} exceeds sample quantity {sample_qty}",
                400,
            )

        current["status"] = "split"
        source["status"] = "split"
        current["wips"] = [
            {
                "id": f"{source['id']}-{_WIP_SUFFIXES[index]}",
                "source": source["id"],
                "quantity": quantities[index],
                "purpose": str(wip.get("purpose") or f"{current['labType']} split"),
                "status": "queued",
            }
            for index, wip in enumerate(wips)
        ]
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
