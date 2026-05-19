from typing import Any


def create_dashboard(state: dict[str, Any]) -> dict[str, Any]:
    request_by_status: dict[str, int] = {}
    for request in state["requests"]:
        request_by_status[request["status"]] = request_by_status.get(request["status"], 0) + 1

    return {
        "pendingApproval": len([item for item in state["requests"] if item["status"] == "pending_approval"]),
        "pendingReceive": len([item for item in state["requests"] if item["status"] == "approved"]),
        "runningJobs": len([job for job in state["jobs"] if job["status"] in ["queued", "loaded", "running"]]),
        "activeAlarms": len([alarm for alarm in state["alarms"] if alarm["status"] == "alarm"]),
        "resultCount": len(state["results"]),
        "latestResults": state["results"][:5],
        "equipmentUtilization": [
            {
                "id": machine["id"],
                "name": machine["name"],
                "utilization": machine["utilization"],
                "status": machine["status"],
            }
            for machine in state["equipment"]
        ],
        "requestByStatus": request_by_status,
        "operatorActions": state["audit"][:20],
    }
