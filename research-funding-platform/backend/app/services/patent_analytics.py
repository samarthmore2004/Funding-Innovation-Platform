"""Patent landscape analysis: search, trends, assignee/competitor analytics, clustering and innovation map."""
from __future__ import annotations

import threading
from collections import Counter
from datetime import date

import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.decomposition import TruncatedSVD
from sklearn.metrics import silhouette_score
from sklearn.metrics.pairwise import cosine_similarity
from sqlalchemy import extract, func, or_, select
from sqlalchemy.orm import Session

from app.core import taxonomy
from app.ml.text import PATENT_BOILERPLATE, make_vectorizer, top_terms
from app.models import Patent
from app.schemas.common import paginate_meta
from app.schemas.profile import PatentOut

_cache: dict = {}
_lock = threading.Lock()


def _base():
    return select(Patent).where(Patent.owner_id.is_(None))


def _corpus(db: Session, domain: str | None = None) -> list[Patent]:
    stmt = _base()
    if domain:
        stmt = stmt.where(Patent.technology_domain == domain)
    return db.execute(stmt).scalars().all()


def _signature(db: Session) -> tuple:
    return tuple(db.execute(select(func.count(Patent.id), func.max(Patent.id)).where(Patent.owner_id.is_(None))).one())


def _frame(patents: list[Patent]) -> pd.DataFrame:
    return pd.DataFrame([{
        "id": p.id, "assignee": p.assignee or "Unassigned", "domain": p.technology_domain,
        "year": p.filing_date.year if p.filing_date else None, "citations": p.citation_count or 0,
        "classification": (p.classification or "").split("/")[0].strip() or None, "status": p.status,
    } for p in patents])


def _text(p: Patent) -> str:
    return f"{p.title} {p.title} {p.abstract or ''} {' '.join(p.keywords or [])}"


# ---------------------------------------------------------------- search & facets
def search(db: Session, q, assignee, classification, domain, status, year_from, year_to, sort, page, page_size) -> dict:
    stmt = _base()
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(or_(Patent.title.ilike(like), Patent.abstract.ilike(like), Patent.assignee.ilike(like),
                              Patent.patent_number.ilike(like)))
    if assignee:
        stmt = stmt.where(Patent.assignee == assignee)
    if classification:
        stmt = stmt.where(Patent.classification.ilike(f"{classification.strip()}%"))
    if domain:
        stmt = stmt.where(Patent.technology_domain == domain)
    if status:
        stmt = stmt.where(Patent.status == status)
    if year_from:
        stmt = stmt.where(Patent.filing_date >= date(year_from, 1, 1))
    if year_to:
        stmt = stmt.where(Patent.filing_date <= date(year_to, 12, 31))
    total = db.execute(select(func.count()).select_from(stmt.subquery())).scalar_one()
    order = {"citations": Patent.citation_count.desc(), "title": Patent.title.asc()}.get(
        sort, Patent.filing_date.desc().nulls_last())
    rows = db.execute(stmt.order_by(order, Patent.id).offset((page - 1) * page_size).limit(page_size)).scalars().all()
    return {"items": [PatentOut.from_model(p).model_dump(mode="json") for p in rows],
            **paginate_meta(total, page, page_size)}


def facets(db: Session) -> dict:
    patents = _corpus(db)
    df = _frame(patents)
    if df.empty:
        return {"domains": [], "assignees": [], "classifications": [], "statuses": [], "record_types": []}
    doms = df["domain"].dropna().value_counts()
    return {
        "domains": [{"value": k, "label": taxonomy.area_name(k), "count": int(v)} for k, v in doms.items()],
        "assignees": [{"value": k, "count": int(v)} for k, v in df["assignee"].value_counts().head(40).items()],
        "classifications": [{"value": k, "count": int(v)}
                            for k, v in df["classification"].dropna().value_counts().head(40).items()],
        "statuses": [{"value": k, "count": int(v)} for k, v in df["status"].value_counts().items()],
        "record_types": [{"value": k, "count": int(v)} for k, v in Counter(p.record_type for p in patents).items()],
    }


def get_with_similar(db: Session, patent: Patent, n: int = 5) -> dict:
    out = PatentOut.from_model(patent).model_dump(mode="json")
    corpus = [p for p in _corpus(db) if p.id != patent.id]
    similar = []
    if corpus:
        vec = make_vectorizer(max_features=8000, extra_stop_words=PATENT_BOILERPLATE)
        X = vec.fit_transform([_text(p) for p in corpus] + [_text(patent)])
        sims = cosine_similarity(X[-1], X[:-1]).ravel()
        for i in np.argsort(sims)[::-1][:n]:
            item = PatentOut.from_model(corpus[i]).model_dump(mode="json")
            item["similarity"] = round(float(sims[i]), 3)
            similar.append(item)
    out["similar"] = similar
    return out


# ---------------------------------------------------------------- trends & assignees
def trends(db: Session, domain: str | None = None) -> dict:
    df = _frame(_corpus(db, domain)).dropna(subset=["year"])
    if df.empty:
        return {"domains": [], "series": []}
    df["year"] = df["year"].astype(int)
    pivot = df.pivot_table(index="year", columns="domain", values="id", aggfunc="count", fill_value=0)
    years = range(int(df["year"].min()), int(df["year"].max()) + 1)
    pivot = pivot.reindex(years, fill_value=0)
    domains = [d for d in pivot.columns if d]
    series = []
    for year, row in pivot.iterrows():
        entry = {"year": int(year), "total": int(row.sum())}
        for d in domains:
            entry[d] = int(row[d])
        series.append(entry)
    return {"domains": [{"key": d, "name": taxonomy.area_name(d)} for d in domains], "series": series}


def assignees(db: Session, domain: str | None = None, limit: int = 10) -> dict:
    df = _frame(_corpus(db, domain))
    if df.empty:
        return {"items": []}
    max_year = int(df["year"].dropna().max()) if df["year"].notna().any() else None
    items = []
    for name, g in df.groupby("assignee"):
        years = g["year"].dropna()
        doms = g["domain"].dropna().value_counts()
        recent = int((years >= max_year - 2).sum()) if max_year else 0
        items.append({
            "assignee": name, "patents": int(len(g)), "citations": int(g["citations"].sum()),
            "avg_citations": round(float(g["citations"].mean()), 1),
            "top_domain": taxonomy.area_name(doms.index[0]) if len(doms) else None,
            "domains": {k: int(v) for k, v in doms.items()},
            "first_year": int(years.min()) if len(years) else None, "last_year": int(years.max()) if len(years) else None,
            "recent_share": round(recent / len(g), 3),
        })
    items.sort(key=lambda r: (-r["patents"], -r["citations"]))
    return {"items": items[:limit]}


def competitors(db: Session, names: list[str]) -> dict:
    names = [n for n in dict.fromkeys(n.strip() for n in names) if n][:5]
    df = _frame(_corpus(db))
    df = df[df["assignee"].isin(names)] if not df.empty else df
    if df.empty:
        return {"assignees": names, "by_year": [], "by_domain": [], "summary": []}
    years = df["year"].dropna().astype(int)
    by_year = []
    for y in range(int(years.min()), int(years.max()) + 1):
        row = {"year": y}
        for n in names:
            row[n] = int(((df["assignee"] == n) & (df["year"] == y)).sum())
        by_year.append(row)
    by_domain = []
    for d in df["domain"].dropna().unique():
        row = {"domain": d, "name": taxonomy.area_name(d)}
        for n in names:
            row[n] = int(((df["assignee"] == n) & (df["domain"] == d)).sum())
        by_domain.append(row)
    max_year = int(years.max())
    summary = []
    for n in names:
        g = df[df["assignee"] == n]
        if g.empty:
            summary.append({"assignee": n, "patents": 0, "citations": 0, "avg_citations": 0, "top_classifications": [],
                            "growth": None})
            continue
        recent = int((g["year"] > max_year - 3).sum())
        earlier = int(((g["year"] <= max_year - 3) & (g["year"] > max_year - 6)).sum())
        growth = round(100 * (recent - earlier) / earlier, 1) if earlier else None
        summary.append({"assignee": n, "patents": int(len(g)), "citations": int(g["citations"].sum()),
                        "avg_citations": round(float(g["citations"].mean()), 1),
                        "top_classifications": list(g["classification"].dropna().value_counts().head(3).index),
                        "growth": growth})
    return {"assignees": names, "by_year": by_year, "by_domain": by_domain, "summary": summary}


# ---------------------------------------------------------------- clustering
def clusters(db: Session, domain: str | None = None, k: int | None = None) -> dict:
    key = f"clusters:{domain}:{k}"
    sig = _signature(db)
    with _lock:
        hit = _cache.get(key)
        if hit and hit[0] == sig:
            return hit[1]
    patents = _corpus(db, domain)
    if len(patents) < 10:
        return {"k": 0, "silhouette": None, "clusters": [], "points": [],
                "note": "At least 10 patents are needed for clustering"}
    vec = make_vectorizer(max_features=6000, extra_stop_words=PATENT_BOILERPLATE)
    X = vec.fit_transform([_text(p) for p in patents])
    features = vec.get_feature_names_out()
    candidates = [k] if k else list(range(3, min(8, len(patents) // 5) + 1))
    best = None
    for kk in candidates:
        if kk < 2 or kk >= len(patents):
            continue
        km = KMeans(n_clusters=kk, n_init=5, random_state=42)
        labels = km.fit_predict(X)
        sample = min(1500, len(patents))
        sil = float(silhouette_score(X, labels, metric="cosine", sample_size=sample, random_state=42))
        if best is None or sil > best[0]:
            best = (sil, kk, km, labels)
    sil, kk, km, labels = best
    coords = TruncatedSVD(n_components=2, random_state=42).fit_transform(X)
    result_clusters = []
    for c in range(kk):
        idx = np.where(labels == c)[0]
        members = [patents[i] for i in idx]
        terms = top_terms(km.cluster_centers_[c], features, 6)
        result_clusters.append({
            "id": int(c), "label": " / ".join(terms[:3]).title(), "top_terms": terms, "size": int(len(idx)),
            "top_assignees": [a for a, _ in Counter(m.assignee for m in members).most_common(3)],
            "avg_citations": round(float(np.mean([m.citation_count or 0 for m in members])), 1),
        })
    points = [{"id": p.id, "x": round(float(coords[i, 0]), 4), "y": round(float(coords[i, 1]), 4),
               "cluster": int(labels[i]), "title": p.title, "assignee": p.assignee} for i, p in enumerate(patents)]
    result = {"k": int(kk), "silhouette": round(sil, 3), "clusters": result_clusters, "points": points,
              "method": "TF-IDF of titles/abstracts -> K-means (k chosen by best cosine silhouette in 3..8) -> "
                        "2-D projection with truncated SVD."}
    with _lock:
        _cache[key] = (sig, result)
    return result


def innovation_map(db: Session, top_assignees: int = 10) -> dict:
    df = _frame(_corpus(db))
    if df.empty:
        return {"domains": [], "assignees": [], "cells": []}
    top = list(df["assignee"].value_counts().head(top_assignees).index)
    sub = df[df["assignee"].isin(top)].dropna(subset=["domain"])
    counts = sub.groupby(["domain", "assignee"]).size()
    domains = list(sub["domain"].value_counts().index)
    cells = [{"domain": d, "assignee": a, "count": int(counts.get((d, a), 0))} for d in domains for a in top]
    return {"domains": [{"key": d, "name": taxonomy.area_name(d)} for d in domains], "assignees": top, "cells": cells}


def yearly_counts_by_domain(db: Session) -> dict[str, dict[int, int]]:
    rows = db.execute(select(Patent.technology_domain, extract("year", Patent.filing_date), func.count(Patent.id))
                      .where(Patent.owner_id.is_(None), Patent.filing_date.is_not(None))
                      .group_by(Patent.technology_domain, extract("year", Patent.filing_date))).all()
    out: dict[str, dict[int, int]] = {}
    for dom, year, count in rows:
        if dom and year:
            out.setdefault(dom, {})[int(year)] = int(count)
    return out


def invalidate_cache() -> None:
    with _lock:
        _cache.clear()
