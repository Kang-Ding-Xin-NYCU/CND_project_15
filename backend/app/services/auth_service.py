from typing import Any

from uuid import uuid4

from ..auth import TOKEN_TTL_SECONDS, hash_password, public_user, sign_jwt, verify_password
from ..domain import add_audit, user_by_id
from ..errors import ApiError


def login(store: Any, *, username: str, password: str) -> dict[str, Any]:
    state = store.read()
    user = next((item for item in state["users"] if item["username"] == username), None)
    if not user or not verify_password(password, user):
        raise ApiError("Invalid username or password", 401)

    safe_user = public_user(user)
    token_data = sign_jwt(
        {
            "sub": user["id"],
            "username": user["username"],
            "name": user["name"],
            "role": user["role"],
        }
    )
    if getattr(store.cache, "enabled", False):
        store.cache.set_json(f"session:{token_data['payload']['jti']}", safe_user, TOKEN_TTL_SECONDS)

    def mutate(current_state: dict[str, Any]) -> dict[str, Any]:
        add_audit(current_state, f"{user['name']} logged in", user["name"])
        return {}

    store.update(mutate)
    return {
        "token": token_data["token"],
        "user": safe_user,
        "expiresAt": token_data["payload"]["exp"],
    }


def logout(store: Any, *, jti: str | None) -> dict[str, str]:
    if jti and getattr(store.cache, "enabled", False):
        store.cache.delete(f"session:{jti}")
    return {"message": "Logged out"}


def change_password(
    store: Any,
    *,
    user_id: str,
    current_password: str,
    new_password: str,
    actor: str,
) -> dict[str, str]:
    current_password = str(current_password or "")
    new_password = str(new_password or "")
    if len(new_password) < 8:
        raise ApiError("New password must be at least 8 characters", 400)
    if current_password == new_password:
        raise ApiError("New password must be different from current password", 400)

    def mutate(state: dict[str, Any]) -> dict[str, Any]:
        user = user_by_id(state, user_id)
        if not user:
            raise ApiError("User not found", 404)
        if not verify_password(current_password, user):
            raise ApiError("Current password is incorrect", 401)

        password_salt = f"user-{uuid4().hex}"
        user["passwordSalt"] = password_salt
        user["passwordHash"] = hash_password(new_password, password_salt)
        add_audit(
            state,
            f"{user['username']} changed password",
            actor or user.get("name") or "System",
            action="user.password.change",
            target_type="user",
            target_id=user["id"],
        )
        return {"message": "Password updated"}

    result = store.update(mutate)
    return {"message": result["message"]}
