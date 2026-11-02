"""Research profile helpers: creation, completeness and bibliometric statistics."""
from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Patent, Publication, ResearchHistoryEntry, ResearchProfile, User
from app.schemas.profile import ProfileOut, ProfileStats


def get_or_create_profile(db: Session, user: User) -> ResearchProfile:
    profile = db.execute(select(ResearchProfile).where(ResearchProfile.user_id == user.id)).scalar_one_or_none()
    if profile is None:
        profile = ResearchProfile(user_id=user.id, organization_name=user.organization, research_domains=[],
                                  keywords=[], technology_areas=[])
        db.add(profile)
        db.commit()
        db.refresh(profile)
    return profile


def h_index(citations: list[int]) -> int:
    ranked = sorted((c or 0 for c in citations), reverse=True)
    return sum(1 for i, c in enumerate(ranked, start=1) if c >= i)


def profile_completeness(profile: ResearchProfile | None, publication_count: int = 0) -> int:
    if profile is None:
        return 0
    checks = [
        bool(profile.headline), bool(profile.bio), bool(profile.organization_name), bool(profile.organization_type),
        bool(profile.country), bool(profile.career_stage), bool(profile.research_domains),
        len(profile.keywords or []) >= 3, bool(profile.technology_areas), publication_count > 0,
    ]
    return round(100 * sum(checks) / len(checks))


def profile_stats(db: Session, user_id: int) -> ProfileStats:
    citations = db.execute(select(Publication.citation_count).where(Publication.owner_id == user_id)).scalars().all()
    patents = db.execute(select(func.count(Patent.id)).where(Patent.owner_id == user_id)).scalar_one()
    history = db.execute(select(func.count(ResearchHistoryEntry.id))
                         .where(ResearchHistoryEntry.user_id == user_id)).scalar_one()
    return ProfileStats(publications=len(citations), patents=patents, citations=int(sum(citations)),
                        h_index=h_index(list(citations)), history_entries=history)


def to_profile_out(db: Session, profile: ResearchProfile) -> ProfileOut:
    stats = profile_stats(db, profile.user_id)
    out = ProfileOut.model_validate(profile)
    out.stats = stats
    out.completeness = profile_completeness(profile, stats.publications)
    return out
