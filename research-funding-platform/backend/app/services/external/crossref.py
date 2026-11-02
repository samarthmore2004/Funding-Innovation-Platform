"""Crossref REST API client (https://api.crossref.org) — keyless DOI metadata lookup."""
from __future__ import annotations

import re

from app.core import taxonomy
from app.core.config import get_settings
from app.services.external.http import ExternalServiceError, get_json
from app.services.external.openalex import normalise_doi

BASE_URL = "https://api.crossref.org"


def get_work_by_doi(doi: str) -> dict | None:
    doi = normalise_doi(doi)
    params = {}
    mailto = get_settings().crossref_mailto
    if mailto:
        params["mailto"] = mailto
    try:
        data = get_json("Crossref", f"{BASE_URL}/works/{doi}", params)
    except ExternalServiceError as exc:
        if "404" in str(exc):
            return None
        raise
    return data.get("message")


def _first(values) -> str:
    if isinstance(values, list) and values:
        return str(values[0])
    return str(values or "")


def to_publication_record(item: dict) -> dict:
    title = _first(item.get("title")) or "Untitled"
    abstract = re.sub(r"<[^>]+>", " ", item.get("abstract") or "")
    abstract = re.sub(r"\s+", " ", abstract).strip()[:1500]
    authors = []
    for a in item.get("author") or []:
        name = " ".join(p for p in [a.get("given"), a.get("family")] if p) or a.get("name")
        if name:
            authors.append(name)
    parts = ((item.get("published") or item.get("issued") or {}).get("date-parts") or [[None]])[0]
    year = parts[0] if parts else None
    pub_date = None
    if year and len(parts) >= 3:
        pub_date = f"{parts[0]:04d}-{parts[1]:02d}-{parts[2]:02d}"
    subjects = item.get("subject") or []
    domains = taxonomy.classify_text(f"{title} {abstract} {' '.join(subjects)}", max_areas=1)
    doi = item.get("DOI")
    return {
        "title": title[:500],
        "abstract": abstract,
        "authors": authors[:12],
        "venue": _first(item.get("container-title"))[:300],
        "year": year,
        "publication_date": pub_date,
        "doi": doi,
        "url": f"https://doi.org/{doi}" if doi else item.get("URL"),
        "citation_count": int(item.get("is-referenced-by-count") or 0),
        "domain": domains[0] if domains else None,
        "keywords": subjects[:8],
        "pub_type": item.get("type") or "journal-article",
        "source": "crossref",
        "external_id": doi,
    }
