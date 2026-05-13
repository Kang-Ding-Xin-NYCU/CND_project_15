import json
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

from .cache import NoopCache
from .config import MONGO_DB_NAME
from .seed import create_initial_state

CACHE_KEYS = ("state", "dashboard")
STATE_COLLECTION_KEYS = ("users", "requests", "equipment", "recipes", "jobs", "results", "alarms", "audit")
SEQUENCE_KEYS = ("requestSeq", "recipeSeq", "jobSeq", "alarmSeq")
DEFAULT_SEQUENCE_VALUES = {"requestSeq": 4, "recipeSeq": 4, "jobSeq": 2, "alarmSeq": 2}
MONGO_META_COLLECTION = "app_meta"
MONGO_META_ID = "state-meta"
MONGO_SCHEMA_VERSION = 2
LEGACY_STATE_COLLECTION = "app_state"


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
        self._db = None
        self._ready = False
        self._lock = threading.RLock()

    def _get_db(self) -> Any:
        if self._db is not None:
            if not self._ready:
                self._ensure_ready(self._db)
            return self._db
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

        self._db = self._client[self.db_name]
        self._ensure_ready(self._db)
        return self._db

    def _ensure_ready(self, db: Any) -> None:
        if self._ready:
            return
        self._ensure_indexes(db)

        meta = db[MONGO_META_COLLECTION].find_one({"_id": MONGO_META_ID})
        if not meta:
            legacy = db[LEGACY_STATE_COLLECTION].find_one({"_id": "lims-state"})
            state = legacy.get("state") if legacy and isinstance(legacy.get("state"), dict) else create_initial_state()
            self._replace_state(db, state)

        self._ready = True

    def _ensure_indexes(self, db: Any) -> None:
        for collection_name in STATE_COLLECTION_KEYS:
            db[collection_name].create_index("_order")

        db["users"].create_index("username", unique=True)
        db["requests"].create_index("status")
        db["requests"].create_index("dueDate")
        db["equipment"].create_index("status")
        db["recipes"].create_index([("equipmentId", 1), ("active", 1)])
        db["jobs"].create_index("status")
        db["jobs"].create_index("requestId")
        db["jobs"].create_index("equipmentId")
        db["results"].create_index("requestId")
        db["results"].create_index("jobId")
        db["alarms"].create_index("status")
        db["alarms"].create_index("equipmentId")
        db["audit"].create_index("occurredAt")

    def _replace_state(self, db: Any, state: dict[str, Any]) -> None:
        for collection_name in STATE_COLLECTION_KEYS:
            collection = db[collection_name]
            collection.delete_many({})
            documents = []
            for position, item in enumerate(state.get(collection_name, [])):
                document = dict(item)
                if "id" in document:
                    document["_id"] = document["id"]
                document["_order"] = position
                documents.append(document)
            if documents:
                collection.insert_many(documents)

        metadata = {
            "_id": MONGO_META_ID,
            "schemaVersion": MONGO_SCHEMA_VERSION,
            "updatedAt": datetime.now(timezone.utc),
        }
        metadata.update({key: state.get(key, DEFAULT_SEQUENCE_VALUES[key]) for key in SEQUENCE_KEYS})
        db[MONGO_META_COLLECTION].replace_one({"_id": MONGO_META_ID}, metadata, upsert=True)

    def read(self) -> dict[str, Any]:
        with self._lock:
            db = self._get_db()
            metadata = db[MONGO_META_COLLECTION].find_one({"_id": MONGO_META_ID}) or {}
            state = {key: metadata.get(key, DEFAULT_SEQUENCE_VALUES[key]) for key in SEQUENCE_KEYS}
            for collection_name in STATE_COLLECTION_KEYS:
                documents = []
                for document in db[collection_name].find({}, {"_id": 0}).sort("_order", 1):
                    document.pop("_order", None)
                    documents.append(document)
                state[collection_name] = documents
            return state

    def write(self, state: dict[str, Any]) -> None:
        with self._lock:
            self._replace_state(self._get_db(), state)
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
