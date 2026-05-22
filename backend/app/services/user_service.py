from typing import Any
from uuid import uuid4

from ..auth import ADMIN_ROLE, VALID_ROLES, hash_password, public_user
from ..domain import add_audit, user_by_id
from ..errors import ApiError

DEFAULT_NEW_USER_PASSWORD = "password123"


def list_users(store: Any) -> list[dict[str, Any]]:
    return [public_user(user) for user in store.read()["users"]]


def _next_user_id(state: dict[str, Any]) -> str:
    max_number = 0
    for user in state["users"]:
        raw_id = str(user.get("id", ""))
        if raw_id.startswith("USR-"):
            try:
                max_number = max(max_number, int(raw_id.removeprefix("USR-")))
            except ValueError:
                continue
    return f"USR-{max_number + 1:03d}"


def create_user(
    store: Any,
    *,
    username: str,
    name: str,
    role: str,
    department: str,
    site: str,
    actor: str,
) -> dict[str, Any]:
    username = str(username or "").strip()
    name = str(name or "").strip()
    role = str(role or "").strip()
    department = str(department or "").strip()
    site = str(site or "").strip()

    if not username or not name:
        raise ApiError("username and name are required", 400)
    if role not in VALID_ROLES:
        raise ApiError(f"Invalid role; expected one of: {', '.join(VALID_ROLES)}", 400)

    def mutate(state: dict[str, Any]) -> dict[str, Any]:
        if any(user["username"].lower() == username.lower() for user in state["users"]):
            raise ApiError("Username already exists", 409)

        user_id = _next_user_id(state)
        password_salt = f"user-{uuid4().hex}"
        user = {
            "id": user_id,
            "username": username,
            "name": name,
            "role": role,
            "department": department,
            "site": site,
            "passwordSalt": password_salt,
            "passwordHash": hash_password(DEFAULT_NEW_USER_PASSWORD, password_salt),
        }
        state["users"].append(user)
        add_audit(
            state,
            f"{username} account created with role {role}",
            actor or "System Admin",
            action="user.create",
            target_type="user",
            target_id=user_id,
        )
        return {
            "message": f"{username} created with default password",
            "user": public_user(user),
            "users": [public_user(item) for item in state["users"]],
            "defaultPassword": DEFAULT_NEW_USER_PASSWORD,
        }

    result = store.update(mutate)
    return {
        "message": result["message"],
        "user": result["user"],
        "users": result["users"],
        "defaultPassword": result["defaultPassword"],
    }


def update_user_role(store: Any, *, user_id: str, role: str, actor: str) -> dict[str, Any]:
    role = str(role or "").strip()
    if role not in VALID_ROLES:
        raise ApiError(f"Invalid role; expected one of: {', '.join(VALID_ROLES)}", 400)

    def mutate(state: dict[str, Any]) -> dict[str, Any]:
        user = user_by_id(state, user_id)
        if not user:
            raise ApiError("User not found", 404)

        previous_role = str(user.get("role", ""))
        if previous_role == ADMIN_ROLE and role != ADMIN_ROLE:
            admin_count = sum(1 for item in state["users"] if item.get("role") == ADMIN_ROLE)
            if admin_count <= 1:
                raise ApiError("Cannot remove the last admin", 409)

        if previous_role != role:
            user["role"] = role
            add_audit(
                state,
                f"{user['username']} role changed from {previous_role} to {role}",
                actor or "System Admin",
                action="user.role.update",
                target_type="user",
                target_id=user["id"],
            )

        return {
            "message": f"{user['username']} role updated to {role}",
            "users": [public_user(item) for item in state["users"]],
        }

    result = store.update(mutate)
    return {"message": result["message"], "users": result["users"]}
