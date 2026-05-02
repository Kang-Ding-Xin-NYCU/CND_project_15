import json
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

from .cache import NoopCache
from .config import MONGO_DB_NAME
from .seed import create_initial_state

CACHE_KEYS = ("state", "dashboard")


def _invalidate_cache(cache: Any) -> None:
    if getattr(cache, "enabled", False):
        cache.delete(*CACHE_KEYS)


class JsonStore:
    driver = "json"

    def __init__(self, data_file: str, cache: Any | None = None):
        self.data_file = Path(data_file)
        self.cache = cache or NoopCache()
        self._lock = threading.RLock()

    def _ensure_data_file(self) -> None:
        if self.data_file.exists():
            return
        self.data_file.parent.mkdir(parents=True, exist_ok=True)
        self.data_file.write_text(f"{json.dumps(create_initial_state(), indent=2)}\n", encoding="utf-8")

    def read(self) -> dict[str, Any]:
        with self._lock:
            self._ensure_data_file()
            return json.loads(self.data_file.read_text(encoding="utf-8"))

    def write(self, state: dict[str, Any]) -> None:
        with self._lock:
            self.data_file.parent.mkdir(parents=True, exist_ok=True)
            self.data_file.write_text(f"{json.dumps(state, indent=2)}\n", encoding="utf-8")
            _invalidate_cache(self.cache)

    def update(self, mutator: Callable[[dict[str, Any]], dict[str, Any] | None]) -> dict[str, Any]:
        with self._lock:
            state = self.read()
            result = mutator(state) or {}
            self.write(state)
            return {"state": state, **result}

    def reset(self) -> dict[str, Any]:
        state = create_initial_state()
        self.write(state)
        return state


class MongoStore:
    driver = "mongodb"

    def __init__(self, mongo_url: str, cache: Any | None = None, db_name: str = MONGO_DB_NAME):
        self.mongo_url = mongo_url
        self.cache = cache or NoopCache()
        self.db_name = db_name
        self._client = None
        self._collection = None
        self._lock = threading.RLock()

    def _get_collection(self) -> Any:
        if self._collection is not None:
            return self._collection
        try:
            from pymongo import MongoClient
        except ImportError as exc:
            raise RuntimeError("pymongo is not installed. Run `pip install -r backend/requirements.txt`.") from exc

        last_error = None
        for attempt in range(1, 9):
            try:
                self._client = MongoClient(self.mongo_url, serverSelectionTimeoutMS=1200)
                self._client.admin.command("ping")
                break
            except Exception as exc:
                last_error = exc
                if self._client:
                    self._client.close()
                    self._client = None
                import time

                time.sleep(attempt * 0.25)
        else:
            raise last_error

        db = self._client[self.db_name]
        self._collection = db["app_state"]
        if not self._collection.find_one({"_id": "lims-state"}):
            self._collection.insert_one(
                {"_id": "lims-state", "state": create_initial_state(), "updatedAt": datetime.now(timezone.utc)}
            )
        return self._collection

    def read(self) -> dict[str, Any]:
        with self._lock:
            document = self._get_collection().find_one({"_id": "lims-state"})
            return document.get("state") if document else create_initial_state()

    def write(self, state: dict[str, Any]) -> None:
        with self._lock:
            self._get_collection().update_one(
                {"_id": "lims-state"},
                {"$set": {"state": state, "updatedAt": datetime.now(timezone.utc)}},
                upsert=True,
            )
            _invalidate_cache(self.cache)

    def update(self, mutator: Callable[[dict[str, Any]], dict[str, Any] | None]) -> dict[str, Any]:
        with self._lock:
            state = self.read()
            result = mutator(state) or {}
            self.write(state)
            return {"state": state, **result}

    def reset(self) -> dict[str, Any]:
        state = create_initial_state()
        self.write(state)
        return state

    def close(self) -> None:
        if self._client:
            self._client.close()


def create_store(data_file: str, cache: Any | None = None, mongo_url: str = "", db_name: str = MONGO_DB_NAME) -> JsonStore | MongoStore:
    if mongo_url:
        return MongoStore(mongo_url, cache, db_name)
    return JsonStore(data_file, cache)

