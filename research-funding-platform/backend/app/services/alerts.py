"""Notification & alert engine.

Generates de-duplicated in-app notifications per user:
* funding_match     – new opportunities that match the profile (match score >= 60)
* funding_deadline  – saved or strongly matched opportunities closing within the user's reminder window
* patent_alert      – recent patents in the user's technology areas
* tech_alert        – emerging technology areas that overlap the user's interests
* trend_update      – emerging research terms in the user's domains
* commercialization – projects whose latest innovation score reaches the 'Promising' band
* system            – platform broadcasts (created by administrators)
"""
from __future__ import annotations

from collections import Counter
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core import taxonomy
from app.models import InnovationProject, Notification, Patent, ResearchProfile, SavedFunding, User
from app.services import recommender, research_analytics, technology_intel


def _add(db: Session, user: User, ntype: str, title: str, message: str, link: str | None, key: str,
         priority: str = "normal") -> bool:
    if ntype not in user.preferences.get("alert_types", []) and ntype != "system":
        return False
    exists = db.execute(select(Notification.id).where(Notification.user_id == user.id,
                                                      Notification.dedupe_key == key)).first()
    if exists:
        return False
    db.add(Notification(user_id=user.id, type=ntype, title=title[:300], message=message, link=link,
                        priority=priority, dedupe_key=key))
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        return False
    return True


def generate_for_user(db: Session, user: User, today: date | None = None) -> dict:
    today = today or date.today()
    prefs = user.preferences
    if not prefs.get("in_app", True) or not user.is_active:
        return {"created": 0, "by_type": {}}
    created: Counter = Counter()
    profile = db.execute(select(ResearchProfile).where(ResearchProfile.user_id == user.id)).scalar_one_or_none()
    interests = set((profile.research_domains or []) + (profile.technology_areas or [])) if profile else set()
    window = int(prefs.get("deadline_reminder_days", 14))

    recs = recommender.recommend(db, user, limit=15)["items"]
    for r in recs:
        f = r["funding"]
        if r["match_score"] >= 60:
            if _add(db, user, "funding_match", f"New funding match: {f['title'][:120]}",
                    f"{f['organization']} — match score {r['match_score']:.0f}/100. {r['reasons'][0] if r['reasons'] else ''}",
                    f"/app/funding/{f['id']}", f"match:{f['id']}"):
                created["funding_match"] += 1

    # deadline reminders: saved items + strong matches
    deadline_items = {}
    for s in db.execute(select(SavedFunding).where(SavedFunding.user_id == user.id,
                                                   SavedFunding.status.in_(["interested", "preparing"]))).scalars():
        deadline_items[s.funding.id] = (s.funding.title, s.funding.deadline, True)
    for r in recs:
        if r["match_score"] >= 55 and r["funding"]["deadline"]:
            deadline_items.setdefault(r["funding"]["id"], (r["funding"]["title"],
                                                           date.fromisoformat(r["funding"]["deadline"]), False))
    for fid, (title, deadline, saved) in deadline_items.items():
        if deadline and today <= deadline <= today + timedelta(days=window):
            days = (deadline - today).days
            if _add(db, user, "funding_deadline", f"Deadline in {days} day(s): {title[:120]}",
                    f"{'Saved opportunity' if saved else 'Recommended opportunity'} closes on {deadline.isoformat()}.",
                    f"/app/funding/{fid}", f"deadline:{fid}:{deadline.isoformat()}",
                    priority="high" if days <= 7 else "normal"):
                created["funding_deadline"] += 1

    if interests:
        recent_cut = date(today.year - 1, 1, 1)
        patents = db.execute(select(Patent).where(Patent.owner_id.is_(None), Patent.technology_domain.in_(interests),
                                                  Patent.filing_date >= recent_cut)
                             .order_by(Patent.filing_date.desc()).limit(3)).scalars().all()
        for p in patents:
            if _add(db, user, "patent_alert", f"New patent activity in {taxonomy.area_name(p.technology_domain)}",
                    f"{p.assignee}: \"{p.title}\" (filed {p.filing_date.isoformat()}, {p.record_type} record).",
                    "/app/patents", f"patent:{p.id}"):
                created["patent_alert"] += 1

        for area in technology_intel.emerging(db)["items"][:5]:
            if area["key"] in interests:
                if _add(db, user, "tech_alert", f"Emerging technology signal: {area['name']}",
                        f"Emerging score {area['emerging_score']:.0f}/100, maturity stage {area['maturity_stage']}, "
                        f"publication CAGR {area['publication_cagr']}%.", "/app/technology",
                        f"tech:{area['key']}:{today.isocalendar()[0]}-{today.isocalendar()[1]}"):
                    created["tech_alert"] += 1

        for dom in list(interests)[:3]:
            topics = research_analytics.emerging_topics(db, dom, 3)["items"]
            if topics:
                terms = ", ".join(t["term"] for t in topics)
                if _add(db, user, "trend_update", f"Research trend update: {taxonomy.area_name(dom)}",
                        f"Fast-growing topics: {terms}.", "/app/research",
                        f"trend:{dom}:{today.isocalendar()[0]}-{today.isocalendar()[1]}", priority="low"):
                    created["trend_update"] += 1

    projects = db.execute(select(InnovationProject).where(InnovationProject.owner_id == user.id)).scalars().all()
    for p in projects:
        latest = p.latest_score
        if latest and latest.overall >= 60:
            if _add(db, user, "commercialization", f"Commercialization opportunity: {p.title[:120]}",
                    f"Innovation score {latest.overall:.0f} ({latest.band}). Review recommended pathways.",
                    f"/app/commercialization?project={p.id}", f"commercial:{p.id}:{latest.id}"):
                created["commercialization"] += 1

    db.commit()
    return {"created": sum(created.values()), "by_type": dict(created)}


def generate_all(db: Session) -> dict:
    totals: Counter = Counter()
    users = db.execute(select(User).where(User.is_active.is_(True))).scalars().all()
    for u in users:
        res = generate_for_user(db, u)
        totals.update(res["by_type"])
    return {"users": len(users), "created": sum(totals.values()), "by_type": dict(totals),
            "ran_at": datetime.now(timezone.utc).isoformat()}


def broadcast(db: Session, title: str, message: str, roles: list[str] | None) -> int:
    stmt = select(User).where(User.is_active.is_(True))
    if roles:
        stmt = stmt.where(User.role.in_(roles))
    count = 0
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S%f")
    for u in db.execute(stmt).scalars():
        db.add(Notification(user_id=u.id, type="system", title=title, message=message, link=None, priority="normal",
                            dedupe_key=f"broadcast:{stamp}"))
        count += 1
    db.commit()
    return count
