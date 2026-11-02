#!/bin/sh
# Wait for the database, apply migrations, seed (idempotent) and start the API.
set -e

python - <<'PY'
import time, sys
from sqlalchemy import create_engine, text
from app.core.config import get_settings
url = get_settings().database_url
for attempt in range(30):
    try:
        with create_engine(url).connect() as conn:
            conn.execute(text("SELECT 1"))
        print("database is reachable")
        sys.exit(0)
    except Exception as exc:  # noqa: BLE001
        print(f"waiting for database ({attempt + 1}/30): {exc.__class__.__name__}")
        time.sleep(2)
sys.exit("database not reachable")
PY

alembic upgrade head

if [ "${SEED_ON_STARTUP:-true}" = "true" ]; then
  python -m app.seed.seed
fi

exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --proxy-headers --forwarded-allow-ips="*" --workers "${UVICORN_WORKERS:-1}"
