"""FastAPI application entry point: `uvicorn app.main:app --reload` (from the backend folder)."""
from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import OperationalError

from app.api.router import api_router
from app.core.config import INSECURE_DEFAULT_SECRET, get_settings
from app.core.monitoring import RequestMetricsMiddleware
from app.services import jobs

settings = get_settings()
logging.basicConfig(level=getattr(logging, settings.log_level.upper(), logging.INFO),
                    format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("rfip")


@asynccontextmanager
async def lifespan(app: FastAPI):
    weak_secret = (settings.secret_key in (INSECURE_DEFAULT_SECRET, "replace-with-a-long-random-string")
                   or len(settings.secret_key) < 32)
    if weak_secret:
        if settings.environment == "production":
            raise RuntimeError("SECRET_KEY must be set to a strong random value (32+ chars) in production")
        logger.warning("Using a weak/default SECRET_KEY; set SECRET_KEY in .env for any shared deployment")
    stop = asyncio.Event()
    task = None
    if settings.enable_scheduler and settings.environment != "test":
        task = asyncio.create_task(jobs.scheduler_loop(stop))
        logger.info("Background scheduler started (alerts every %s min)", settings.alerts_interval_minutes)
    yield
    stop.set()
    if task:
        await task


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="REST API for funding discovery, research/patent/technology intelligence, weighted innovation "
                "scoring, commercialization recommendations, alerts, reports and administration. "
                "Use **Authorize** with a platform account (OAuth2 password flow) to try protected endpoints.",
    lifespan=lifespan,
)

app.add_middleware(RequestMetricsMiddleware)
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origin_list, allow_credentials=True,
                   allow_methods=["*"], allow_headers=["*"], expose_headers=["Content-Disposition"])
app.include_router(api_router, prefix="/api")


@app.exception_handler(OperationalError)
async def database_unavailable(request: Request, exc: OperationalError) -> JSONResponse:
    logger.error("Database error on %s: %s", request.url.path, exc)
    return JSONResponse(status_code=503, content={"detail": "Database unavailable. Check DATABASE_URL and that "
                                                            "migrations have been applied (alembic upgrade head)."})


@app.exception_handler(Exception)
async def unhandled(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Internal server error. The error has been logged."})


@app.get("/", include_in_schema=False)
def root() -> dict:
    return {"name": settings.app_name, "version": settings.app_version, "docs": "/docs", "health": "/api/health"}
