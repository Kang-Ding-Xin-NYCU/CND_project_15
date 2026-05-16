"""HTTP-layer helpers shared by routers: body parsing, validation, error JSON."""

import json
from typing import Any

from fastapi import Request
from fastapi.responses import JSONResponse

from .cache import CACHE_UNAVAILABLE
from .errors import ApiError


def json_error(message: str, status_code: int) -> JSONResponse:
    return JSONResponse({"error": message}, status_code=status_code)


async def read_json_body(request: Request) -> dict[str, Any]:
    raw = await request.body()
    if not raw:
        return {}
    if len(raw) > 1_000_000:
        raise ApiError("Payload too large", 413)
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ApiError("Invalid JSON body", 400) from exc
    if not isinstance(payload, dict):
        raise ApiError("JSON body must be an object", 400)
    return payload


def require_fields(body: dict[str, Any], fields: list[str]) -> None:
    missing = [field for field in fields if str(body.get(field, "")).strip() == ""]
    if missing:
        raise ApiError(f"Missing required fields: {', '.join(missing)}", 400)


def body_text(body: dict[str, Any], key: str, default: str = "") -> str:
    return str(body.get(key, default)).strip()


def body_number(body: dict[str, Any], key: str, default: int = 0) -> int | float:
    value = body.get(key, default)
    try:
        number = float(value)
    except (TypeError, ValueError):
        return default
    return int(number) if number.is_integer() else number


def cache_hit(value: Any) -> bool:
    return value is not None and value is not CACHE_UNAVAILABLE
