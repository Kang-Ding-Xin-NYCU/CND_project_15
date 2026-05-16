"""Router layer: HTTP concerns only (path/method, body parsing, auth, status codes).

Each module exposes a `router: APIRouter`. Routers delegate business logic to
the `app.services` package and never touch the store/cache directly except to
pass them through.
"""

from fastapi import FastAPI

from . import alarms, auth, equipment, health, jobs, recipes, requests, results, state


def register_routers(app: FastAPI) -> None:
    app.include_router(health.router)
    app.include_router(auth.router)
    app.include_router(state.router)
    app.include_router(requests.router)
    app.include_router(jobs.router)
    app.include_router(equipment.router)
    app.include_router(recipes.router)
    app.include_router(results.router)
    app.include_router(alarms.router)
