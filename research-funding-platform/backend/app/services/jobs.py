"""Background jobs (alert generation, optional Grants.gov sync) with run history in the job_runs table.

A lightweight asyncio loop started from the FastAPI lifespan runs due jobs; administrators can also trigger
jobs on demand. For multi-instance deployments run the scheduler in a single dedicated instance
(ENABLE_SCHEDULER=false elsewhere).
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.base import utcnow
from app.db.session import SessionLocal
from app.models import JobRun, User
from app.services import alerts, data_import

logger = logging.getLogger("rfip.jobs")


def job_definitions() -> dict[str, dict]:
    s = get_settings()
    return {
        "alerts": {"interval_minutes": s.alerts_interval_minutes, "enabled": True,
                   "description": "Generate funding, deadline, patent, technology and trend alerts for all users"},
        "grantsgov_sync": {"interval_minutes": s.grantsgov_sync_interval_minutes, "enabled": s.grantsgov_sync_enabled,
                           "description": "Refresh verified opportunities from the Grants.gov public API"},
    }


def run_job(db: Session, name: str, trigger: str = "manual", user: User | None = None) -> JobRun:
    if name not in job_definitions():
        raise KeyError(name)
    run = JobRun(name=name, status="running", trigger=trigger, started_at=utcnow())
    db.add(run)
    db.commit()
    try:
        if name == "alerts":
            result = alerts.generate_all(db)
            run.detail = f"{result['created']} notification(s) for {result['users']} user(s): {result['by_type']}"
            run.status = "success"
        else:
            imp = data_import.sync_grantsgov(db, None, 8, user)
            run.status = "success" if imp.status == "completed" else "failed"
            run.detail = f"{imp.rows_imported} record(s) upserted" if imp.status == "completed" else "; ".join(imp.errors)
    except Exception as exc:  # noqa: BLE001 - job failures are recorded, not raised
        db.rollback()
        logger.exception("job %s failed", name)
        run.status, run.detail = "failed", str(exc)[:1000]
    run.finished_at = utcnow()
    db.add(run)
    db.commit()
    db.refresh(run)
    return run


def job_status(db: Session) -> list[dict]:
    out = []
    for name, d in job_definitions().items():
        last = db.execute(select(JobRun).where(JobRun.name == name).order_by(JobRun.started_at.desc()).limit(1)
                          ).scalar_one_or_none()
        out.append({"name": name, "description": d["description"], "enabled": d["enabled"],
                    "interval_minutes": d["interval_minutes"],
                    "last_run_at": last.started_at.isoformat() + "Z" if last else None,
                    "last_status": last.status if last else None, "last_detail": last.detail if last else None})
    return out


def _due(db: Session, name: str, interval: int) -> bool:
    last = db.execute(select(JobRun.started_at).where(JobRun.name == name).order_by(JobRun.started_at.desc()).limit(1)
                      ).scalar_one_or_none()
    return last is None or utcnow() - last >= timedelta(minutes=interval)


def _tick() -> None:
    db = SessionLocal()
    try:
        for name, d in job_definitions().items():
            if d["enabled"] and _due(db, name, d["interval_minutes"]):
                logger.info("running scheduled job %s", name)
                run_job(db, name, trigger="schedule")
    finally:
        db.close()


async def scheduler_loop(stop: asyncio.Event, first_delay: float = 30.0, poll_seconds: float = 60.0) -> None:
    try:
        await asyncio.wait_for(stop.wait(), timeout=first_delay)
        return
    except asyncio.TimeoutError:
        pass
    while not stop.is_set():
        try:
            await asyncio.to_thread(_tick)
        except Exception:  # noqa: BLE001
            logger.exception("scheduler tick failed")
        try:
            await asyncio.wait_for(stop.wait(), timeout=poll_seconds)
        except asyncio.TimeoutError:
            continue


def started_at() -> datetime:
    return utcnow()
