import base64
import hashlib
import hmac
import json
import time
import uuid
from typing import Any

from .config import JWT_SECRET
from .errors import ApiError

TOKEN_TTL_SECONDS = 60 * 60 * 8
ADMIN_ROLE = "admin"


def _base64_url_encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def _base64_url_decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(f"{value}{padding}")


def hash_password(password: str, salt: str) -> str:
    return hashlib.pbkdf2_hmac(
        "sha256",
        str(password).encode("utf-8"),
        str(salt).encode("utf-8"),
        120_000,
        dklen=32,
    ).hex()


def verify_password(password: str, user: dict[str, Any]) -> bool:
    expected = str(user.get("passwordHash", ""))
    actual = hash_password(password, str(user.get("passwordSalt", "")))
    return hmac.compare_digest(actual, expected)


def sign_jwt(payload: dict[str, Any], ttl_seconds: int = TOKEN_TTL_SECONDS, secret: str = JWT_SECRET) -> dict[str, Any]:
    now = int(time.time())
    header = {"alg": "HS256", "typ": "JWT"}
    body = {
        "iat": now,
        "exp": now + ttl_seconds,
        "jti": str(uuid.uuid4()),
        **payload,
    }
    encoded_header = _base64_url_encode(json.dumps(header, separators=(",", ":")).encode("utf-8"))
    encoded_body = _base64_url_encode(json.dumps(body, separators=(",", ":")).encode("utf-8"))
    signature = hmac.new(
        secret.encode("utf-8"),
        f"{encoded_header}.{encoded_body}".encode("ascii"),
        hashlib.sha256,
    ).digest()
    return {
        "token": f"{encoded_header}.{encoded_body}.{_base64_url_encode(signature)}",
        "payload": body,
    }


def verify_jwt(token: str, secret: str = JWT_SECRET) -> dict[str, Any]:
    try:
        encoded_header, encoded_body, signature = str(token or "").split(".")
    except ValueError as exc:
        raise ApiError("Invalid token", 401) from exc

    expected_signature = hmac.new(
        secret.encode("utf-8"),
        f"{encoded_header}.{encoded_body}".encode("ascii"),
        hashlib.sha256,
    ).digest()
    if not hmac.compare_digest(signature, _base64_url_encode(expected_signature)):
        raise ApiError("Invalid token signature", 401)

    try:
        payload = json.loads(_base64_url_decode(encoded_body))
    except (ValueError, json.JSONDecodeError) as exc:
        raise ApiError("Invalid token payload", 401) from exc

    if payload.get("exp") and int(payload["exp"]) < int(time.time()):
        raise ApiError("Token expired", 401)
    return payload


def public_user(user: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": user["id"],
        "username": user["username"],
        "name": user["name"],
        "role": user["role"],
        "department": user["department"],
        "site": user["site"],
    }


def get_bearer_token(authorization: str | None) -> str:
    value = authorization or ""
    prefix = "Bearer "
    if value.lower().startswith(prefix.lower()):
        return value[len(prefix) :].strip()
    return ""


def authenticate_header(authorization: str | None, cache: Any) -> dict[str, Any]:
    token = get_bearer_token(authorization)
    if not token:
        raise ApiError("Missing bearer token", 401)

    payload = verify_jwt(token)
    if getattr(cache, "enabled", False):
        session = cache.get_json(f"session:{payload.get('jti')}")
        if session is None:
            raise ApiError("Session expired or revoked", 401)
    return payload


def require_roles(user: dict[str, Any], *roles: str) -> None:
    role = str(user.get("role", ""))
    if role == ADMIN_ROLE or role in roles:
        return
    raise ApiError("Forbidden: insufficient role", 403)
