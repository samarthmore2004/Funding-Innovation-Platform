"""Funding opportunity discovery: search, filters, details with eligibility, tracking and curation."""
from __future__ import annotations

from collections import Counter
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy import String, cast, func, or_, select
from sqlalchemy.orm import Session

from app.core import taxonomy
from app.core.deps import client_ip, get_current_user, require_roles
from app.db.session import get_db
from app.models import FundingOpportunity, RecommendationFeedback, SavedFunding, User
from app.schemas.common import paginate_meta
from app.schemas.funding import FundingIn, FundingOut, SaveIn, SavedOut, SavedUpdate
from app.services import audit, recommender

router = APIRouter(prefix="/funding", tags=["Funding discovery"])
ACTIVE = recommender.ACTIVE_STATUSES


def _json_contains(column, value: str):
    # JSON list membership that works on SQLite and PostgreSQL (lists are stored as JSON text arrays).
    safe = value.replace("%", "").replace("_", r"\_").replace('"', "")
    return cast(column, String).like(f'%"{safe}"%', escape="\\")


@router.get("")
def search_funding(
    q: str | None = None, funder_type: str | None = None, domain: str | None = None, country: str | None = None,
    status_: str | None = Query(default=None, alias="status"), record_type: str | None = None,
    applicant_type: str | None = None, deadline_after: date | None = None, deadline_before: date | None = None,
    min_amount: float | None = None, include_closed: bool = False,
    sort: str = Query(default="deadline", pattern="^(deadline|amount|newest|title|relevance)$"),
    page: int = Query(default=1, ge=1), page_size: int = Query(default=12, ge=1, le=100),
    user: User = Depends(get_current_user), db: Session = Depends(get_db),
) -> dict:
    stmt = select(FundingOpportunity)
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(or_(FundingOpportunity.title.ilike(like), FundingOpportunity.description.ilike(like),
                              FundingOpportunity.organization.ilike(like)))
    if funder_type:
        stmt = stmt.where(FundingOpportunity.funder_type == funder_type)
    if domain:
        stmt = stmt.where(_json_contains(FundingOpportunity.domains, domain))
    if country:
        stmt = stmt.where(or_(_json_contains(FundingOpportunity.eligible_countries, country),
                              _json_contains(FundingOpportunity.eligible_countries, "Global")))
    if applicant_type:
        stmt = stmt.where(_json_contains(FundingOpportunity.applicant_types, applicant_type))
    if status_:
        stmt = stmt.where(FundingOpportunity.status == status_)
    elif not include_closed:
        stmt = stmt.where(FundingOpportunity.status.in_(ACTIVE))
    if record_type:
        stmt = stmt.where(FundingOpportunity.record_type == record_type)
    if deadline_after:
        stmt = stmt.where(FundingOpportunity.deadline >= deadline_after)
    if deadline_before:
        stmt = stmt.where(FundingOpportunity.deadline <= deadline_before)
    if min_amount is not None:
        stmt = stmt.where(FundingOpportunity.max_amount >= min_amount)

    if sort == "relevance":
        rows = db.execute(stmt).scalars().all()
        text, domains, ctx, _, _ = recommender.user_inputs(db, user)
        scores = {s["funding"].id: s["match_score"] for s in recommender.score_text(db, text, domains, ctx, include_closed=True)}
        rows.sort(key=lambda f: -scores.get(f.id, 0))
        total = len(rows)
        rows = rows[(page - 1) * page_size: page * page_size]
    else:
        order = {
            "deadline": (FundingOpportunity.deadline.asc().nulls_last(),),
            "amount": (FundingOpportunity.max_amount.desc().nulls_last(),),
            "newest": (FundingOpportunity.created_at.desc(),),
            "title": (FundingOpportunity.title.asc(),),
        }[sort]
        total = db.execute(select(func.count()).select_from(stmt.subquery())).scalar_one()
        rows = db.execute(stmt.order_by(*order, FundingOpportunity.id).offset((page - 1) * page_size)
                          .limit(page_size)).scalars().all()
    today = date.today()
    return {"items": [FundingOut.from_model(f, today).model_dump(mode="json") for f in rows],
            **paginate_meta(total, page, page_size)}


@router.get("/facets")
def facets(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    items = db.execute(select(FundingOpportunity).where(FundingOpportunity.status.in_(ACTIVE))).scalars().all()
    types = Counter(f.funder_type for f in items)
    domains = Counter(d for f in items for d in (f.domains or []))
    countries = Counter(c for f in items for c in (f.eligible_countries or []))
    return {
        "funder_types": [{"value": k, "label": taxonomy.FUNDER_TYPES.get(k, k), "count": types.get(k, 0)}
                         for k in taxonomy.FUNDER_TYPES],
        "domains": [{"value": k, "label": taxonomy.area_name(k), "count": c} for k, c in domains.most_common()],
        "countries": [{"value": k, "count": c} for k, c in countries.most_common()],
        "statuses": [{"value": k, "count": c} for k, c in Counter(f.status for f in items).most_common()],
        "record_types": [{"value": k, "count": c} for k, c in Counter(f.record_type for f in items).most_common()],
        "applicant_types": [{"value": k, "label": v} for k, v in taxonomy.APPLICANT_TYPES.items()],
    }


@router.get("/saved", response_model=list[SavedOut])
def list_saved(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[SavedOut]:
    rows = db.execute(select(SavedFunding).where(SavedFunding.user_id == user.id)
                      .order_by(SavedFunding.updated_at.desc())).scalars().all()
    return [SavedOut.from_model(s) for s in rows]


@router.patch("/saved/{saved_id}", response_model=SavedOut)
def update_saved(saved_id: int, payload: SavedUpdate, user: User = Depends(get_current_user),
                 db: Session = Depends(get_db)) -> SavedOut:
    saved = db.get(SavedFunding, saved_id)
    if saved is None or saved.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Tracked opportunity not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(saved, k, v)
    db.commit()
    db.refresh(saved)
    return SavedOut.from_model(saved)


def _get(db: Session, funding_id: int) -> FundingOpportunity:
    item = db.get(FundingOpportunity, funding_id)
    if item is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Funding opportunity not found")
    return item


@router.get("/{funding_id}")
def get_funding(funding_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    item = _get(db, funding_id)
    elig, match = recommender.match_single(db, user, item)
    saved = db.execute(select(SavedFunding).where(SavedFunding.user_id == user.id,
                                                  SavedFunding.funding_id == item.id)).scalar_one_or_none()
    return {**FundingOut.from_model(item).model_dump(mode="json"), "eligibility": elig, "match": match,
            "saved": SavedOut.from_model(saved).model_dump(mode="json") if saved else None,
            "funder_type_label": taxonomy.FUNDER_TYPES.get(item.funder_type, item.funder_type),
            "domain_labels": [taxonomy.area_name(d) for d in item.domains or []]}


@router.post("/{funding_id}/save", response_model=SavedOut)
def save_funding(funding_id: int, payload: SaveIn | None = None, user: User = Depends(get_current_user),
                 db: Session = Depends(get_db)) -> SavedOut:
    item = _get(db, funding_id)
    payload = payload or SaveIn()
    saved = db.execute(select(SavedFunding).where(SavedFunding.user_id == user.id,
                                                  SavedFunding.funding_id == item.id)).scalar_one_or_none()
    if saved is None:
        saved = SavedFunding(user_id=user.id, funding_id=item.id, status=payload.status, notes=payload.notes)
        db.add(saved)
        db.add(RecommendationFeedback(user_id=user.id, funding_id=item.id, action="saved"))
    else:
        saved.status = payload.status
        if payload.notes is not None:
            saved.notes = payload.notes
    db.commit()
    db.refresh(saved)
    return SavedOut.from_model(saved)


@router.delete("/{funding_id}/save", status_code=204)
def unsave_funding(funding_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> Response:
    saved = db.execute(select(SavedFunding).where(SavedFunding.user_id == user.id,
                                                  SavedFunding.funding_id == funding_id)).scalar_one_or_none()
    if saved:
        db.delete(saved)
        db.commit()
    return Response(status_code=204)


@router.post("", response_model=FundingOut, status_code=201)
def create_funding(payload: FundingIn, request: Request,
                   user: User = Depends(require_roles("innovation_manager", "admin")),
                   db: Session = Depends(get_db)) -> FundingOut:
    item = FundingOpportunity(**payload.model_dump(), record_type="internal", created_by_id=user.id)
    if not item.source_name:
        item.source_name = f"Internal call ({user.organization or 'platform'})"
    db.add(item)
    db.commit()
    db.refresh(item)
    recommender.funding_index.invalidate()
    audit.record(db, "funding.created", user, entity_type="funding", entity_id=item.id, ip=client_ip(request))
    return FundingOut.from_model(item)


@router.put("/{funding_id}", response_model=FundingOut)
def update_funding(funding_id: int, payload: FundingIn, request: Request,
                   user: User = Depends(require_roles("innovation_manager", "admin")),
                   db: Session = Depends(get_db)) -> FundingOut:
    item = _get(db, funding_id)
    if item.record_type == "verified" and user.role != "admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Verified records can only be edited by administrators")
    for k, v in payload.model_dump().items():
        setattr(item, k, v)
    if item.record_type == "verified":
        item.record_type = "internal"  # edited copies are no longer verbatim official data
        item.verified_at = None
    db.commit()
    db.refresh(item)
    recommender.funding_index.invalidate()
    audit.record(db, "funding.updated", user, entity_type="funding", entity_id=item.id, ip=client_ip(request))
    return FundingOut.from_model(item)


@router.delete("/{funding_id}", status_code=204)
def delete_funding(funding_id: int, request: Request, user: User = Depends(require_roles("admin")),
                   db: Session = Depends(get_db)) -> Response:
    item = _get(db, funding_id)
    db.delete(item)
    db.commit()
    recommender.funding_index.invalidate()
    audit.record(db, "funding.deleted", user, entity_type="funding", entity_id=funding_id, ip=client_ip(request))
    return Response(status_code=204)
