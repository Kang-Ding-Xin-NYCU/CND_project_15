from typing import Any

from .auth import hash_password


def seed_user(user_id: str, username: str, name: str, role: str, department: str, site: str) -> dict[str, Any]:
    password_salt = f"seed-{username}"
    return {
        "id": user_id,
        "username": username,
        "name": name,
        "role": role,
        "department": department,
        "site": site,
        "passwordSalt": password_salt,
        "passwordHash": hash_password("password123", password_salt),
    }


def create_initial_state() -> dict[str, Any]:
    return {
        "requestSeq": 4,
        "recipeSeq": 4,
        "jobSeq": 2,
        "alarmSeq": 2,
        "users": [
            seed_user("USR-001", "fab", "Ivy Chen", "fab", "Fab 12 R&D", "Fab 12"),
            seed_user("USR-002", "supervisor", "Sam Wang", "supervisor", "Central Lab", "Fab 12"),
            seed_user("USR-003", "operator", "Lab Operator", "operator", "Central Lab", "Fab 12"),
            seed_user("USR-004", "admin", "System Admin", "admin", "IT", "Global"),
        ],
        "requests": [
            {
                "id": "REQ-2026-001",
                "requester": "Evan Lin",
                "department": "Fab 12 R&D",
                "labType": "SEM",
                "priority": "High",
                "dueDate": "2026-05-08",
                "goal": "Gate oxide defect review with SEM imaging.",
                "status": "pending_approval",
                "samples": [{"id": "SMP-001", "material": "Wafer Lot A13", "quantity": 3, "status": "created"}],
                "wips": [],
            },
            {
                "id": "REQ-2026-002",
                "requester": "Mia Huang",
                "department": "Fab 15 Process",
                "labType": "XRD",
                "priority": "Normal",
                "dueDate": "2026-05-10",
                "goal": "Thin film stress trend check.",
                "status": "received",
                "samples": [{"id": "SMP-002", "material": "Wafer Lot B07", "quantity": 2, "status": "received"}],
                "wips": [
                    {"id": "WIP-002-A", "source": "SMP-002", "quantity": 1, "purpose": "XRD baseline", "status": "queued"},
                    {"id": "WIP-002-B", "source": "SMP-002", "quantity": 1, "purpose": "XRD confirm", "status": "queued"},
                ],
            },
            {
                "id": "REQ-2026-003",
                "requester": "Nora Wu",
                "department": "Fab 18 Yield",
                "labType": "FTIR",
                "priority": "Critical",
                "dueDate": "2026-05-06",
                "goal": "Urgent contamination scan.",
                "status": "in_progress",
                "samples": [{"id": "SMP-003", "material": "Wafer Lot C21", "quantity": 1, "status": "loaded"}],
                "wips": [{"id": "WIP-003-A", "source": "SMP-003", "quantity": 1, "purpose": "FTIR urgent scan", "status": "loaded"}],
            },
        ],
        "equipment": [
            {"id": "EQ-SEM-01", "type": "SEM", "name": "SEM-01", "area": "Lab A", "capability": "Defect review", "status": "idle", "utilization": 0},
            {"id": "EQ-XRD-01", "type": "XRD", "name": "XRD-01", "area": "Lab B", "capability": "Thin film stress", "status": "idle", "utilization": 0},
            {"id": "EQ-FTIR-01", "type": "FTIR", "name": "FTIR-01", "area": "Lab C", "capability": "Contamination scan", "status": "running", "utilization": 100},
            {"id": "EQ-PROBE-01", "type": "PROBE", "name": "Probe-01", "area": "Lab D", "capability": "Electrical probe", "status": "alarm", "utilization": 0},
        ],
        "recipes": [
            {"id": "RCP-001", "equipmentId": "EQ-SEM-01", "equipmentType": "SEM", "name": "Defect Review Standard", "version": "1.2.0", "parameters": "voltage=3kV; dwell=30ms", "active": True},
            {"id": "RCP-002", "equipmentId": "EQ-XRD-01", "equipmentType": "XRD", "name": "Thin Film Stress Scan", "version": "2.1.0", "parameters": "angle=20-80; step=0.02", "active": True},
            {"id": "RCP-003", "equipmentId": "EQ-FTIR-01", "equipmentType": "FTIR", "name": "Contamination Quick Scan", "version": "1.4.3", "parameters": "range=400-4000; resolution=4", "active": True},
        ],
        "jobs": [
            {
                "id": "JOB-2026-001",
                "requestId": "REQ-2026-003",
                "wipId": "WIP-003-A",
                "equipmentId": "EQ-FTIR-01",
                "recipeId": "RCP-003",
                "operator": "Lab Operator",
                "status": "running",
                "note": "Urgent yield support.",
                "history": [
                    {"action": "dispatch", "actor": "Lab Operator", "occurredAt": "2026-05-02 18:20", "note": "Dispatched"},
                    {"action": "load", "actor": "Lab Operator", "occurredAt": "2026-05-02 18:32", "note": "Loaded"},
                ],
            }
        ],
        "results": [],
        "alarms": [
            {
                "id": "ALM-001",
                "equipmentId": "EQ-PROBE-01",
                "severity": "High",
                "message": "Probe card contact resistance over threshold",
                "status": "alarm",
                "createdAt": "2026-05-02 18:00",
            }
        ],
        "audit": [
            {"message": "REQ-2026-003 dispatched to FTIR-01", "actor": "Lab Operator", "occurredAt": "2026-05-02 18:20"},
            {"message": "REQ-2026-002 received by lab", "actor": "Lab Operator", "occurredAt": "2026-05-02 17:50"},
            {"message": "REQ-2026-001 submitted for approval", "actor": "Evan Lin", "occurredAt": "2026-05-02 17:30"},
        ],
    }
