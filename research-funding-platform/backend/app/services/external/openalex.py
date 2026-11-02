"""OpenAlex client (https://docs.openalex.org). Works without a key on a small shared daily
budget; set OPENALEX_API_KEY for a personal quota. OpenAlex data is CC0-licensed."""
from __future__ import annotations

from datetime import date

from app.core import taxonomy
from app.core.config import get_settings
from app.services.external.http import ExternalServiceError, get_json

BASE_URL = "https://api.openalex.org"
WORK_FIELDS = ("id,doi,title,publication_year,publication_date,cited_by_count,authorships,"
               "primary_location,keywords,type,abstract_inverted_index")


def _params(extra: dict) -> dict:
    settings = get_settings()
    params = dict(extra)
    if settings.openalex_api_key:
        params["api_key"] = settings.openalex_api_key
    if settings.openalex_mailto:
        params["mailto"] = settings.openalex_mailto
    return params


def _search_filter(query: str) -> str:
    # Commas separate filters in OpenAlex, so strip them from free-text queries.
    return "title_and_abstract.search:" + query.replace(",", " ")


def yearly_counts(query: str, start_year: int, end_year: int) -> list[dict]:
    flt = f"{_search_filter(query)},publication_year:{start_year}-{end_year}"
    data = get_json("OpenAlex", f"{BASE_URL}/works", _params({"filter": flt, "group_by": "publication_year"}))
    groups = data.get("group_by")
    if groups is None:
        raise ExternalServiceError("OpenAlex: unexpected group_by response")
    counts = {int(g["key"]): int(g["count"]) for g in groups if str(g.get("key", "")).isdigit()}
    return [{"year": y, "count": counts.get(y, 0)} for y in range(start_year, end_year + 1)]


def search_works(query: str, from_year: int, to_year: int, per_page: int = 25,
                 sort: str = "cited_by_count:desc") -> list[dict]:
    flt = f"{_search_filter(query)},publication_year:{from_year}-{to_year}"
    data = get_json("OpenAlex", f"{BASE_URL}/works",
                    _params({"filter": flt, "sort": sort, "per-page": min(per_page, 200), "select": WORK_FIELDS}))
    return data.get("results") or []


def get_work_by_doi(doi: str) -> dict | None:
    doi = normalise_doi(doi)
    try:
        return get_json("OpenAlex", f"{BASE_URL}/works/https://doi.org/{doi}", _params({"select": WORK_FIELDS}))
    except ExternalServiceError as exc:
        if "404" in str(exc):
            return None
        raise


def normalise_doi(doi: str) -> str:
    doi = (doi or "").strip()
    for prefix in ("https://doi.org/", "http://doi.org/", "https://dx.doi.org/", "doi:", "DOI:"):
        if doi.startswith(prefix):
            doi = doi[len(prefix):]
    return doi.strip()


def reconstruct_abstract(inverted: dict | None, max_chars: int = 1500) -> str:
    if not inverted:
        return ""
    positions: list[tuple[int, str]] = []
    for word, idxs in inverted.items():
        for i in idxs:
            positions.append((i, word))
    positions.sort()
    return " ".join(w for _, w in positions)[:max_chars]


def to_publication_record(work: dict, domain_hint: str | None = None) -> dict:
    title = work.get("title") or work.get("display_name") or "Untitled"
    abstract = reconstruct_abstract(work.get("abstract_inverted_index"))
    keywords = [k.get("display_name") for k in (work.get("keywords") or []) if k.get("display_name")][:8]
    domains = taxonomy.classify_text(f"{title} {abstract} {' '.join(keywords)}", max_areas=1)
    domain = domain_hint or (domains[0] if domains else None)
    source = ((work.get("primary_location") or {}).get("source") or {})
    pub_date = work.get("publication_date")
    try:
        if pub_date:
            date.fromisoformat(pub_date)
    except ValueError:
        pub_date = None
    doi = work.get("doi")
    return {
        "title": title[:500],
        "abstract": abstract,
        "authors": [a["author"]["display_name"] for a in (work.get("authorships") or [])
                    if (a.get("author") or {}).get("display_name")][:12],
        "venue": (source.get("display_name") or "")[:300],
        "year": work.get("publication_year"),
        "publication_date": pub_date,
        "doi": normalise_doi(doi) if doi else None,
        "url": doi or work.get("id"),
        "citation_count": int(work.get("cited_by_count") or 0),
        "domain": domain,
        "keywords": keywords,
        "pub_type": work.get("type") or "article",
        "source": "openalex",
        "external_id": (work.get("id") or "").rsplit("/", 1)[-1] or None,
    }
