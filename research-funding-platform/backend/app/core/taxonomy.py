"""Shared vocabularies: technology areas, organisation types, funder types, etc."""
from __future__ import annotations

import json
import re
from functools import lru_cache

from app.core.config import get_settings

FUNDER_TYPES = {
    "government_grant": "Government Grant",
    "research_council": "Research Council",
    "innovation_fund": "Innovation Fund",
    "startup_accelerator": "Startup Accelerator",
    "venture_program": "Venture Program",
    "international_agency": "International Funding Agency",
}

APPLICANT_TYPES = {
    "researcher": "Individual researcher",
    "startup": "Startup / small business",
    "university": "University / higher education",
    "enterprise": "Enterprise / large company",
    "nonprofit": "Non-profit organisation",
    "government": "Government body",
}

ORGANIZATION_TYPES = {
    "university": "University",
    "research_institute": "Research institute",
    "startup": "Startup",
    "enterprise": "Enterprise",
    "government": "Government",
    "nonprofit": "Non-profit",
    "other": "Other",
}

CAREER_STAGES = {
    "student": "Student / PhD candidate",
    "early_career": "Early career (0-7 years post-PhD)",
    "mid_career": "Mid career",
    "senior": "Senior / principal investigator",
    "industry": "Industry professional",
}

PROJECT_STAGES = {
    "idea": "Idea",
    "research": "Research",
    "prototype": "Prototype",
    "pilot": "Pilot",
    "market_ready": "Market ready",
}

MARKET_SIZES = {
    "niche": "Niche (< $100M)",
    "medium": "Medium ($100M - $1B)",
    "large": "Large ($1B - $10B)",
    "very_large": "Very large (> $10B)",
}

COUNTRIES = [
    "Global", "Argentina", "Australia", "Austria", "Bangladesh", "Belgium", "Brazil", "Canada", "Chile", "China",
    "Colombia", "Czechia", "Denmark", "Egypt", "Estonia", "Finland", "France", "Germany", "Ghana", "Greece",
    "Hong Kong", "Hungary", "India", "Indonesia", "Ireland", "Israel", "Italy", "Japan", "Kenya", "Malaysia",
    "Mexico", "Netherlands", "New Zealand", "Nigeria", "Norway", "Pakistan", "Philippines", "Poland", "Portugal",
    "Rwanda", "Saudi Arabia", "Singapore", "South Africa", "South Korea", "Spain", "Sri Lanka", "Sweden",
    "Switzerland", "Taiwan", "Thailand", "Turkey", "United Arab Emirates", "United Kingdom", "United States",
    "Vietnam",
]

EU_COUNTRIES = {
    "Austria", "Belgium", "Czechia", "Denmark", "Estonia", "Finland", "France", "Germany", "Greece", "Hungary",
    "Ireland", "Italy", "Netherlands", "Poland", "Portugal", "Spain", "Sweden",
}


@lru_cache
def _load() -> dict:
    path = get_settings().data_path / "technology_taxonomy.json"
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def areas() -> list[dict]:
    return _load()["areas"]


def area_keys() -> list[str]:
    return [a["key"] for a in areas()]


def area_by_key(key: str | None) -> dict | None:
    if not key:
        return None
    for area in areas():
        if area["key"] == key:
            return area
    return None


def area_name(key: str | None) -> str:
    area = area_by_key(key)
    return area["name"] if area else (key or "Unclassified")


@lru_cache
def _cached_patterns() -> tuple:
    out = []
    for area in areas():
        pats = [re.compile(r"\b" + re.escape(k.lower()) + r"s?\b") for k in area["keywords"]]
        out.append((area["key"], pats))
    return tuple(out)


def area_scores(text: str) -> dict[str, int]:
    """Count keyword hits per technology area for a piece of text."""
    lowered = (text or "").lower()
    scores: dict[str, int] = {}
    for key, pats in _cached_patterns():
        hits = sum(1 for p in pats if p.search(lowered))
        if hits:
            scores[key] = hits
    return scores


def classify_text(text: str, max_areas: int = 3) -> list[str]:
    """Return the most likely technology areas for a text (keyword-based, deterministic)."""
    scores = area_scores(text)
    ranked = sorted(scores.items(), key=lambda kv: (-kv[1], kv[0]))
    return [k for k, _ in ranked[:max_areas]]


def classify_cpc(code: str | None) -> str | None:
    """Map a CPC classification code to a technology area using the longest matching prefix."""
    if not code:
        return None
    normalised = code.upper().replace(" ", "")
    best, best_len = None, 0
    for area in areas():
        for prefix in area["cpc_prefixes"]:
            p = prefix.upper().replace(" ", "")
            if normalised.startswith(p) and len(p) > best_len:
                best, best_len = area["key"], len(p)
    return best


def options_payload() -> dict:
    area_list = [{"key": a["key"], "name": a["name"]} for a in areas()]
    return {
        "domains": area_list,
        "technology_areas": area_list,
        "organization_types": [{"key": k, "name": v} for k, v in ORGANIZATION_TYPES.items()],
        "career_stages": [{"key": k, "name": v} for k, v in CAREER_STAGES.items()],
        "applicant_types": [{"key": k, "name": v} for k, v in APPLICANT_TYPES.items()],
        "funder_types": [{"key": k, "name": v} for k, v in FUNDER_TYPES.items()],
        "project_stages": [{"key": k, "name": v} for k, v in PROJECT_STAGES.items()],
        "market_sizes": [{"key": k, "name": v} for k, v in MARKET_SIZES.items()],
        "countries": COUNTRIES,
    }
