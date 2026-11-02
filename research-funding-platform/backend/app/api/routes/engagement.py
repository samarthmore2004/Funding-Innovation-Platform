"""Dashboards, notifications and reports."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.core.deps import client_ip, get_current_user
from app.db.session import get_db
from app.models import Notification, ReportRecord, User
from app.schemas.common import paginate_meta
from app.schemas.system import NotificationOut, ReportRecordOut
from app.services import alerts, audit, dashboard_service, reports

dashboard = APIRouter(prefix="/dashboard", tags=["Dashboards"])
notifications = APIRouter(prefix="/notifications", tags=["Notifications & alerts"])
reports_router = APIRouter(prefix="/reports", tags=["Reports & export"])


@dashboard.get("")
def get_dashboard(view: str | None = Query(None, pattern="^(researcher|startup|manager|admin)$"),
                  user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    return dashboard_service.build(db, user, view)


# ---------------------------------------------------------------- notifications
def _unread(db: Session, user: User) -> int:
    return db.execute(select(func.count(Notification.id)).where(Notification.user_id == user.id,
                                                                Notification.is_read.is_(False))).scalar_one()


@notifications.get("")
def list_notifications(unread_only: bool = False, type: str | None = None, page: int = Query(1, ge=1),
                       page_size: int = Query(20, ge=1, le=100), user: User = Depends(get_current_user),
                       db: Session = Depends(get_db)) -> dict:
    stmt = select(Notification).where(Notification.user_id == user.id)
    if unread_only:
        stmt = stmt.where(Notification.is_read.is_(False))
    if type:
        stmt = stmt.where(Notification.type == type)
    total = db.execute(select(func.count()).select_from(stmt.subquery())).scalar_one()
    rows = db.execute(stmt.order_by(Notification.created_at.desc(), Notification.id.desc())
                      .offset((page - 1) * page_size).limit(page_size)).scalars().all()
    return {"items": [NotificationOut.model_validate(n).model_dump(mode="json") for n in rows],
            "unread_count": _unread(db, user), **paginate_meta(total, page, page_size)}


@notifications.get("/unread-count")
def unread_count(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    return {"unread_count": _unread(db, user)}


@notifications.post("/read-all")
def read_all(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    result = db.execute(update(Notification).where(Notification.user_id == user.id, Notification.is_read.is_(False))
                        .values(is_read=True))
    db.commit()
    return {"updated": result.rowcount or 0}


@notifications.post("/refresh")
def refresh_alerts(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    return alerts.generate_for_user(db, user)


def _own_notification(db: Session, notification_id: int, user: User) -> Notification:
    n = db.get(Notification, notification_id)
    if n is None or n.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Notification not found")
    return n


@notifications.post("/{notification_id}/read", response_model=NotificationOut)
def mark_read(notification_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> NotificationOut:
    n = _own_notification(db, notification_id, user)
    n.is_read = True
    db.commit()
    db.refresh(n)
    return NotificationOut.model_validate(n)


@notifications.delete("/{notification_id}", status_code=204)
def delete_notification(notification_id: int, user: User = Depends(get_current_user),
                        db: Session = Depends(get_db)) -> Response:
    db.delete(_own_notification(db, notification_id, user))
    db.commit()
    return Response(status_code=204)


# ---------------------------------------------------------------- reports
@reports_router.get("/types")
def report_types(user: User = Depends(get_current_user)) -> list[dict]:
    return reports.types_payload()


@reports_router.get("/history", response_model=list[ReportRecordOut])
def report_history(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[ReportRecordOut]:
    rows = db.execute(select(ReportRecord).where(ReportRecord.user_id == user.id)
                      .order_by(ReportRecord.id.desc()).limit(50)).scalars()
    return [ReportRecordOut.model_validate(r) for r in rows]


@reports_router.get("/{report_type}/preview")
def report_preview(report_type: str, domain: str | None = None, project_id: int | None = None,
                   user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    return reports.preview(reports.build(db, user, report_type, domain, project_id))


@reports_router.get("/{report_type}/download")
def report_download(report_type: str, request: Request, format: str = Query("pdf", pattern="^(csv|xlsx|pdf)$"),
                    domain: str | None = None, project_id: int | None = None, user: User = Depends(get_current_user),
                    db: Session = Depends(get_db)) -> Response:
    data = reports.build(db, user, report_type, domain, project_id)
    content = reports.render(data, format)
    name = reports.filename(data, format)
    db.add(ReportRecord(user_id=user.id, report_type=report_type, format=format, filename=name,
                        row_count=int(len(data.frame))))
    db.commit()
    audit.record(db, "report.exported", user, entity_type="report", entity_id=report_type,
                 detail={"format": format, "rows": int(len(data.frame))}, ip=client_ip(request))
    return Response(content, media_type=reports.MEDIA_TYPES[format],
                    headers={"Content-Disposition": f'attachment; filename="{name}"',
                             "Access-Control-Expose-Headers": "Content-Disposition"})
