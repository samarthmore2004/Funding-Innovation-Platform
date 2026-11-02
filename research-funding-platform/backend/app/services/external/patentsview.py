"""USPTO PatentsView PatentSearch API client (optional; requires a free API key).

Docs: https://search.patentsview.org/docs/ . Enabled only when PATENTSVIEW_API_KEY is set.
Without a key the platform uses its local patent dataset (illustrative or admin-imported).
"""
from __future__ import annotations

from app.core import taxonomy
from app.core.config import get_settings
from app.services.external.http import ExternalServiceError, post_json

SEARCH_URL = "https://search.patentsview.org/api/v1/patent/"
FIELDS = [
    "patent_id", "patent_title", "patent_abstract", "patent_date",
    "patent_num_times_cited_by_us_patents", "assignees.assignee_organization",
    "inventors.inventor_name_first", "inventors.inventor_name_last", "cpc_current.cpc_group_id",
]


def is_configured() -> bool:
    return bool(get_settings().patentsview_api_key)


def search(query: str, size: int = 25) -> list[dict]:
    if not is_configured():
        raise ExternalServiceError("PatentsView live search requires PATENTSVIEW_API_KEY (free key from "
                                   "https://patentsview.org); the local patent dataset is used instead.")
    payload = {
        "q": {"_text_any": {"patent_title": query}},
        "f": FIELDS,
        "o": {"size": max(1, min(size, 100))},
        "s": [{"patent_date": "desc"}],
    }
    data = post_json("PatentsView", SEARCH_URL, payload, headers={"X-Api-Key": get_settings().patentsview_api_key})
    if data.get("error"):
        raise ExternalServiceError("PatentsView returned an error response")
    return [to_patent_record(p) for p in data.get("patents") or []]


def to_patent_record(item: dict) -> dict:
    assignees = [a.get("assignee_organization") for a in item.get("assignees") or [] if a.get("assignee_organization")]
    inventors = [" ".join(p for p in [i.get("inventor_name_first"), i.get("inventor_name_last")] if p)
                 for i in item.get("inventors") or []]
    cpcs = [c.get("cpc_group_id") for c in item.get("cpc_current") or [] if c.get("cpc_group_id")]
    classification = cpcs[0] if cpcs else None
    domain = taxonomy.classify_cpc(classification) or next(iter(taxonomy.classify_text(item.get("patent_title", ""), 1)), None)
    patent_id = item.get("patent_id")
    return {
        "id": None,
        "patent_number": f"US{patent_id}" if patent_id else None,
        "title": item.get("patent_title") or "Untitled",
        "abstract": (item.get("patent_abstract") or "")[:2000],
        "assignee": assignees[0] if assignees else "Unassigned",
        "inventors": [i for i in inventors if i][:10],
        "filing_date": None,
        "grant_date": item.get("patent_date"),
        "status": "granted",
        "classification": classification,
        "technology_domain": domain,
        "citation_count": int(item.get("patent_num_times_cited_by_us_patents") or 0),
        "jurisdiction": "US",
        "keywords": [],
        "source": "patentsview",
        "record_type": "live",
        "url": f"https://patents.google.com/patent/US{patent_id}" if patent_id else None,
        "is_own": False,
    }
