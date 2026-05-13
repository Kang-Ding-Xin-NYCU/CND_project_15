import copy
import sys
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.cache import NoopCache
from app.seed import create_initial_state
from app.store import LEGACY_STATE_COLLECTION, MONGO_META_COLLECTION, MONGO_META_ID, MongoStore


class FakeCursor(list):
    def sort(self, key: str, direction: int) -> "FakeCursor":
        return FakeCursor(sorted(self, key=lambda item: item.get(key, 0), reverse=direction < 0))


class FakeCollection:
    def __init__(self) -> None:
        self.documents: list[dict[str, Any]] = []
        self.indexes: list[tuple[Any, bool]] = []

    def create_index(self, spec: Any, unique: bool = False) -> None:
        self.indexes.append((spec, unique))

    def delete_many(self, filter_: dict[str, Any]) -> None:
        if filter_ != {}:
            raise AssertionError("FakeCollection only supports full deletes")
        self.documents = []

    def insert_many(self, documents: list[dict[str, Any]]) -> None:
        self.documents.extend(copy.deepcopy(documents))

    def replace_one(self, filter_: dict[str, Any], document: dict[str, Any], upsert: bool = False) -> None:
        for index, current in enumerate(self.documents):
            if self._matches(current, filter_):
                self.documents[index] = copy.deepcopy(document)
                return
        if upsert:
            self.documents.append(copy.deepcopy(document))

    def find_one(self, filter_: dict[str, Any]) -> dict[str, Any] | None:
        for document in self.documents:
            if self._matches(document, filter_):
                return copy.deepcopy(document)
        return None

    def find(self, filter_: dict[str, Any], projection: dict[str, int] | None = None) -> FakeCursor:
        documents = []
        for document in self.documents:
            if not self._matches(document, filter_):
                continue
            projected = copy.deepcopy(document)
            if projection and projection.get("_id") == 0:
                projected.pop("_id", None)
            documents.append(projected)
        return FakeCursor(documents)

    def _matches(self, document: dict[str, Any], filter_: dict[str, Any]) -> bool:
        return all(document.get(key) == value for key, value in filter_.items())


class FakeDb(dict):
    def __getitem__(self, collection_name: str) -> FakeCollection:
        if collection_name not in self:
            self[collection_name] = FakeCollection()
        return dict.__getitem__(self, collection_name)


def make_mongo_store(db: FakeDb, ready: bool = True) -> MongoStore:
    store = MongoStore("mongodb://fake:27017", cache=NoopCache())
    store._db = db
    store._ready = ready
    return store


def test_mongo_store_writes_state_to_entity_collections():
    db = FakeDb()
    store = make_mongo_store(db)
    state = create_initial_state()

    store.write(state)

    assert db["requests"].documents[0]["_id"] == "REQ-2026-001"
    assert db["equipment"].documents[0]["_id"] == "EQ-SEM-01"
    assert db[MONGO_META_COLLECTION].find_one({"_id": MONGO_META_ID})["requestSeq"] == state["requestSeq"]
    assert store.read() == state


def test_mongo_store_migrates_legacy_single_document_state():
    db = FakeDb()
    state = create_initial_state()
    db[LEGACY_STATE_COLLECTION].insert_many([{"_id": "lims-state", "state": state}])
    store = make_mongo_store(db, ready=False)

    assert store.read() == state
    assert db["requests"].documents[0]["_id"] == "REQ-2026-001"
    assert db[MONGO_META_COLLECTION].find_one({"_id": MONGO_META_ID})["schemaVersion"] == 2

