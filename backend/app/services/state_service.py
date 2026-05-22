from typing import Any

from ..dashboard import create_dashboard
from ..http_utils import cache_hit
from ..store import public_state


def read_state(store: Any) -> dict[str, Any]:
    if getattr(store.cache, "enabled", False):
        cached = store.cache.get_json("state")
        if cache_hit(cached):
            return cached
    state = public_state(store.read())
    if getattr(store.cache, "enabled", False):
        store.cache.set_json("state", state, 20)
    return state


def read_dashboard(store: Any) -> dict[str, Any]:
    if getattr(store.cache, "enabled", False):
        cached = store.cache.get_json("dashboard")
        if cache_hit(cached):
            return cached
    payload = create_dashboard(store.read())
    if getattr(store.cache, "enabled", False):
        store.cache.set_json("dashboard", payload, 30)
    return payload


def reset(store: Any) -> dict[str, Any]:
    return {"state": public_state(store.reset()), "message": "Demo data reset"}


def health(store: Any) -> dict[str, Any]:
    return {
        "status": "ok",
        "store": store.driver,
        "cache": "redis" if getattr(store.cache, "enabled", False) else "none",
    }
