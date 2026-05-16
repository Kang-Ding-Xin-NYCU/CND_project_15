"""FastAPI app factory.

The application is organised in layers:

  routes/     -- HTTP concerns (path, method, body parsing, auth, status codes)
  services/   -- Business logic, status-transition rules, audit writes
  domain.py   -- Pure helpers (entity lookup, audit append, status assertions)
  store.py    -- Repository (JSON / MongoDB) with a single update(mutator) API
  cache.py    -- Redis abstraction (session + state/dashboard cache)

`main.py` only wires these together and registers global middleware / handlers.
"""

from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from .auth import authenticate_header
from .cache import create_redis_cache
from .config import (
    DEFAULT_DATA_FILE,
    DEFAULT_PORT,
    HTTPS_ENABLED,
    MONGO_DB_NAME,
    MONGO_URL,
    REDIS_URL,
    TLS_CERT_FILE,
    TLS_KEY_FILE,
)
from .errors import ApiError
from .http_utils import json_error
from .routes import register_routers
from .store import create_store


def create_app(store: Any | None = None) -> FastAPI:
    app = FastAPI(title="Cloud LIMS Backend", version="1.0.0")
    app.state.store = store or create_store(
        DEFAULT_DATA_FILE,
        cache=create_redis_cache(REDIS_URL),
        mongo_url=MONGO_URL,
        db_name=MONGO_DB_NAME,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "Authorization"],
    )

    @app.exception_handler(ApiError)
    async def api_error_handler(_: Request, exc: ApiError) -> JSONResponse:
        return json_error(exc.message, exc.status_code)

    @app.exception_handler(StarletteHTTPException)
    async def http_error_handler(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        return json_error(str(exc.detail), exc.status_code)

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
        return json_error(str(exc), 422)

    @app.exception_handler(Exception)
    async def generic_error_handler(_: Request, exc: Exception) -> JSONResponse:
        return json_error(str(exc) or "Internal server error", 500)

    @app.middleware("http")
    async def authenticate_api_requests(request: Request, call_next: Any) -> JSONResponse:
        path = request.url.path
        public_route = (request.method == "GET" and path == "/api/health") or (
            request.method == "POST" and path == "/api/auth/login"
        )
        if path.startswith("/api/") and request.method != "OPTIONS" and not public_route:
            try:
                request.state.user = authenticate_header(
                    request.headers.get("authorization"),
                    request.app.state.store.cache,
                )
            except ApiError as exc:
                return json_error(exc.message, exc.status_code)
        return await call_next(request)

    register_routers(app)
    return app


app = create_app()


def run() -> None:
    import uvicorn

    ssl_options = {}
    if HTTPS_ENABLED:
        if not TLS_KEY_FILE or not TLS_CERT_FILE:
            raise RuntimeError("HTTPS requires TLS_KEY_FILE and TLS_CERT_FILE")
        ssl_options = {"ssl_keyfile": TLS_KEY_FILE, "ssl_certfile": TLS_CERT_FILE}
    uvicorn.run("app.main:app", host="0.0.0.0", port=DEFAULT_PORT, **ssl_options)


if __name__ == "__main__":
    run()
