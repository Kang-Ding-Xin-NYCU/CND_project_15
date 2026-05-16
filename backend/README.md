# FastAPI Backend

The active backend implementation is in `backend/app`.

## Environment versions

| Item | Version |
| --- | --- |
| WSL Python | `3.12.11` |
| Backend runtime | `Python 3.12` |
| FastAPI | `>=0.115,<1.0` |
| Uvicorn | `>=0.30,<1.0` |
| PyMongo | `>=4.6,<5` |
| pytest | `>=8,<9` |
| httpx | `>=0.27,<1` |
| Docker image | `python:3.12-slim` |

## Local WSL setup

```bash
python3 -m venv ../.venv
../.venv/bin/python -m pip install -r requirements.txt
../.venv/bin/python -m pytest tests
```

After creating the root `.venv`, the backend npm scripts also work without any `wsl` wrapper:

```bash
npm test
npm start
```

## Run locally

From `backend/`:

```bash
../.venv/bin/python -m app.main
```

By default this starts HTTP on port `3000`. Docker Compose still sets `HTTPS=true`, `PORT=3443`, MongoDB, Redis, and TLS file paths for the containerized deployment.

## Database storage

When `MONGO_URL` is set, the backend uses MongoDB through PyMongo. The state is stored across `users`, `requests`, `equipment`, `recipes`, `jobs`, `results`, `alarms`, and `audit` collections, with counters and schema metadata in `app_meta`.

If MongoDB is not configured, the backend uses the JSON fallback file from `DATA_FILE`. Existing legacy MongoDB data in the old `app_state` document is migrated automatically on first startup.
