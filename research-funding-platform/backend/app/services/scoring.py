"""Weighted Innovation Scoring Engine.

Innovation Score = 0.30 x Research Novelty + 0.20 x Patent Strength + 0.15 x Technology Maturity
                 + 0.20 x Market Potential + 0.15 x Funding Relevance          (every component 0-100)

Each component blends data-driven signals (TF-IDF similarity to the publication and patent corpora, publication
growth, emerging terms, funding matches) with the structured inputs supplied for the project (TRL, stage, market
size, IP counts). It is a transparent heuristic for decision support — NOT a validated predictor of success.
"""
from __future__ import annotations

import threading
from dataclasses import dataclass, field

import numpy as np
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core import taxonomy
from app.ml.stats import clamp
from app.ml.text import PATENT_BOILERPLATE, make_vectorizer
from app.models import InnovationProject, InnovationScore, Patent, Publication, User
from app.services import eligibility, recommender, research_analytics, technology_intel

WEIGHTS = {"research_novelty": 0.30, "patent_strength": 0.20, "technology_maturity": 0.15,
           "market_potential": 0.20, "funding_relevance": 0.15}
LABELS = {"research_novelty": "Research Novelty", "patent_strength": "Patent Strength",
          "technology_maturity": "Technology Maturity", "market_potential": "Market Potential",
          "funding_relevance": "Funding Relevance"}
FORMULA = ("Innovation Score = 0.30 x Research Novelty + 0.20 x Patent Strength + 0.15 x Technology Maturity "
           "+ 0.20 x Market Potential + 0.15 x Funding Relevance (each component normalised to 0-100)")
DISCLAIMER = ("Heuristic decision-support score computed from platform data and the project inputs you provide. "
              "It is not a validated prediction of commercial success, an investment recommendation, or a "
              "substitute for expert due diligence.")
MARKET_SIZE_VALUE = {"niche": 0.25, "medium": 0.5, "large": 0.75, "very_large": 1.0}
STAGE_INDEX = {"idea": 0, "research": 1, "prototype": 2, "pilot": 3, "market_ready": 4}


def band(score: float) -> str:
    if score >= 75:
        return "High"
    if score >= 60:
        return "Promising"
    if score >= 40:
        return "Developing"
    return "Early"


@dataclass
class ProjectInput:
    title: str
    description: str
    domain: str | None
    keywords: list[str] = field(default_factory=list)
    stage: str = "idea"
    trl: int = 1
    market_size: str = "medium"
    target_market: str | None = None
    patents_filed: int = 0
    patents_granted: int = 0
    team_size: int | None = None
    has_industry_partner: bool = False

    @classmethod
    def from_project(cls, p: InnovationProject) -> "ProjectInput":
        return cls(title=p.title, description=p.description, domain=p.domain, keywords=list(p.keywords or []),
                   stage=p.stage, trl=p.trl, market_size=p.market_size, target_market=p.target_market,
                   patents_filed=p.patents_filed, patents_granted=p.patents_granted, team_size=p.team_size,
                   has_industry_partner=p.has_industry_partner)

    def text(self) -> str:
        kw = " ".join(self.keywords)
        return f"{self.title} {self.title} {self.description} {kw} {kw} {self.target_market or ''}"


class _CorpusIndex:
    def __init__(self, model, extra_stop_words: set[str] | None = None) -> None:
        self.model = model
        self.extra_stop_words = extra_stop_words
        self._lock = threading.Lock()
        self._sig = None
        self.vectorizer = None
        self.matrix = None
        self.rows: list = []

    def get(self, db: Session):
        m = self.model
        sig = tuple(db.execute(select(func.count(m.id), func.max(m.id)).where(m.owner_id.is_(None))).one())
        with self._lock:
            if sig != self._sig:
                self.rows = db.execute(select(m).where(m.owner_id.is_(None))).scalars().all()
                texts = [f"{r.title} {r.abstract or ''} {' '.join(r.keywords or [])}" for r in self.rows] or ["empty"]
                self.vectorizer = make_vectorizer(max_features=15000, extra_stop_words=self.extra_stop_words)
                self.matrix = self.vectorizer.fit_transform(texts)
                self._sig = sig
            return self.vectorizer, self.matrix, self.rows


_publications = _CorpusIndex(Publication)
_patents = _CorpusIndex(Patent, PATENT_BOILERPLATE)


def _similarities(index: _CorpusIndex, db: Session, text: str) -> tuple[np.ndarray, list]:
    vec, matrix, rows = index.get(db)
    if not rows:
        return np.array([]), rows
    q = vec.transform([text])
    return (matrix @ q.T).toarray().ravel(), rows


def _component(key: str, value: float, explanation: str, factors: list[dict]) -> dict:
    value = round(clamp(value, 0, 100), 1)
    return {"key": key, "label": LABELS[key], "weight": WEIGHTS[key], "value": value,
            "weighted": round(value * WEIGHTS[key], 2), "explanation": explanation, "factors": factors}


def _novelty(db: Session, p: ProjectInput) -> dict:
    sims, rows = _similarities(_publications, db, p.text())
    if len(sims):
        top_idx = np.argsort(sims)[::-1][:5]
        mean_top5 = float(np.mean(sims[top_idx]))
        closest = rows[int(top_idx[0])].title
    else:
        mean_top5, closest = 0.0, None
    text_novelty = 1 - min(1.0, mean_top5 / 0.5)
    growth = next((g for g in research_analytics.growth_table(db) if g["domain"] == p.domain), None)
    cagr_value = growth["cagr"] if growth else None
    growth_scaled = clamp(((cagr_value or 0) + 5) / 35)
    emerging_terms = [i["term"] for i in research_analytics.emerging_topics(db, None, 40)["items"]]
    lowered = p.text().lower()
    hits = [t for t in emerging_terms if t in lowered]
    emerging_share = min(1.0, len(hits) / 3)
    value = 100 * (0.60 * text_novelty + 0.25 * growth_scaled + 0.15 * emerging_share)
    level = "high" if text_novelty > 0.7 else ("moderate" if text_novelty > 0.45 else "limited")
    return _component("research_novelty", value,
                      f"Textual novelty versus {len(rows)} indexed publications is {level}; the domain's publication "
                      f"output grows {cagr_value if cagr_value is not None else 'n/a'}%/yr; {len(hits)} emerging "
                      "term(s) appear in the project description.",
                      [{"name": "Mean similarity to 5 closest publications", "value": round(mean_top5, 3),
                        "detail": f"Closest: {closest}" if closest else "No publication corpus loaded"},
                       {"name": "Text novelty (60%)", "value": round(text_novelty, 3),
                        "detail": "1 - min(1, mean_similarity / 0.5)"},
                       {"name": "Domain publication growth (25%)", "value": round(growth_scaled, 3),
                        "detail": f"5-year CAGR {cagr_value}% mapped from [-5%, +30%] to [0, 1]"},
                       {"name": "Emerging-topic alignment (15%)", "value": round(emerging_share, 3),
                        "detail": ", ".join(hits[:5]) or "No emerging terms detected"}])


def _patent_strength(db: Session, p: ProjectInput, owner: User | None) -> dict:
    pending = max(0, p.patents_filed - p.patents_granted)
    ip = min(1.0, (p.patents_granted + 0.5 * pending) / 3)
    own_cites = 0
    if owner is not None:
        own_cites = int(db.execute(select(func.coalesce(func.sum(Patent.citation_count), 0))
                                   .where(Patent.owner_id == owner.id)).scalar_one())
    cite_strength = min(1.0, own_cites / 50)
    sims, rows = _similarities(_patents, db, p.text())
    top3 = float(np.mean(np.sort(sims)[::-1][:3])) if len(sims) else 0.0
    closest = rows[int(np.argmax(sims))] if len(sims) else None
    fto = 1 - min(1.0, top3 / 0.7)
    value = 100 * (0.55 * ip + 0.15 * cite_strength + 0.30 * fto)
    return _component("patent_strength", value,
                      f"{p.patents_granted} granted and {pending} pending patent(s); landscape crowding "
                      f"{'high' if fto < 0.4 else 'moderate' if fto < 0.7 else 'low'} (mean similarity to the 3 "
                      f"closest existing patents {top3:.2f}).",
                      [{"name": "Own IP position (55%)", "value": round(ip, 3),
                        "detail": "(granted + 0.5 x pending) / 3, capped at 1"},
                       {"name": "Citations of your profile patents (15%)", "value": round(cite_strength, 3),
                        "detail": f"{own_cites} citations across patents on your profile (50 = max)"},
                       {"name": "Freedom-to-operate proxy (30%)", "value": round(fto, 3),
                        "detail": (f"1 - min(1, top-3 similarity / 0.7). Closest patent: {closest.title} "
                                   f"({closest.assignee})") if closest else "No patent corpus loaded"}])


def _maturity(p: ProjectInput) -> dict:
    trl_norm = (p.trl - 1) / 8
    stage_norm = STAGE_INDEX.get(p.stage, 0) / 4
    value = 100 * (0.8 * trl_norm + 0.2 * stage_norm)
    return _component("technology_maturity", value,
                      f"Technology Readiness Level {p.trl}/9 at the '{p.stage.replace('_', ' ')}' stage.",
                      [{"name": "TRL (80%)", "value": p.trl, "detail": "(TRL - 1) / 8"},
                       {"name": "Pipeline stage (20%)", "value": p.stage, "detail": f"stage index {STAGE_INDEX.get(p.stage, 0)}/4"}])


def _market(db: Session, p: ProjectInput) -> dict:
    size = MARKET_SIZE_VALUE.get(p.market_size, 0.5)
    metrics = {i["key"]: i for i in technology_intel.area_metrics(db)}
    area = metrics.get(p.domain or "")
    domain_signal = (0.5 * area["adoption_index"] / 100 + 0.5 * area["_funding_availability"] / 100) if area else 0.0
    partner = 1.0 if p.has_industry_partner else 0.0
    target = 1.0 if (p.target_market or "").strip() else 0.0
    value = 100 * min(1.0, 0.55 * size + 0.25 * domain_signal + 0.10 * partner + 0.10 * target)
    return _component("market_potential", value,
                      f"Addressable market '{p.market_size.replace('_', ' ')}'; domain adoption/funding signal "
                      f"{domain_signal:.2f}; {'has' if partner else 'no'} industry partner.",
                      [{"name": "Market size (55%)", "value": size, "detail": "niche 0.25 / medium 0.5 / large 0.75 / very large 1.0"},
                       {"name": "Domain adoption & funding signal (25%)", "value": round(domain_signal, 3),
                        "detail": f"{taxonomy.area_name(p.domain)}: adoption index {area['adoption_index'] if area else 'n/a'}"},
                       {"name": "Industry partner (10%)", "value": partner, "detail": "Committed industry partner"},
                       {"name": "Defined target market (10%)", "value": target, "detail": p.target_market or "Not specified"}])


def _funding(db: Session, p: ProjectInput, owner: User | None) -> dict:
    if owner is not None:
        _, _, ctx, _, _ = recommender.user_inputs(db, owner)
    else:
        ctx = eligibility.ApplicantContext(role="researcher", applicant_types={"researcher", "university"})
    scored = recommender.score_text(db, p.text(), [p.domain] if p.domain else [], ctx)
    usable = sorted((s for s in scored if s["eligibility"]["status"] != "ineligible"), key=lambda s: -s["match_score"])
    top3 = [s["match_score"] for s in usable[:3]]
    avg_top3 = float(np.mean(top3)) if top3 else 0.0
    good = sum(1 for s in usable if s["match_score"] >= 50)
    value = 100 * (0.7 * avg_top3 / 100 + 0.3 * min(1.0, good / 5))
    best = usable[0]["funding"].title if usable else None
    return _component("funding_relevance", value,
                      f"{good} open opportunity(ies) match at 50+; average of the top-3 match scores is {avg_top3:.1f}.",
                      [{"name": "Top-3 average match score (70%)", "value": round(avg_top3, 1),
                        "detail": f"Best match: {best}" if best else "No eligible open opportunities"},
                       {"name": "Number of strong matches (30%)", "value": good, "detail": "5 or more = full marks"}])


def compute(db: Session, project: ProjectInput, owner: User | None) -> dict:
    components = [_novelty(db, project), _patent_strength(db, project, owner), _maturity(project),
                  _market(db, project), _funding(db, project, owner)]
    overall = round(sum(c["weighted"] for c in components), 1)
    ordered = sorted(components, key=lambda c: -c["value"])
    explanation = (f"Overall {overall}/100 ({band(overall)}). Strongest component: {ordered[0]['label']} "
                   f"({ordered[0]['value']}); weakest: {ordered[-1]['label']} ({ordered[-1]['value']}).")
    return {"overall": overall, "band": band(overall), "components": components, "weights": dict(WEIGHTS),
            "explanation": explanation, "disclaimer": DISCLAIMER}


def persist(db: Session, project: InnovationProject, result: dict, user: User | None) -> InnovationScore:
    values = {c["key"]: c["value"] for c in result["components"]}
    score = InnovationScore(project_id=project.id, computed_by_id=user.id if user else None,
                            overall=result["overall"], band=result["band"], details={
                                "components": result["components"], "explanation": result["explanation"]},
                            **values)
    db.add(score)
    db.commit()
    db.refresh(score)
    return score


def to_out(score: InnovationScore | None) -> dict | None:
    if score is None:
        return None
    details = score.details or {}
    from app.schemas.common import iso_utc
    return {"id": score.id, "project_id": score.project_id, "overall": score.overall, "band": score.band,
            "components": details.get("components", []), "weights": dict(WEIGHTS),
            "explanation": details.get("explanation", ""), "disclaimer": DISCLAIMER,
            "created_at": iso_utc(score.created_at)}


def weights_payload() -> dict:
    return {"weights": dict(WEIGHTS), "labels": dict(LABELS), "formula": FORMULA, "disclaimer": DISCLAIMER}
