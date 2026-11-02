"""Administrator analytics: platform usage, recommendation monitoring, datasets and system status."""
from __future__ import annotations

from collections import Counter
from datetime import timedelta

from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.monitoring import metrics, uptime_seconds
from app.db.base import utcnow
from app.models import (AuditLog, DatasetImport, FundingOpportunity, InnovationProject, Notification, Patent,
                        Publication, RecommendationFeedback, RecommendationLog, ReportRecord, TrendPoint, User)
from app.schemas.system import ImportOut
from app.services import eligibility, jobs, recommender
from app.services.external import patentsview


def _by_day(db: Session, column, days: int = 30, where=None) -> list[dict]:
    since = utcnow() - timedelta(days=days)
    stmt = select(column).where(column >= since)
    if where is not None:
        stmt = stmt.where(where)
    counts = Counter(dt.date().isoformat() for dt in db.execute(stmt).scalars() if dt)
    start = since.date()
    return [{"date": (start + timedelta(days=i)).isoformat(), "count": counts.get((start + timedelta(days=i)).isoformat(), 0)}
            for i in range(days + 1)]


def analytics(db: Session) -> dict:
    roles = db.execute(select(User.role, func.count(User.id)).group_by(User.role)).all()
    week = utcnow() - timedelta(days=7)
    reports = db.execute(select(ReportRecord.report_type, func.count(ReportRecord.id)).group_by(ReportRecord.report_type)).all()
    return {
        "users_total": db.execute(select(func.count(User.id))).scalar_one(),
        "active_users": db.execute(select(func.count(User.id)).where(User.last_login_at >= week)).scalar_one(),
        "users_by_role": [{"role": r, "count": c} for r, c in roles],
        "registrations_by_day": _by_day(db, User.created_at),
        "logins_by_day": _by_day(db, AuditLog.created_at, where=AuditLog.action == "auth.login"),
        "projects_total": db.execute(select(func.count(InnovationProject.id))).scalar_one(),
        "funding_total": db.execute(select(func.count(FundingOpportunity.id))).scalar_one(),
        "publications_total": db.execute(select(func.count(Publication.id))).scalar_one(),
        "patents_total": db.execute(select(func.count(Patent.id))).scalar_one(),
        "reports_generated": sum(c for _, c in reports),
        "reports_by_type": [{"type": t, "count": c} for t, c in reports],
        "notifications_total": db.execute(select(func.count(Notification.id))).scalar_one(),
        "recommendations_served": db.execute(select(func.count(RecommendationLog.id))).scalar_one(),
    }


def eligibility_accuracy() -> dict:
    """Rule-consistency check of the eligibility engine on hand-labelled scenarios."""
    from datetime import date

    class F:  # lightweight stand-in for a FundingOpportunity
        def __init__(self, **kw):
            self.status = kw.get("status", "open")
            self.deadline = kw.get("deadline", date.today() + timedelta(days=30))
            self.applicant_types = kw.get("applicant_types", ["researcher", "university"])
            self.eligible_countries = kw.get("eligible_countries", ["Global"])
            self.career_stages = kw.get("career_stages", [])

    ctx_in = eligibility.ApplicantContext(role="researcher", applicant_types={"researcher", "university"},
                                          country="India", career_stage="early_career")
    ctx_startup = eligibility.ApplicantContext(role="startup_founder", applicant_types={"startup"},
                                               country="United States", career_stage="industry")
    cases = [
        (F(), ctx_in, "eligible"),
        (F(eligible_countries=["United States"]), ctx_in, "ineligible"),
        (F(eligible_countries=["United States"]), ctx_startup, "ineligible"),
        (F(eligible_countries=["United States"], applicant_types=["startup"]), ctx_startup, "eligible"),
        (F(deadline=date.today() - timedelta(days=1)), ctx_in, "ineligible"),
        (F(status="closed"), ctx_in, "ineligible"),
        (F(career_stages=["early_career"]), ctx_in, "eligible"),
        (F(career_stages=["senior"]), ctx_in, "ineligible"),
        (F(applicant_types=[]), ctx_in, "partially_eligible"),
        (F(eligible_countries=["European Union"]), ctx_in, "ineligible"),
        (F(deadline=None, status="rolling"), ctx_startup, "ineligible"),
        (F(deadline=None, status="rolling", applicant_types=["startup"]), ctx_startup, "eligible"),
    ]
    correct = sum(1 for f, ctx, expected in cases if eligibility.evaluate(f, ctx)["status"] == expected)
    return {"cases": len(cases), "correct": correct, "accuracy": round(correct / len(cases), 3)}


def recommendation_monitoring(db: Session) -> dict:
    served = db.execute(select(func.count(RecommendationLog.id))).scalar_one()
    users = db.execute(select(func.count(func.distinct(RecommendationLog.user_id)))).scalar_one()
    avg = db.execute(select(func.avg(RecommendationLog.match_score))).scalar_one()
    feedback = dict(db.execute(select(RecommendationFeedback.action, func.count(RecommendationFeedback.id))
                               .group_by(RecommendationFeedback.action)).all())
    since = utcnow() - timedelta(days=30)
    logs = db.execute(select(RecommendationLog.created_at, RecommendationLog.match_score)
                      .where(RecommendationLog.created_at >= since)).all()
    day: dict[str, list[float]] = {}
    for dt, score in logs:
        day.setdefault(dt.date().isoformat(), []).append(score)
    top = db.execute(select(RecommendationLog.funding_id, func.count(RecommendationLog.id).label("n"))
                     .group_by(RecommendationLog.funding_id).order_by(text("n DESC")).limit(5)).all()
    titles = {f.id: f.title for f in db.execute(select(FundingOpportunity).where(
        FundingOpportunity.id.in_([t[0] for t in top]))).scalars()} if top else {}
    recent = db.execute(select(RecommendationLog, User.email, FundingOpportunity.title)
                        .join(User, User.id == RecommendationLog.user_id)
                        .join(FundingOpportunity, FundingOpportunity.id == RecommendationLog.funding_id)
                        .order_by(RecommendationLog.id.desc()).limit(15)).all()
    engaged = sum(feedback.get(k, 0) for k in ("clicked", "saved"))
    evaluation = recommender.evaluate_offline(db, k=5)
    acc = eligibility_accuracy()
    evaluation["eligibility_accuracy"] = acc["accuracy"]
    evaluation["eligibility_cases"] = acc["cases"]
    return {
        "served_total": served, "unique_users": users, "avg_match_score": round(float(avg), 1) if avg else None,
        "feedback": {"clicked": feedback.get("clicked", 0), "saved": feedback.get("saved", 0),
                     "dismissed": feedback.get("dismissed", 0)},
        "engagement_rate": round(engaged / served, 3) if served else None,
        "by_day": [{"date": d, "count": len(v), "avg_score": round(sum(v) / len(v), 1)} for d, v in sorted(day.items())],
        "top_recommended": [{"funding_id": fid, "title": titles.get(fid, "?"), "count": n} for fid, n in top],
        "evaluation": evaluation,
        "recent": [{"user_email": email, "funding_title": title, "match_score": log.match_score,
                    "created_at": log.created_at.isoformat() + "Z"} for log, email, title in recent],
    }


def datasets(db: Session) -> dict:
    def grouped(model, column):
        return [{"value": v or "unknown", "count": c}
                for v, c in db.execute(select(column, func.count(model.id)).group_by(column)).all()]

    def last(model, column):
        v = db.execute(select(func.max(column))).scalar_one()
        return v.isoformat() + "Z" if v else None

    pub_sources = [{"source": r["value"], "count": r["count"]}
                   for r in grouped(Publication, Publication.source)]
    items = [
        {"key": "funding", "label": "Funding opportunities", "importable": True,
         "count": db.execute(select(func.count(FundingOpportunity.id))).scalar_one(),
         "by_source": [{"source": r["value"], "count": r["count"]} for r in grouped(FundingOpportunity, FundingOpportunity.source_name)],
         "by_record_type": grouped(FundingOpportunity, FundingOpportunity.record_type),
         "last_updated": last(FundingOpportunity, FundingOpportunity.updated_at),
         "description": "Verified Grants.gov records, illustrative samples, admin imports and internal calls."},
        {"key": "publications", "label": "Publications", "importable": True,
         "count": db.execute(select(func.count(Publication.id))).scalar_one(), "by_source": pub_sources,
         "by_record_type": [], "last_updated": last(Publication, Publication.created_at),
         "description": "OpenAlex snapshot (CC0), Crossref/OpenAlex DOI imports and user-entered publications."},
        {"key": "patents", "label": "Patents", "importable": True,
         "count": db.execute(select(func.count(Patent.id))).scalar_one(),
         "by_source": [{"source": r["value"], "count": r["count"]} for r in grouped(Patent, Patent.source)],
         "by_record_type": grouped(Patent, Patent.record_type), "last_updated": last(Patent, Patent.created_at),
         "description": "Illustrative synthetic patents plus any imported Google Patents / Lens exports."},
        {"key": "publication_trends", "label": "Publication trend points", "importable": False,
         "count": db.execute(select(func.count(TrendPoint.id))).scalar_one(),
         "by_source": [{"source": r["value"], "count": r["count"]} for r in grouped(TrendPoint, TrendPoint.source)],
         "by_record_type": [], "last_updated": last(TrendPoint, TrendPoint.retrieved_at),
         "description": "Yearly global publication counts per technology area from OpenAlex."},
    ]
    imports = db.execute(select(DatasetImport).order_by(DatasetImport.id.desc()).limit(20)).scalars().all()
    return {"datasets": items, "imports": [ImportOut.model_validate(i).model_dump(mode="json") for i in imports]}


def system_status(db: Session) -> dict:
    s = get_settings()
    try:
        db.execute(text("SELECT 1"))
        db_ok = True
    except Exception:  # noqa: BLE001
        db_ok = False
    return {
        "version": s.app_version, "environment": s.environment,
        "database": {"dialect": db.get_bind().dialect.name, "ok": db_ok}, "uptime_seconds": uptime_seconds(),
        "metrics": metrics.snapshot(), "jobs": jobs.job_status(db),
        "integrations": [
            {"name": "Grants.gov", "enabled": s.external_apis_enabled, "detail": "Keyless public API (search2, fetchOpportunity)"},
            {"name": "OpenAlex", "enabled": s.external_apis_enabled,
             "detail": "API key configured" if s.openalex_api_key else "Keyless shared daily quota (set OPENALEX_API_KEY for more)"},
            {"name": "Crossref", "enabled": s.external_apis_enabled, "detail": "Keyless DOI metadata lookup"},
            {"name": "PatentsView", "enabled": patentsview.is_configured(),
             "detail": "Configured" if patentsview.is_configured() else "Set PATENTSVIEW_API_KEY to enable live patent search"},
            {"name": "Google OAuth", "enabled": bool(s.google_client_id and s.google_client_secret), "detail": "Optional social login"},
            {"name": "GitHub OAuth", "enabled": bool(s.github_client_id and s.github_client_secret), "detail": "Optional social login"},
        ],
        "config": {"alerts_interval_minutes": s.alerts_interval_minutes, "scheduler_enabled": s.enable_scheduler,
                   "grantsgov_sync_enabled": s.grantsgov_sync_enabled, "access_token_expire_minutes": s.access_token_expire_minutes,
                   "login_max_attempts": s.login_max_attempts, "login_lockout_minutes": s.login_lockout_minutes,
                   "cors_origins": s.cors_origin_list, "external_apis_enabled": s.external_apis_enabled},
    }
