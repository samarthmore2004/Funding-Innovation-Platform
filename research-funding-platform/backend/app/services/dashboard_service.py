"""Role-based dashboard payloads (researcher, startup founder, innovation manager, administrator)."""
from __future__ import annotations

from collections import Counter, defaultdict
from datetime import date

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core import taxonomy
from app.models import FundingOpportunity, Notification, Patent, ResearchProfile, SavedFunding, User
from app.schemas.funding import FundingOut
from app.schemas.profile import PatentOut
from app.schemas.user import UserOut
from app.services import (admin_service, commercialization, innovation_service, patent_analytics, recommender,
                          research_analytics, technology_intel)

VIEW_FOR_ROLE = {"researcher": "researcher", "startup_founder": "startup", "innovation_manager": "manager",
                 "admin": "admin"}
STARTUP_FUNDERS = {"startup_accelerator", "venture_program", "innovation_fund"}


def _interests(db: Session, user: User) -> list[str]:
    profile = db.execute(select(ResearchProfile).where(ResearchProfile.user_id == user.id)).scalar_one_or_none()
    if not profile:
        return []
    return list(dict.fromkeys((profile.research_domains or []) + (profile.technology_areas or [])))


def _upcoming(db: Session, user: User, limit: int = 6) -> list[dict]:
    today = date.today()
    saved = db.execute(select(SavedFunding).where(SavedFunding.user_id == user.id)).scalars().all()
    items = [s.funding for s in saved if s.funding.deadline and s.funding.deadline >= today]
    items.sort(key=lambda f: f.deadline)
    return [FundingOut.from_model(f).model_dump(mode="json") for f in items[:limit]]


def _recent_patents(db: Session, domains: list[str], limit: int = 5) -> list[dict]:
    stmt = select(Patent).where(Patent.owner_id.is_(None))
    if domains:
        stmt = stmt.where(Patent.technology_domain.in_(domains))
    rows = db.execute(stmt.order_by(Patent.filing_date.desc().nulls_last()).limit(limit)).scalars().all()
    return [PatentOut.from_model(p).model_dump(mode="json") for p in rows]


def _unread(db: Session, user: User) -> int:
    return db.execute(select(func.count(Notification.id)).where(Notification.user_id == user.id,
                                                                Notification.is_read.is_(False))).scalar_one()


def researcher(db: Session, user: User) -> dict:
    interests = _interests(db, user)
    recs = recommender.recommend(db, user, limit=5)
    pubs = research_analytics.my_analytics(db, user)
    projects = innovation_service.visible_projects(db, user)
    scores = [p.latest_score.overall for p in projects if p.latest_score]
    trends = research_analytics.trends(db, interests[:4] or None, None, None)
    assignee_items = []
    for d in interests[:2]:
        assignee_items += patent_analytics.assignees(db, d, 3)["items"]
    return {
        "kpis": [
            {"key": "matches", "label": "Funding matches", "value": len(recs["items"]),
             "hint": f"Profile {recs['profile_completeness']}% complete"},
            {"key": "publications", "label": "Publications", "value": pubs["total_publications"],
             "hint": f"h-index {pubs['h_index']}"},
            {"key": "citations", "label": "Citations", "value": pubs["total_citations"]},
            {"key": "innovation", "label": "Avg innovation score",
             "value": round(sum(scores) / len(scores), 1) if scores else None, "hint": f"{len(projects)} project(s)"},
            {"key": "unread", "label": "Unread alerts", "value": _unread(db, user)},
        ],
        "recommendations": recs["items"], "recommendation_notes": recs["notes"],
        "research_trends": trends, "publication_analytics": pubs,
        "patent_insights": {"top_assignees": assignee_items[:5], "recent_patents": _recent_patents(db, interests)},
        "innovation": {"projects": [innovation_service.to_out(p) for p in projects[:5]],
                       "avg_score": round(sum(scores) / len(scores), 1) if scores else None},
        "upcoming_deadlines": _upcoming(db, user),
    }


def startup(db: Session, user: User) -> dict:
    interests = _interests(db, user)
    all_recs = recommender.recommend(db, user, limit=40)
    startup_recs = [r for r in all_recs["items"] if r["funding"]["funder_type"] in STARTUP_FUNDERS
                    or "startup" in r["funding"]["applicant_types"]][:6]
    opps = technology_intel.opportunities(db)["items"]
    if interests:
        opps = sorted(opps, key=lambda o: (o["key"] not in interests, -o["opportunity_score"]))
    competitors = []
    for d in interests[:2] or [None]:
        competitors += patent_analytics.assignees(db, d, 4)["items"]
    projects = innovation_service.visible_projects(db, user)
    overview = commercialization.overview(db, projects)["items"]
    return {
        "kpis": [
            {"key": "funding", "label": "Startup-eligible matches", "value": len(startup_recs)},
            {"key": "opportunities", "label": "Tech opportunities tracked", "value": len(opps)},
            {"key": "competitors", "label": "Competitors monitored", "value": len(competitors)},
            {"key": "projects", "label": "Ventures / projects", "value": len(projects)},
            {"key": "unread", "label": "Unread alerts", "value": _unread(db, user)},
        ],
        "funding_opportunities": startup_recs, "technology_opportunities": opps[:5],
        "patent_intelligence": {"competitors": competitors[:6], "recent_patents": _recent_patents(db, interests)},
        "commercialization": overview, "upcoming_deadlines": _upcoming(db, user),
    }


def funding_analytics(db: Session) -> dict:
    items = db.execute(select(FundingOpportunity)).scalars().all()
    by_type: dict[str, dict] = defaultdict(lambda: {"count": 0, "total_max_amount": 0.0})
    months: Counter = Counter()
    today = date.today()
    for f in items:
        t = by_type[f.funder_type]
        t["count"] += 1
        t["total_max_amount"] += f.max_amount or 0
        if f.deadline and f.deadline >= today and f.status != "closed":
            months[f.deadline.strftime("%Y-%m")] += 1
    return {
        "by_funder_type": [{"type": k, "label": taxonomy.FUNDER_TYPES.get(k, k), "count": v["count"],
                            "total_max_amount": round(v["total_max_amount"], 2)} for k, v in by_type.items()],
        "deadlines_by_month": [{"month": m, "count": c} for m, c in sorted(months.items())[:12]],
        "by_record_type": [{"value": k, "count": v} for k, v in Counter(f.record_type for f in items).items()],
        "by_status": [{"value": k, "count": v} for k, v in Counter(f.status for f in items).items()],
    }


def manager(db: Session, user: User) -> dict:
    port = innovation_service.portfolio(db, user)
    areas = sorted(technology_intel.list_areas(db)["items"], key=lambda a: -a["emerging_score"])
    fa = funding_analytics(db)
    active = sum(r["count"] for r in fa["by_status"] if r["value"] in ("open", "forecasted", "rolling"))
    return {
        "kpis": [
            {"key": "projects", "label": "Portfolio projects", "value": port["projects_count"]},
            {"key": "avg", "label": "Avg innovation score", "value": port["avg_score"]},
            {"key": "market_ready", "label": "Pilot / market-ready",
             "value": sum(s["count"] for s in port["by_stage"] if s["stage"] in ("pilot", "market_ready"))},
            {"key": "funding", "label": "Active funding calls", "value": active},
            {"key": "unread", "label": "Unread alerts", "value": _unread(db, user)},
        ],
        "portfolio": port, "technology_trends": areas[:6], "funding_analytics": fa,
    }


def admin(db: Session, user: User) -> dict:
    platform = admin_service.analytics(db)
    return {
        "kpis": [
            {"key": "users", "label": "Users", "value": platform["users_total"]},
            {"key": "active", "label": "Active (7 days)", "value": platform["active_users"]},
            {"key": "recs", "label": "Recommendations served", "value": platform["recommendations_served"]},
            {"key": "reports", "label": "Reports generated", "value": platform["reports_generated"]},
            {"key": "funding", "label": "Funding records", "value": platform["funding_total"]},
        ],
        "platform": platform, "recommendation_monitoring": admin_service.recommendation_monitoring(db),
        "system": admin_service.system_status(db),
    }


BUILDERS = {"researcher": researcher, "startup": startup, "manager": manager, "admin": admin}


def build(db: Session, user: User, view: str | None = None) -> dict:
    own = VIEW_FOR_ROLE.get(user.role, "researcher")
    if view and view != own:
        allowed = {"admin": {"researcher", "startup", "manager", "admin"},
                   "innovation_manager": {"researcher", "startup", "manager"}}.get(user.role, set())
        if view not in allowed:
            view = own
    view = view or own
    payload = BUILDERS[view](db, user)
    return {"view": view, "user": UserOut.from_user(user).model_dump(mode="json"), **payload}
