# FastAPI Backend

The active backend implementation is in `backend/app`.

## Local WSL setup

```bash
python3 -m venv ../.venv
../.venv/bin/python -m pip install -r requirements.txt
../.venv/bin/python -m pytest tests
```

## Run locally

From `backend/`:

```bash
../.venv/bin/python -m app.main
```

By default this starts HTTP on port `3000`. Docker Compose still sets `HTTPS=true`, `PORT=3443`, MongoDB, Redis, and TLS file paths for the containerized deployment.

