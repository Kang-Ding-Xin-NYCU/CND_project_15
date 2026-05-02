import os
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[1]

DEFAULT_DATA_FILE = os.getenv("DATA_FILE", str(ROOT_DIR / "data" / "lims-state.json"))
HTTPS_ENABLED = os.getenv("HTTPS") == "true"
DEFAULT_PORT = int(os.getenv("PORT") or (3443 if HTTPS_ENABLED else 3000))
JWT_SECRET = os.getenv("JWT_SECRET", "dev-lims-secret-change-me")
MONGO_URL = os.getenv("MONGO_URL", "")
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "cloud_lims")
REDIS_URL = os.getenv("REDIS_URL", "")
TLS_CERT_FILE = os.getenv("TLS_CERT_FILE", "")
TLS_KEY_FILE = os.getenv("TLS_KEY_FILE", "")

