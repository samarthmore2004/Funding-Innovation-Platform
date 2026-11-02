"""Technology intelligence: emerging-technology identification, maturity, adoption, opportunity discovery and
competitive monitoring — derived from publication trends, the patent dataset and the funding catalogue.

All indicators are relative (min-max normalised across the taxonomy areas) and therefore describe how areas
compare with each other inside this platform's data, not absolute market facts.
"""
from __future__ import annotations

import math
from collections import Counter, defaultdict
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import taxonomy
from app.ml.stats import cagr, minmax
from app.models import FundingOpportunity, Patent, Publication
from app.schemas.funding import FundingOut
from app.schemas.profile import PublicationOut
from app.services import patent_analytics, research_analytics
from app.services.recommender import ACTIVE_STATUSES


def _stage(maturity: float) -> str:
    if maturity < 30:
        return "Emerging"
    if maturity < 50:
        return "Growing"
    if maturity < 70:
        return "Maturing"
    return "Established"


def _raw(db: Session) -> dict:
    pub_series, pub_source, _ = research_analytics._trend_series(db)
    pat_series = patent_analytics.yearly_counts_by_domain(db)
    pub_end = datetime.now(timezone.utc).year - 1
    pat_years = [y for s in pat_series.values() for y in s]
    pat_end = max(pat_years) if pat_years else pub_end
    funding_counts = Counter()
    for f in db.execute(select(FundingOpportunity).where(FundingOpportunity.status.in_(ACTIVE_STATUSES))).scalars():
        for d in f.domains or []:
            funding_counts[d] += 1
    assignees: dict[str, Counter] = defaultdict(Counter)
    recent_assignees: dict[str, Counter] = defaultdict(Counter)
    for p in db.execute(select(Patent).where(Patent.owner_id.is_(None))).scalars():
        if p.technology_domain:
            assignees[p.technology_domain][p.assignee or "Unassigned"] += 1
            if p.filing_date and p.filing_date.year > pat_end - 3:
                recent_assignees[p.technology_domain][p.assignee or "Unassigned"] += 1
    return {"pub_series": pub_series, "pub_source": pub_source, "pat_series": pat_series, "pub_end": pub_end,
            "pat_end": pat_end, "funding": funding_counts, "assignees": assignees, "recent": recent_assignees}


def area_metrics(db: Session) -> list[dict]:
    raw = _raw(db)
    keys = taxonomy.area_keys()
    pub_count, pub_cagr, pat_count, pat_cagr, density, n_assignees, recent_pat = {}, {}, {}, {}, {}, {}, {}
    for k in keys:
        ps = raw["pub_series"].get(k, {})
        ts = raw["pat_series"].get(k, {})
        pub_count[k] = sum(v for y, v in ps.items() if y > raw["pub_end"] - 5)
        pub_cagr[k] = cagr(ps, raw["pub_end"]) if ps else None
        pat_count[k] = sum(ts.values())
        pat_cagr[k] = cagr(ts, raw["pat_end"]) if ts else None
        density[k] = pat_count[k] / pub_count[k] if pub_count[k] else None
        n_assignees[k] = len(raw["assignees"].get(k, {}))
        recent_pat[k] = sum(raw["recent"].get(k, Counter()).values())
    n_pub_cagr, n_pat_cagr = minmax(pub_cagr), minmax(pat_cagr)
    n_density, n_pat_count = minmax(density), minmax(pat_count)
    n_pub_volume = minmax({k: math.log1p(v) for k, v in pub_count.items()})
    n_assign, n_recent = minmax(n_assignees), minmax(recent_pat)
    n_funding = minmax({k: raw["funding"].get(k, 0) for k in keys})
    items = []
    for k in keys:
        area = taxonomy.area_by_key(k)
        # mature fields: many patents relative to papers, large patent and literature volume, slower growth
        maturity = 100 * (0.35 * n_density[k] + 0.25 * n_pat_count[k] + 0.25 * n_pub_volume[k]
                          + 0.15 * (1 - n_pub_cagr[k]))
        items.append({
            "key": k, "name": area["name"], "description": area["description"],
            "publication_count": int(pub_count[k]), "publication_cagr": pub_cagr[k],
            "patent_count": int(pat_count[k]), "patent_cagr": pat_cagr[k],
            "funding_count": int(raw["funding"].get(k, 0)),
            "maturity_index": round(maturity, 1), "maturity_stage": _stage(maturity),
            "emerging_score": round(100 * (0.6 * n_pub_cagr[k] + 0.4 * n_pat_cagr[k]), 1),
            "adoption_index": round(100 * (0.5 * n_assign[k] + 0.5 * n_recent[k]), 1),
            "opportunity_score": round(100 * (0.45 * n_pub_cagr[k] + 0.30 * (1 - n_density[k]) + 0.25 * n_funding[k]), 1),
            "assignee_count": n_assignees[k],
            "top_assignees": [a for a, _ in raw["assignees"].get(k, Counter()).most_common(3)],
            "_research_momentum": round(100 * n_pub_cagr[k], 1), "_patent_density": round(100 * n_density[k], 1),
            "_funding_availability": round(100 * n_funding[k], 1),
        })
    return items


def _public(item: dict) -> dict:
    return {k: v for k, v in item.items() if not k.startswith("_")}


def notes(db: Session) -> list[str]:
    raw_types = Counter(r for (r,) in db.execute(select(Patent.record_type).where(Patent.owner_id.is_(None))).all())
    out = ["Indicators are relative scores (0-100) comparing technology areas within this platform's data.",
           "Publication growth uses yearly global counts from the OpenAlex snapshot (title/abstract keyword queries)."]
    if raw_types.get("illustrative"):
        out.append(f"Patent-based indicators use {raw_types['illustrative']} illustrative sample patents unless real "
                   "patent data is imported by an administrator.")
    return out


def list_areas(db: Session) -> dict:
    return {"items": [_public(i) for i in area_metrics(db)], "notes": notes(db)}


def area_detail(db: Session, key: str) -> dict | None:
    area = taxonomy.area_by_key(key)
    if not area:
        return None
    item = next(i for i in area_metrics(db) if i["key"] == key)
    raw_pub, _, _ = research_analytics._trend_series(db)
    pat = patent_analytics.yearly_counts_by_domain(db).get(key, {})
    pub_s = raw_pub.get(key, {})
    funding = db.execute(select(FundingOpportunity).where(FundingOpportunity.status.in_(ACTIVE_STATUSES))
                         .order_by(FundingOpportunity.deadline.asc().nulls_last())).scalars().all()
    funding = [f for f in funding if key in (f.domains or [])][:8]
    pubs = db.execute(select(Publication).where(Publication.owner_id.is_(None), Publication.domain == key)
                      .order_by(Publication.citation_count.desc()).limit(8)).scalars().all()
    comp = competitive(db, key)
    return {
        **_public(item),
        "publication_series": [{"year": y, "count": int(pub_s[y])} for y in sorted(pub_s)],
        "patent_series": [{"year": y, "count": int(pat[y])} for y in sorted(pat)],
        "top_assignee_details": comp["assignees"][:8],
        "funding": [FundingOut.from_model(f).model_dump(mode="json") for f in funding],
        "top_publications": [PublicationOut.from_model(p).model_dump(mode="json") for p in pubs],
        "keywords": area["keywords"],
    }


def emerging(db: Session) -> dict:
    items = sorted(area_metrics(db), key=lambda i: -i["emerging_score"])
    return {"items": [_public(i) for i in items]}


def opportunities(db: Session) -> dict:
    out = []
    for i in sorted(area_metrics(db), key=lambda i: -i["opportunity_score"]):
        rationale = []
        if i["publication_cagr"] is not None:
            rationale.append(f"Research output growing {i['publication_cagr']:.1f}% per year (5-year CAGR)")
        if i["_patent_density"] < 40:
            rationale.append("Relatively low patent density compared with research volume — potential IP white space")
        elif i["_patent_density"] > 70:
            rationale.append("Crowded patent landscape — freedom-to-operate analysis recommended")
        if i["funding_count"]:
            rationale.append(f"{i['funding_count']} active funding opportunities in the catalogue")
        if i["assignee_count"] <= 3:
            rationale.append("Few active patent assignees — limited incumbent competition in the dataset")
        out.append({"key": i["key"], "name": i["name"], "opportunity_score": i["opportunity_score"],
                    "research_momentum": i["_research_momentum"], "patent_density": i["_patent_density"],
                    "funding_availability": i["_funding_availability"], "rationale": rationale})
    return {"items": out}


def adoption(db: Session) -> dict:
    series = patent_analytics.yearly_counts_by_domain(db)
    years = sorted({y for s in series.values() for y in s})
    rows, running = [], defaultdict(int)
    for y in years:
        row = {"year": y}
        for k, s in series.items():
            running[k] += s.get(y, 0)
            row[k] = running[k]
        rows.append(row)
    metrics = {i["key"]: i for i in area_metrics(db)}
    return {
        "areas": [{"key": k, "name": taxonomy.area_name(k)} for k in series],
        "series": rows,
        "assignee_diversity": sorted(
            [{"key": k, "name": taxonomy.area_name(k), "assignees": metrics[k]["assignee_count"]}
             for k in series if k in metrics], key=lambda r: -r["assignees"]),
    }


def competitive(db: Session, key: str) -> dict:
    patents = db.execute(select(Patent).where(Patent.owner_id.is_(None), Patent.technology_domain == key)).scalars().all()
    years = [p.filing_date.year for p in patents if p.filing_date]
    max_year = max(years) if years else None
    total = len(patents) or 1
    by_assignee: dict[str, list[Patent]] = defaultdict(list)
    for p in patents:
        by_assignee[p.assignee or "Unassigned"].append(p)
    rows = []
    for name, items in by_assignee.items():
        recent = sum(1 for p in items if p.filing_date and max_year and p.filing_date.year > max_year - 3)
        earlier = sum(1 for p in items if p.filing_date and max_year and max_year - 6 < p.filing_date.year <= max_year - 3)
        momentum = "accelerating" if recent > earlier else ("slowing" if recent < earlier else "steady")
        rows.append({"assignee": name, "patents": len(items), "recent_patents": recent,
                     "share": round(len(items) / total, 3), "momentum": momentum})
    rows.sort(key=lambda r: -r["patents"])
    return {"area": key, "name": taxonomy.area_name(key), "assignees": rows}
