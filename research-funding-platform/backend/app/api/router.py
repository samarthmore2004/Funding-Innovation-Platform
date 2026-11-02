from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.routes import admin, auth, engagement, funding, innovation, intelligence, profile, users
from app.core.config import get_settings
from app.db.session import get_db

api_router = APIRouter()


@api_router.get("/health", tags=["System"])
def health(db: Session = Depends(get_db)) -> dict:
    try:
        db.execute(text("SELECT 1"))
        database = "ok"
    except Exception:  # noqa: BLE001
        database = "unavailable"
    return {"status": "ok" if database == "ok" else "degraded", "database": database,
            "version": get_settings().app_version, "time": datetime.now(timezone.utc).isoformat()}


for r in (auth.router, users.router, profile.router, funding.router, intelligence.recommendations,
          intelligence.research, intelligence.patents, intelligence.technology, innovation.router,
          innovation.commercial, engagement.dashboard, engagement.notifications, engagement.reports_router,
          admin.router):
    api_router.include_router(r)
