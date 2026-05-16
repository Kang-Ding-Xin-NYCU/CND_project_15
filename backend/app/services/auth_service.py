from typing import Any

from ..auth import TOKEN_TTL_SECONDS, public_user, sign_jwt, verify_password
from ..domain import add_audit
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
