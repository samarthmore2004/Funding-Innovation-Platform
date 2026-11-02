"""Innovation project serialisation, access control helpers and portfolio analytics."""
from __future__ import annotations

from collections import defaultdict

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core import taxonomy
from app.core.deps import is_manager
from app.models import InnovationProject, User
from app.schemas.common import iso_utc
from app.services import scoring

STAGES = list(taxonomy.PROJECT_STAGES)


def to_out(p: InnovationProject) -> dict:
    return {
        "id": p.id, "owner_id": p.owner_id, "owner_name": p.owner.full_name if p.owner else None,
        "title": p.title, "description": p.description, "domain": p.domain, "keywords": p.keywords or [],
        "stage": p.stage, "trl": p.trl, "market_size": p.market_size, "target_market": p.target_market,
        "patents_filed": p.patents_filed, "patents_granted": p.patents_granted, "team_size": p.team_size,
        "has_industry_partner": p.has_industry_partner, "latest_score": scoring.to_out(p.latest_score),
        "created_at": iso_utc(p.created_at), "updated_at": iso_utc(p.updated_at),
    }


def visible_projects(db: Session, user: User, scope: str = "mine") -> list[InnovationProject]:
    stmt = select(InnovationProject).options(selectinload(InnovationProject.scores)).order_by(
        InnovationProject.updated_at.desc())
    if not (scope == "all" and is_manager(user)):
        stmt = stmt.where(InnovationProject.owner_id == user.id)
    return list(db.execute(stmt).unique().scalars().all())


def get_project(db: Session, project_id: int, user: User, write: bool = False, stage_change: bool = False) -> InnovationProject:
    project = db.get(InnovationProject, project_id)
    if project is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found")
    owner = project.owner_id == user.id
    if write and not (owner or user.role == "admin" or (stage_change and is_manager(user))):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You cannot modify this project")
    if not write and not (owner or is_manager(user)):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You cannot view this project")
    return project


def portfolio(db: Session, user: User) -> dict:
    projects = visible_projects(db, user, "all" if is_manager(user) else "mine")
    scored = [p for p in projects if p.latest_score]
    by_stage = []
    pipeline: dict[str, list] = {s: [] for s in STAGES}
    for s in STAGES:
        items = [p for p in projects if p.stage == s]
        vals = [p.latest_score.overall for p in items if p.latest_score]
        by_stage.append({"stage": s, "label": taxonomy.PROJECT_STAGES[s], "count": len(items),
                         "avg_score": round(sum(vals) / len(vals), 1) if vals else None})
    for p in projects:
        pipeline.setdefault(p.stage, []).append(to_out(p))
    dom: dict[str, list] = defaultdict(list)
    for p in projects:
        dom[p.domain or "unclassified"].append(p.latest_score.overall if p.latest_score else None)
    by_domain = []
    for d, vals in sorted(dom.items(), key=lambda kv: -len(kv[1])):
        nums = [v for v in vals if v is not None]
        by_domain.append({"domain": d, "name": taxonomy.area_name(d), "count": len(vals),
                          "avg_score": round(sum(nums) / len(nums), 1) if nums else None})
    buckets = [("0-39", 0, 40), ("40-59", 40, 60), ("60-74", 60, 75), ("75-100", 75, 101)]
    dist = [{"bucket": b, "count": sum(1 for p in scored if lo <= p.latest_score.overall < hi)} for b, lo, hi in buckets]
    top = sorted(scored, key=lambda p: -p.latest_score.overall)[:5]
    all_scores = [p.latest_score.overall for p in scored]
    return {
        "projects_count": len(projects), "scored_count": len(scored),
        "avg_score": round(sum(all_scores) / len(all_scores), 1) if all_scores else None,
        "by_stage": by_stage, "by_domain": by_domain, "score_distribution": dist,
        "top_projects": [to_out(p) for p in top], "pipeline": pipeline,
    }
