"""Administration: users, platform analytics, recommendation monitoring, datasets, audit logs, system."""
from __future__ import annotations

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile, status
from fastapi.responses import Response
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.deps import client_ip, require_roles
from app.db.session import get_db
from app.models import AuditLog, InnovationProject, User
from app.schemas.common import paginate_meta
from app.schemas.funding import SyncGrantsIn, SyncOpenAlexIn
from app.schemas.system import AuditLogOut, BroadcastIn, ImportOut, JobRunOut
from app.schemas.user import AdminUserOut, AdminUserUpdate, UserOut
from app.services import admin_service, alerts, audit, data_import, jobs

router = APIRouter(prefix="/admin", tags=["Administration"])
admin_only = require_roles("admin")


@router.get("/users")
def list_users(q: str | None = None, role: str | None = None, is_active: bool | None = None,
               page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
               admin: User = Depends(admin_only), db: Session = Depends(get_db)) -> dict:
    stmt = select(User)
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(or_(User.email.ilike(like), User.full_name.ilike(like), User.organization.ilike(like)))
    if role:
        stmt = stmt.where(User.role == role)
    if is_active is not None:
        stmt = stmt.where(User.is_active.is_(is_active))
    total = db.execute(select(func.count()).select_from(stmt.subquery())).scalar_one()
    users = db.execute(stmt.order_by(User.created_at.desc()).offset((page - 1) * page_size).limit(page_size)).scalars().all()
    counts = dict(db.execute(select(InnovationProject.owner_id, func.count(InnovationProject.id))
                             .group_by(InnovationProject.owner_id)).all())
    items = [AdminUserOut(**UserOut.from_user(u).model_dump(), projects_count=counts.get(u.id, 0)).model_dump(mode="json")
             for u in users]
    return {"items": items, **paginate_meta(total, page, page_size)}


@router.patch("/users/{user_id}", response_model=UserOut)
def update_user(user_id: int, payload: AdminUserUpdate, request: Request, admin: User = Depends(admin_only),
                db: Session = Depends(get_db)) -> UserOut:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    changes = payload.model_dump(exclude_unset=True)
    if user.id == admin.id and (changes.get("role", "admin") != "admin" or changes.get("is_active") is False):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "You cannot demote or deactivate your own account")
    before = {"role": user.role, "is_active": user.is_active}
    for k, v in changes.items():
        if v is not None:
            setattr(user, k, v)
    db.commit()
    db.refresh(user)
    audit.record(db, "admin.user_updated", admin, entity_type="user", entity_id=user.id,
                 detail={"before": before, "after": {"role": user.role, "is_active": user.is_active}},
                 ip=client_ip(request))
    return UserOut.from_user(user)


@router.get("/analytics")
def analytics(admin: User = Depends(admin_only), db: Session = Depends(get_db)) -> dict:
    return admin_service.analytics(db)


@router.get("/recommendation-monitoring")
def recommendation_monitoring(admin: User = Depends(admin_only), db: Session = Depends(get_db)) -> dict:
    return admin_service.recommendation_monitoring(db)


@router.get("/datasets")
def datasets(admin: User = Depends(admin_only), db: Session = Depends(get_db)) -> dict:
    return admin_service.datasets(db)


@router.get("/datasets/{key}/template")
def dataset_template(key: str, admin: User = Depends(admin_only)) -> Response:
    if key not in data_import.TEMPLATES:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Unknown dataset")
    return Response(data_import.template_csv(key), media_type="text/csv",
                    headers={"Content-Disposition": f'attachment; filename="{key}-template.csv"'})


@router.post("/datasets/funding/sync-grantsgov", response_model=ImportOut)
def sync_grantsgov(request: Request, payload: SyncGrantsIn | None = None, admin: User = Depends(admin_only),
                   db: Session = Depends(get_db)) -> ImportOut:
    payload = payload or SyncGrantsIn()
    record = data_import.sync_grantsgov(db, payload.keywords, payload.limit_per_keyword, admin)
    audit.record(db, "dataset.sync_grantsgov", admin, entity_type="dataset", entity_id="funding",
                 detail={"status": record.status, "imported": record.rows_imported}, ip=client_ip(request))
    return ImportOut.model_validate(record)


@router.post("/datasets/publications/sync-openalex", response_model=ImportOut)
def sync_openalex(payload: SyncOpenAlexIn, request: Request, admin: User = Depends(admin_only),
                  db: Session = Depends(get_db)) -> ImportOut:
    record = data_import.sync_openalex(db, payload.query, payload.domain, payload.limit, admin)
    audit.record(db, "dataset.sync_openalex", admin, entity_type="dataset", entity_id="publications",
                 detail={"query": payload.query, "status": record.status}, ip=client_ip(request))
    return ImportOut.model_validate(record)


@router.post("/datasets/{key}/import", response_model=ImportOut)
async def import_dataset(key: str, request: Request, file: UploadFile = File(...), admin: User = Depends(admin_only),
                         db: Session = Depends(get_db)) -> ImportOut:
    if key not in data_import.TEMPLATES:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Unknown dataset")
    content = await file.read(data_import.MAX_UPLOAD_BYTES + 1)
    record = data_import.import_file(db, key, file.filename or "upload", content, admin)
    audit.record(db, "dataset.imported", admin, entity_type="dataset", entity_id=key,
                 detail={"file": file.filename, "status": record.status, "imported": record.rows_imported},
                 ip=client_ip(request))
    return ImportOut.model_validate(record)


@router.get("/audit-logs")
def audit_logs(action: str | None = None, q: str | None = None, page: int = Query(1, ge=1),
               page_size: int = Query(25, ge=1, le=100), admin: User = Depends(admin_only),
               db: Session = Depends(get_db)) -> dict:
    stmt = select(AuditLog)
    if action:
        stmt = stmt.where(AuditLog.action == action)
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(or_(AuditLog.user_email.ilike(like), AuditLog.detail.ilike(like), AuditLog.action.ilike(like)))
    total = db.execute(select(func.count()).select_from(stmt.subquery())).scalar_one()
    rows = db.execute(stmt.order_by(AuditLog.id.desc()).offset((page - 1) * page_size).limit(page_size)).scalars()
    actions = [a for (a,) in db.execute(select(AuditLog.action).distinct().order_by(AuditLog.action)).all()]
    return {"items": [AuditLogOut.model_validate(r).model_dump(mode="json") for r in rows], "actions": actions,
            **paginate_meta(total, page, page_size)}


@router.get("/system")
def system(admin: User = Depends(admin_only), db: Session = Depends(get_db)) -> dict:
    return admin_service.system_status(db)


@router.post("/jobs/{name}/run", response_model=JobRunOut)
def run_job(name: str, request: Request, admin: User = Depends(admin_only), db: Session = Depends(get_db)) -> JobRunOut:
    try:
        run = jobs.run_job(db, name, trigger="manual", user=admin)
    except KeyError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Unknown job") from None
    audit.record(db, "admin.job_run", admin, entity_type="job", entity_id=name, detail={"status": run.status},
                 ip=client_ip(request))
    return JobRunOut(name=run.name, status=run.status, detail=run.detail, started_at=run.started_at,
                     finished_at=run.finished_at)


@router.post("/notifications/broadcast")
def broadcast(payload: BroadcastIn, request: Request, admin: User = Depends(admin_only), db: Session = Depends(get_db)) -> dict:
    created = alerts.broadcast(db, payload.title, payload.message, payload.roles)
    audit.record(db, "admin.broadcast", admin, detail={"title": payload.title, "recipients": created},
                 ip=client_ip(request))
    return {"created": created}
