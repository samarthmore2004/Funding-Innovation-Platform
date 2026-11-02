"""Grants.gov public API client (no API key required).

Docs: https://www.grants.gov/api  — endpoints `search2` and `fetchOpportunity`.
Records produced here are *verified* records: they come directly from the official
U.S. federal grants portal and carry the retrieval timestamp and the official URL.
"""
from __future__ import annotations

import html
import re
import time
from datetime import date, datetime, timezone

from app.core import taxonomy
from app.services.external.http import ExternalServiceError, post_json

SEARCH_URL = "https://api.grants.gov/v1/api/search2"
FETCH_URL = "https://api.grants.gov/v1/api/fetchOpportunity"
DETAIL_URL = "https://www.grants.gov/search-results-detail/{id}"

# Grants.gov eligibility codes -> platform applicant types
_ELIGIBILITY_MAP = {
    "00": ["government"], "01": ["government"], "02": ["government"], "04": ["government"],
    "05": ["government"], "07": ["government"], "08": ["government"], "11": ["nonprofit"],
    "06": ["university", "researcher"], "20": ["university", "researcher"],
    "12": ["nonprofit"], "13": ["nonprofit"], "21": ["researcher"],
    "22": ["enterprise"], "23": ["startup", "enterprise"],
    "25": ["researcher", "startup", "university", "enterprise", "nonprofit", "government"],
    "99": ["researcher", "startup", "university", "enterprise", "nonprofit", "government"],
}


def search(keyword: str, rows: int = 10, statuses: str = "forecasted|posted") -> list[dict]:
    payload = {"keyword": keyword, "oppStatuses": statuses, "rows": rows}
    data = post_json("Grants.gov", SEARCH_URL, payload)
    if data.get("errorcode") not in (0, "0", None):
        raise ExternalServiceError(f"Grants.gov search error: {data.get('msg')}")
    return (data.get("data") or {}).get("oppHits") or []


def fetch_opportunity(opportunity_id: str | int) -> dict:
    data = post_json("Grants.gov", FETCH_URL, {"opportunityId": int(opportunity_id)})
    if data.get("errorcode") not in (0, "0", None):
        raise ExternalServiceError(f"Grants.gov fetch error: {data.get('msg')}")
    return data.get("data") or {}


def _strip_html(value: str | None) -> str:
    if not value:
        return ""
    text = re.sub(r"<[^>]+>", " ", value)
    text = html.unescape(text)
    return re.sub(r"\s+", " ", text).strip()


def _parse_date(value: str | None) -> date | None:
    if not value:
        return None
    value = value.strip()
    for fmt in ("%m/%d/%Y", "%b %d, %Y"):
        try:
            return datetime.strptime(value, fmt).date()
        except ValueError:
            continue
    match = re.match(r"([A-Za-z]{3} \d{1,2}, \d{4})", value)
    if match:
        try:
            return datetime.strptime(match.group(1), "%b %d, %Y").date()
        except ValueError:
            return None
    return None


def _parse_amount(value) -> float | None:
    if value in (None, "", "none", "None"):
        return None
    try:
        amount = float(str(value).replace(",", "").replace("$", ""))
    except ValueError:
        return None
    return amount if amount > 0 else None


def to_funding_record(hit: dict, detail: dict | None, domain_hint: str | None = None,
                      retrieved_at: datetime | None = None) -> dict:
    """Convert a search hit (+ optional fetchOpportunity detail) to a FundingOpportunity dict."""
    detail = detail or {}
    synopsis = detail.get("synopsis") or {}
    forecast = detail.get("forecast") or {}
    body = synopsis or forecast
    description = _strip_html(body.get("synopsisDesc") or body.get("forecastDesc") or "")
    eligibility_desc = _strip_html(body.get("applicantEligibilityDesc") or "")

    applicant_types: list[str] = []
    applicant_labels: list[str] = []
    for item in body.get("applicantTypes") or []:
        code = str(item.get("id", "")).zfill(2)
        applicant_labels.append(item.get("description", ""))
        for t in _ELIGIBILITY_MAP.get(code, []):
            if t not in applicant_types:
                applicant_types.append(t)

    deadline = _parse_date(hit.get("closeDate")) or _parse_date(body.get("responseDate")) \
        or _parse_date(forecast.get("estApplicationResponseDate"))
    open_date = _parse_date(hit.get("openDate")) or _parse_date(body.get("postingDate"))
    status = "forecasted" if (hit.get("oppStatus") == "forecasted") else "open"

    title = html.unescape(hit.get("title") or detail.get("opportunityTitle") or "Untitled opportunity")
    domains = taxonomy.classify_text(f"{title} {description}", max_areas=3)
    if domain_hint and domain_hint not in domains:
        domains = [domain_hint] + domains[:2]

    eligibility_parts = ["Listed on Grants.gov (U.S. federal funding). Non-U.S. organisations are usually ineligible "
                         "unless the official notice states otherwise."]
    if applicant_labels:
        eligibility_parts.append("Eligible applicants: " + "; ".join(l for l in applicant_labels if l)[:600])
    if eligibility_desc:
        eligibility_parts.append(eligibility_desc[:800])

    retrieved = retrieved_at or datetime.now(timezone.utc)
    return {
        "title": title[:500],
        "organization": hit.get("agency") or body.get("agencyName") or hit.get("agencyCode") or "U.S. federal agency",
        "funder_type": "government_grant",
        "description": description[:4000] or title,
        "domains": domains,
        "keywords": [],
        "eligibility_text": " ".join(eligibility_parts)[:2000],
        "applicant_types": applicant_types or ["university", "nonprofit"],
        "eligible_countries": ["United States"],
        "career_stages": [],
        "min_amount": _parse_amount(body.get("awardFloor")),
        "max_amount": _parse_amount(body.get("awardCeiling")),
        "currency": "USD",
        "open_date": open_date.isoformat() if open_date else None,
        "deadline": deadline.isoformat() if deadline else None,
        "status": status,
        "source_name": "Grants.gov",
        "source_url": DETAIL_URL.format(id=hit.get("id")),
        "record_type": "verified",
        "verified_at": retrieved.isoformat(),
        "external_id": f"grantsgov:{hit.get('id')}",
        "opportunity_number": hit.get("number"),
    }


def collect(keywords: list[tuple[str, str | None]], rows_per_keyword: int = 10, with_details: bool = True,
            pause_seconds: float = 0.3) -> list[dict]:
    """Search several keywords and return de-duplicated funding records."""
    seen: set[str] = set()
    records: list[dict] = []
    retrieved = datetime.now(timezone.utc)
    for keyword, domain_hint in keywords:
        for hit in search(keyword, rows=rows_per_keyword):
            opp_id = str(hit.get("id"))
            if opp_id in seen:
                continue
            seen.add(opp_id)
            detail = None
            if with_details:
                try:
                    detail = fetch_opportunity(opp_id)
                except ExternalServiceError:
                    detail = None
                time.sleep(pause_seconds)
            records.append(to_funding_record(hit, detail, domain_hint, retrieved))
    return records
