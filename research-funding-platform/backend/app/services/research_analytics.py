"""Research trend intelligence: publication trends, emerging topics, hotspots and citation analytics."""
from __future__ import annotations

import math
import threading
from collections import Counter
from datetime import datetime, timezone

import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.feature_extraction.text import CountVectorizer
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core import taxonomy
from app.ml.stats import cagr, minmax, trend_label
from app.ml.text import STOP_WORDS, TOKEN_PATTERN, make_vectorizer, top_terms
from app.models import Publication, TrendPoint, User
from app.schemas.common import paginate_meta
from app.schemas.profile import PublicationOut
from app.services.external import openalex
from app.services.external.http import ExternalServiceError
from app.services.profile_service import h_index

_cache: dict = {}
_cache_lock = threading.Lock()


def _corpus(db: Session, domain: str | None = None) -> list[Publication]:
    stmt = select(Publication).where(Publication.owner_id.is_(None))
    if domain:
        stmt = stmt.where(Publication.domain == domain)
    return db.execute(stmt).scalars().all()


def _signature(db: Session) -> tuple:
    return tuple(db.execute(select(func.count(Publication.id), func.max(Publication.id))
                            .where(Publication.owner_id.is_(None))).one())


def _cached(db: Session, key: str, builder):
    sig = _signature(db)
    with _cache_lock:
        hit = _cache.get(key)
        if hit and hit[0] == sig:
            return hit[1]
    value = builder()
    with _cache_lock:
        _cache[key] = (sig, value)
    return value


def _doc_text(p: Publication) -> str:
    return f"{p.title} {' '.join(p.keywords or [])} {(p.abstract or '')[:700]}"


def _last_complete_year() -> int:
    return datetime.now(timezone.utc).year - 1


# ---------------------------------------------------------------- overview & trends
def overview(db: Session) -> dict:
    pubs = _corpus(db)
    years = [p.year for p in pubs if p.year]
    domains = Counter(p.domain for p in pubs if p.domain)
    sources = Counter(p.source for p in pubs)
    total_cit = sum(p.citation_count or 0 for p in pubs)
    trend_points = db.execute(select(func.count(TrendPoint.id))).scalar_one()
    return {
        "total_publications": len(pubs),
        "total_citations": int(total_cit),
        "avg_citations": round(total_cit / len(pubs), 1) if pubs else 0,
        "domains_covered": len(domains),
        "year_range": [min(years), max(years)] if years else None,
        "top_domain": taxonomy.area_name(domains.most_common(1)[0][0]) if domains else None,
        "sources": [{"source": s, "count": c} for s, c in sources.most_common()],
        "trend_points": trend_points,
    }


def _trend_series(db: Session) -> tuple[dict[str, dict[int, int]], str, str | None]:
    rows = db.execute(select(TrendPoint)).scalars().all()
    if rows:
        series: dict[str, dict[int, int]] = {}
        retrieved = None
        for r in rows:
            series.setdefault(r.area_key, {})[r.year] = r.count
            if r.retrieved_at and (retrieved is None or r.retrieved_at > retrieved):
                retrieved = r.retrieved_at
        return series, "openalex_snapshot", retrieved.isoformat() + "Z" if retrieved else None
    series = {}
    for p in _corpus(db):
        if p.domain and p.year:
            series.setdefault(p.domain, {}).setdefault(p.year, 0)
            series[p.domain][p.year] += 1
    return series, "local_corpus", None


def growth_table(db: Session) -> list[dict]:
    series, _, _ = _trend_series(db)
    end = _last_complete_year()
    out = []
    for key, s in series.items():
        g = cagr(s, end)
        out.append({"domain": key, "name": taxonomy.area_name(key), "cagr": g,
                    "total": int(sum(s.values())), "recent": int(sum(v for y, v in s.items() if y > end - 5)),
                    "trend": trend_label(g)})
    out.sort(key=lambda r: -(r["cagr"] or -999))
    return out


def trends(db: Session, domains: list[str] | None, start_year: int | None, end_year: int | None) -> dict:
    series, source, retrieved = _trend_series(db)
    data_years = [y for s in series.values() for y in s]
    end_year = end_year or _last_complete_year()
    if data_years:
        end_year = min(end_year, max(data_years))  # never extend the axis past the last year with data
    start_year = start_year or (end_year - 11)
    if not domains:
        ranked = sorted(series.items(), key=lambda kv: -sum(kv[1].values()))
        domains = [k for k, _ in ranked[:5]]
    domains = [d for d in domains if d in series]
    rows = []
    for year in range(start_year, end_year + 1):
        row = {"year": year}
        for d in domains:
            row[d] = int(series[d].get(year, 0))
        rows.append(row)
    growth = [g for g in growth_table(db) if g["domain"] in domains]
    return {"domains": [{"key": d, "name": taxonomy.area_name(d)} for d in domains], "series": rows,
            "growth": growth, "source": source, "retrieved_at": retrieved}


# ---------------------------------------------------------------- emerging topics
def emerging_topics(db: Session, domain: str | None = None, limit: int = 15) -> dict:
    def build():
        pubs = [p for p in _corpus(db, domain) if p.year]
        if len(pubs) < 10:
            return {"items": [], "window": None, "method": "Not enough publications in the corpus"}
        max_year = min(max(p.year for p in pubs), _last_complete_year())
        recent = (max_year - 4, max_year)
        previous = (max_year - 8, max_year - 5)
        rec_docs = [p for p in pubs if recent[0] <= p.year <= recent[1]]
        prev_docs = [p for p in pubs if previous[0] <= p.year <= previous[1]]
        if not rec_docs or not prev_docs:
            return {"items": [], "window": {"recent": list(recent), "previous": list(previous)},
                    "method": "Both time windows need publications"}
        vec = CountVectorizer(binary=True, ngram_range=(1, 2), min_df=4, stop_words=STOP_WORDS,
                              token_pattern=TOKEN_PATTERN, strip_accents="unicode")
        docs = rec_docs + prev_docs
        matrix = vec.fit_transform([_doc_text(p) for p in docs])
        terms = vec.get_feature_names_out()
        n_rec, n_prev = len(rec_docs), len(prev_docs)
        rec_counts = np.asarray(matrix[:n_rec].sum(axis=0)).ravel()
        prev_counts = np.asarray(matrix[n_rec:].sum(axis=0)).ravel()
        rec_share = rec_counts / n_rec
        prev_share = np.maximum(prev_counts / n_prev, 1.0 / n_prev)  # smoothing for unseen terms
        growth = (rec_share - prev_share) / prev_share
        score = growth * np.sqrt(rec_counts)
        order = np.argsort(score)[::-1]
        items = []
        for i in order:
            if rec_counts[i] < 4 or growth[i] <= 0:
                continue
            term = terms[i]
            if any(term in it["term"].split() or it["term"] in term.split() for it in items):
                continue
            doc_idx = matrix[:n_rec, i].nonzero()[0]
            doms = Counter(rec_docs[j].domain for j in doc_idx if rec_docs[j].domain)
            items.append({"term": term, "recent_count": int(rec_counts[i]), "previous_count": int(prev_counts[i]),
                          "growth_rate": round(float(growth[i]) * 100, 1), "score": round(float(score[i]), 3),
                          "domains": [taxonomy.area_name(d) for d, _ in doms.most_common(2)]})
            if len(items) >= 40:
                break
        return {"items": items, "window": {"recent": list(recent), "previous": list(previous)},
                "method": "Document-frequency growth of terms (uni/bi-grams) between the two windows, normalised by "
                          "window size with add-one smoothing; score = growth x sqrt(recent count)."}

    result = _cached(db, f"emerging:{domain}", build)
    return {**result, "items": result["items"][:limit]}


# ---------------------------------------------------------------- hotspots
def hotspots(db: Session, limit: int = 8) -> dict:
    def build():
        pubs = _corpus(db)
        if len(pubs) < 30:
            return {"items": [], "method": "Not enough publications for clustering"}
        texts = [_doc_text(p) for p in pubs]
        vec = make_vectorizer(max_features=8000, min_df=2)
        X = vec.fit_transform(texts)
        k = max(4, min(12, len(pubs) // 60))
        km = KMeans(n_clusters=k, n_init=5, random_state=42)
        labels = km.fit_predict(X)
        features = vec.get_feature_names_out()
        max_year = _last_complete_year()
        clusters = []
        for c in range(k):
            members = [pubs[i] for i in np.where(labels == c)[0]]
            if not members:
                continue
            terms = top_terms(km.cluster_centers_[c], features, 6)
            cits = [m.citation_count or 0 for m in members]
            recent = [m for m in members if m.year and m.year >= max_year - 4]
            doms = Counter(m.domain for m in members if m.domain)
            clusters.append({
                "label": " / ".join(terms[:3]).title(), "top_terms": terms, "size": len(members),
                "avg_citations": round(float(np.mean(cits)), 1), "recent_share": round(len(recent) / len(members), 3),
                "domain": taxonomy.area_name(doms.most_common(1)[0][0]) if doms else None,
                "sample_titles": [m.title for m in sorted(members, key=lambda m: -(m.citation_count or 0))[:3]],
            })
        cit_n = minmax({str(i): math.log1p(c["avg_citations"]) for i, c in enumerate(clusters)})
        size_n = minmax({str(i): c["size"] for i, c in enumerate(clusters)})
        for i, c in enumerate(clusters):
            c["hotspot_score"] = round(100 * (0.4 * cit_n[str(i)] + 0.4 * c["recent_share"] + 0.2 * size_n[str(i)]), 1)
        clusters.sort(key=lambda c: -c["hotspot_score"])
        return {"items": clusters, "method": f"K-means (k={k}) on TF-IDF of titles, keywords and abstracts. "
                "Hotspot score = 40% citation impact (log, normalised) + 40% share of works from the last five "
                "years + 20% cluster size."}

    result = _cached(db, "hotspots", build)
    return {**result, "items": result["items"][:limit]}


# ---------------------------------------------------------------- citations
def citations(db: Session, domain: str | None = None) -> dict:
    pubs = _corpus(db, domain)
    if not pubs:
        return {"by_year": [], "by_domain": [], "distribution": [], "top_cited": []}
    df = pd.DataFrame([{"year": p.year, "domain": p.domain, "citations": p.citation_count or 0} for p in pubs])
    by_year = (df.dropna(subset=["year"]).groupby("year")
               .agg(publications=("citations", "size"), citations=("citations", "sum")).reset_index())
    by_year["avg_citations"] = (by_year["citations"] / by_year["publications"]).round(1)
    by_domain = (df.dropna(subset=["domain"]).groupby("domain")
                 .agg(publications=("citations", "size"), citations=("citations", "sum")).reset_index())
    by_domain["avg_citations"] = (by_domain["citations"] / by_domain["publications"]).round(1)
    by_domain = by_domain.sort_values("citations", ascending=False)
    bins = [-1, 0, 9, 49, 99, 499, 999, float("inf")]
    labels = ["0", "1-9", "10-49", "50-99", "100-499", "500-999", "1000+"]
    dist = pd.cut(df["citations"], bins=bins, labels=labels).value_counts().reindex(labels, fill_value=0)
    top = sorted(pubs, key=lambda p: -(p.citation_count or 0))[:10]
    return {
        "by_year": [{"year": int(r.year), "publications": int(r.publications), "citations": int(r.citations),
                     "avg_citations": float(r.avg_citations)} for r in by_year.itertuples()],
        "by_domain": [{"domain": r.domain, "name": taxonomy.area_name(r.domain), "publications": int(r.publications),
                       "citations": int(r.citations), "avg_citations": float(r.avg_citations)}
                      for r in by_domain.itertuples()],
        "distribution": [{"bucket": k, "count": int(v)} for k, v in dist.items()],
        "top_cited": [PublicationOut.from_model(p).model_dump(mode="json") for p in top],
    }


# ---------------------------------------------------------------- search
def search_publications(db: Session, q: str | None, domain: str | None, year_from: int | None, year_to: int | None,
                        sort: str, page: int, page_size: int) -> dict:
    stmt = select(Publication).where(Publication.owner_id.is_(None))
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(or_(Publication.title.ilike(like), Publication.abstract.ilike(like),
                              Publication.venue.ilike(like)))
    if domain:
        stmt = stmt.where(Publication.domain == domain)
    if year_from:
        stmt = stmt.where(Publication.year >= year_from)
    if year_to:
        stmt = stmt.where(Publication.year <= year_to)
    total = db.execute(select(func.count()).select_from(stmt.subquery())).scalar_one()
    order = {"year": Publication.year.desc().nulls_last(), "title": Publication.title.asc()}.get(
        sort, Publication.citation_count.desc())
    rows = db.execute(stmt.order_by(order, Publication.id).offset((page - 1) * page_size).limit(page_size)).scalars().all()
    return {"items": [PublicationOut.from_model(p).model_dump(mode="json") for p in rows],
            **paginate_meta(total, page, page_size)}


# ---------------------------------------------------------------- live trend
def live_trend(db: Session, query: str, start_year: int | None, end_year: int | None) -> dict:
    end_year = end_year or _last_complete_year()
    start_year = start_year or end_year - 9
    fetched = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    try:
        series = openalex.yearly_counts(query, start_year, end_year)
        return {"query": query, "source": "openalex", "series": series, "total": sum(p["count"] for p in series),
                "fetched_at": fetched, "note": "Live global counts from OpenAlex (works whose title or abstract "
                                               "match the query)."}
    except ExternalServiceError as exc:
        tokens = [t for t in query.lower().split() if len(t) > 2]
        counts: Counter = Counter()
        for p in _corpus(db):
            text = _doc_text(p).lower()
            if p.year and tokens and all(t in text for t in tokens):
                counts[p.year] += 1
        series = [{"year": y, "count": counts.get(y, 0)} for y in range(start_year, end_year + 1)]
        return {"query": query, "source": "local_fallback", "series": series, "total": sum(counts.values()),
                "fetched_at": fetched,
                "note": f"OpenAlex unavailable ({exc}). Showing matches in the local publication sample instead — "
                        "absolute numbers are much smaller than global counts."}


# ---------------------------------------------------------------- personal analytics
def my_analytics(db: Session, user: User) -> dict:
    pubs = db.execute(select(Publication).where(Publication.owner_id == user.id)).scalars().all()
    cits = [p.citation_count or 0 for p in pubs]
    by_year: dict[int, dict] = {}
    for p in pubs:
        if p.year:
            row = by_year.setdefault(p.year, {"year": p.year, "publications": 0, "citations": 0})
            row["publications"] += 1
            row["citations"] += p.citation_count or 0
    doms = Counter(p.domain for p in pubs if p.domain)
    return {
        "total_publications": len(pubs),
        "total_citations": int(sum(cits)),
        "h_index": h_index(cits),
        "i10_index": sum(1 for c in cits if c >= 10),
        "by_year": [by_year[y] for y in sorted(by_year)],
        "top": [PublicationOut.from_model(p).model_dump(mode="json")
                for p in sorted(pubs, key=lambda p: -(p.citation_count or 0))[:5]],
        "by_domain": [{"domain": d, "name": taxonomy.area_name(d), "count": c} for d, c in doms.most_common()],
    }


def invalidate_cache() -> None:
    with _cache_lock:
        _cache.clear()
