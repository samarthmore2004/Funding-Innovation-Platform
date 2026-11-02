"""Personalised funding recommendations.

Pipeline: build a text representation of the user (profile, keywords, domains, publications) or of an
innovation project -> TF-IDF vectors (scikit-learn) -> cosine similarity against every active funding
opportunity -> combine with explicit domain overlap and rule-based eligibility into a 0-100 match score.

match_score = 100 * (0.65 * relevance + 0.15 * domain_match + 0.20 * eligibility_score)
relevance   = 1 - exp(-cosine_similarity / 0.12)   (smooth, never saturates: 0.10 -> 0.57, 0.20 -> 0.81, 0.30 -> 0.92)

Domain keyword expansion is applied to the query (profile/project) only, so two records tagged with the same
area are not artificially similar; explicit domain overlap is rewarded separately through `domain_match`.
"""
from __future__ import annotations

import math
import threading
from datetime import date, datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core import taxonomy
from app.ml.text import clean, domain_expansion, domain_names, make_vectorizer, shared_terms, top_terms
from app.models import FundingOpportunity, InnovationProject, Publication, RecommendationLog, ResearchProfile, User
from app.schemas.funding import FundingOut
from app.services import eligibility
from app.services.profile_service import profile_completeness

SIMILARITY_SCALE = 0.12
MIN_SIMILARITY = 0.02  # below this, an opportunity without domain overlap is not offered as a recommendation
ACTIVE_STATUSES = ("open", "forecasted", "rolling")
W_RELEVANCE, W_DOMAIN, W_ELIGIBILITY = 0.65, 0.15, 0.20


def relevance(similarity: float) -> float:
    return 1.0 - math.exp(-max(0.0, similarity) / SIMILARITY_SCALE)


def match_score(similarity: float, domain_match: bool, eligibility_score: float) -> float:
    return round(100 * (W_RELEVANCE * relevance(similarity) + W_DOMAIN * (1.0 if domain_match else 0.0)
                        + W_ELIGIBILITY * eligibility_score), 1)


def funding_text(f: FundingOpportunity) -> str:
    return clean(" ".join([
        f.title, f.title, f.description or "", " ".join(f.keywords or []), domain_names(f.domains),
        f.organization or "",
    ]))


def profile_text(user: User, profile: ResearchProfile | None, publications: list[Publication]) -> str:
    parts: list[str] = []
    if profile:
        parts += [profile.headline or "", profile.bio or "", profile.department or ""]
        kw = " ".join(profile.keywords or [])
        parts += [kw, kw]  # keywords are explicit signals -> double weight
        parts.append(domain_expansion(list(profile.research_domains or []) + list(profile.technology_areas or [])))
    for pub in publications[:25]:
        parts += [pub.title, " ".join(pub.keywords or [])]
    return clean(" ".join(parts))


def project_text(project: InnovationProject) -> str:
    kw = " ".join(project.keywords or [])
    return clean(" ".join([project.title, project.title, project.description or "", kw, kw,
                           domain_expansion([project.domain] if project.domain else []),
                           project.target_market or ""]))


class FundingIndex:
    """Caches the fitted TF-IDF model until the funding table changes."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._signature = None
        self.vectorizer = None
        self.matrix = None
        self.ids: list[int] = []
        self.position: dict[int, int] = {}

    @staticmethod
    def _sig(db: Session):
        return db.execute(select(func.count(FundingOpportunity.id), func.max(FundingOpportunity.id),
                                 func.max(FundingOpportunity.updated_at))).one()

    def get(self, db: Session):
        sig = tuple(self._sig(db))
        with self._lock:
            if sig != self._signature or self.vectorizer is None:
                rows = db.execute(select(FundingOpportunity)).scalars().all()
                self.ids = [r.id for r in rows]
                self.position = {fid: i for i, fid in enumerate(self.ids)}
                texts = [funding_text(r) for r in rows] or ["empty"]
                self.vectorizer = make_vectorizer()
                self.matrix = self.vectorizer.fit_transform(texts)
                self._signature = sig
            return self.vectorizer, self.matrix, self.position

    def invalidate(self) -> None:
        with self._lock:
            self._signature = None


funding_index = FundingIndex()


def _reasons(f: FundingOpportunity, sim: float, terms: list[str], domain_hits: list[str], elig: dict,
             today: date) -> list[str]:
    reasons: list[str] = []
    if terms:
        strength = "Strong" if sim >= 0.2 else ("Moderate" if sim >= 0.1 else "Weak")
        reasons.append(f"{strength} topical overlap (cosine {sim:.2f}): {', '.join(terms[:5])}")
    if domain_hits:
        reasons.append("Matches your domain(s): " + ", ".join(taxonomy.area_name(d) for d in domain_hits))
    if f.deadline and f.deadline >= today:
        reasons.append(f"Deadline in {(f.deadline - today).days} days")
    elif not f.deadline:
        reasons.append("No fixed deadline published (rolling or forecasted)")
    if f.max_amount:
        reasons.append(f"Funding up to {f.currency} {f.max_amount:,.0f}")
    passed = sum(1 for c in elig["checks"] if c["passed"])
    reasons.append(f"Eligibility: {passed}/{len(elig['checks'])} criteria confirmed ({elig['status'].replace('_', ' ')})")
    if f.record_type == "illustrative":
        reasons.append("Illustrative sample record — not a real call")
    return reasons


def score_text(db: Session, text: str, domains: list[str], ctx: eligibility.ApplicantContext,
               funder_type: str | None = None, include_closed: bool = False) -> list[dict]:
    """Score every candidate opportunity for a query text. Returns unsorted dicts."""
    today = date.today()
    vectorizer, matrix, position = funding_index.get(db)
    stmt = select(FundingOpportunity)
    if not include_closed:
        stmt = stmt.where(FundingOpportunity.status.in_(ACTIVE_STATUSES))
    if funder_type:
        stmt = stmt.where(FundingOpportunity.funder_type == funder_type)
    candidates = db.execute(stmt).scalars().all()
    if not candidates:
        return []
    query_vec = vectorizer.transform([text or ""])
    sims = (matrix @ query_vec.T).toarray().ravel()
    features = vectorizer.get_feature_names_out()
    domain_set = set(domains)
    results = []
    for f in candidates:
        pos = position.get(f.id)
        sim = float(sims[pos]) if pos is not None else 0.0
        elig = eligibility.evaluate(f, ctx, today)
        domain_hits = [d for d in (f.domains or []) if d in domain_set]
        match = match_score(sim, bool(domain_hits), elig["score"])
        terms = shared_terms(matrix[pos], query_vec, features) if pos is not None and sim > 0 else []
        results.append({
            "funding": f, "match_score": match, "similarity": round(sim, 4), "eligibility": elig,
            "matched_terms": terms, "reasons": _reasons(f, sim, terms, domain_hits, elig, today),
            "domain_match": bool(domain_hits),
        })
    return results


def _serialise(item: dict) -> dict:
    out = dict(item)
    out["funding"] = FundingOut.from_model(item["funding"]).model_dump(mode="json")
    return out


def user_inputs(db: Session, user: User) -> tuple[str, list[str], eligibility.ApplicantContext, ResearchProfile | None, list]:
    profile = db.execute(select(ResearchProfile).where(ResearchProfile.user_id == user.id)).scalar_one_or_none()
    pubs = db.execute(select(Publication).where(Publication.owner_id == user.id)
                      .order_by(Publication.year.desc().nulls_last())).scalars().all()
    text = profile_text(user, profile, pubs)
    domains = list(dict.fromkeys(list(profile.research_domains or []) + list(profile.technology_areas or []))) if profile else []
    return text, domains, eligibility.build_context(user, profile), profile, pubs


def recommend(db: Session, user: User, limit: int = 10, include_ineligible: bool = False,
              funder_type: str | None = None, min_score: float = 0, project: InnovationProject | None = None,
              log: bool = False) -> dict:
    text, domains, ctx, profile, pubs = user_inputs(db, user)
    notes: list[str] = []
    if project is not None:
        text = project_text(project)
        domains = [project.domain] if project.domain else []
        if project.owner_id != user.id:
            owner = db.get(User, project.owner_id)
            if owner:
                _, _, ctx, _, _ = user_inputs(db, owner)
    elif not text.strip():
        notes.append("Your research profile is empty, so matches are generic. Add domains, keywords and "
                     "publications on the Profile page for personalised results.")
    if profile is None or not profile.country:
        notes.append("Add your country to your profile so country-restricted calls can be checked.")

    scored = score_text(db, text, domains, ctx, funder_type=funder_type)
    if text.strip():
        # An opportunity with (almost) no topical overlap and no shared domain is not a match, however eligible.
        scored = [s for s in scored if s["similarity"] >= MIN_SIMILARITY or s["domain_match"]]
    hidden = 0
    if not include_ineligible:
        before = len(scored)
        scored = [s for s in scored if s["eligibility"]["status"] != "ineligible"]
        hidden = before - len(scored)
    scored = [s for s in scored if s["match_score"] >= min_score]
    scored.sort(key=lambda s: (-s["match_score"], s["funding"].deadline or date.max))
    top = scored[:limit]
    if hidden:
        notes.append(f"{hidden} opportunities were hidden because a hard eligibility rule failed "
                     "(e.g. country, applicant type or deadline). Enable 'include ineligible' to review them.")

    if log and top:
        context = "project" if project is not None else "profile"
        for s in top:
            db.add(RecommendationLog(user_id=user.id, funding_id=s["funding"].id, match_score=s["match_score"],
                                     similarity=s["similarity"], eligibility_status=s["eligibility"]["status"],
                                     context=context))
        db.commit()

    vectorizer, _, _ = funding_index.get(db)
    profile_terms = top_terms(vectorizer.transform([text]), vectorizer.get_feature_names_out(), 12) if text else []
    return {
        "generated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "profile_completeness": profile_completeness(profile, len(pubs)) if profile else 0,
        "profile_terms": profile_terms,
        "items": [_serialise(s) for s in top],
        "notes": notes,
    }


def match_single(db: Session, user: User, funding: FundingOpportunity) -> tuple[dict, dict]:
    """Return (eligibility, match) for one opportunity and the current user."""
    text, domains, ctx, _, _ = user_inputs(db, user)
    elig = eligibility.evaluate(funding, ctx)
    vectorizer, matrix, position = funding_index.get(db)
    pos = position.get(funding.id)
    sim, terms = 0.0, []
    if pos is not None and text:
        qv = vectorizer.transform([text])
        sim = float((matrix[pos] @ qv.T).toarray().ravel()[0])
        terms = shared_terms(matrix[pos], qv, vectorizer.get_feature_names_out()) if sim > 0 else []
    domain_hit = bool(set(funding.domains or []) & set(domains))
    return elig, {"match_score": match_score(sim, domain_hit, elig["score"]), "similarity": round(sim, 4),
                  "matched_terms": terms}


_evaluation_cache: dict = {}


def evaluate_offline(db: Session, k: int = 5) -> dict:
    """Offline evaluation with synthetic personas: one persona per technology area, built from the
    taxonomy description/keywords. Ground truth = active opportunities tagged with that area.
    Cached until the funding table changes."""
    key = (k, tuple(FundingIndex._sig(db)), date.today())
    if key in _evaluation_cache:
        return dict(_evaluation_cache[key])
    result = _evaluate_offline(db, k)
    _evaluation_cache.clear()
    _evaluation_cache[key] = result
    return dict(result)


def _evaluate_offline(db: Session, k: int) -> dict:
    ctx = eligibility.ApplicantContext(role="researcher", applicant_types=set(taxonomy.APPLICANT_TYPES), country=None)
    active = db.execute(select(FundingOpportunity).where(FundingOpportunity.status.in_(ACTIVE_STATUSES))).scalars().all()
    precisions, recalls, personas = [], [], 0
    for area in taxonomy.areas():
        relevant = {f.id for f in active if area["key"] in (f.domains or [])}
        if not relevant:
            continue
        persona_text = f"{area['name']} {area['description']} {' '.join(area['keywords'])}"
        scored = score_text(db, persona_text, [], ctx)  # domain bonus disabled -> pure text matching
        scored.sort(key=lambda s: -s["similarity"])
        top_ids = [s["funding"].id for s in scored[:k]]
        hits = len([i for i in top_ids if i in relevant])
        precisions.append(hits / k)
        recalls.append(hits / min(len(relevant), k))
        personas += 1
    return {
        "k": k,
        "precision_at_k": round(sum(precisions) / len(precisions), 3) if precisions else None,
        "recall_at_k": round(sum(recalls) / len(recalls), 3) if recalls else None,
        "personas": personas,
        "method": "One synthetic persona per technology area (taxonomy text only, no domain bonus). Relevant = "
                  "active opportunities tagged with that area. recall@k is normalised by min(|relevant|, k).",
    }
