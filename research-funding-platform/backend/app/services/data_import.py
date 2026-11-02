"""Dataset ingestion: seed snapshots, admin CSV/JSON uploads (incl. Google Patents / Lens exports) and live
syncs from Grants.gov and OpenAlex. Every upload/sync is recorded as a DatasetImport row."""
from __future__ import annotations

import html
import io
import json
import re
from datetime import date, datetime, timedelta, timezone

import pandas as pd
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import taxonomy
from app.models import DatasetImport, FundingOpportunity, Patent, Publication, TrendPoint, User
from app.services import patent_analytics, research_analytics
from app.services.external import grantsgov, openalex
from app.services.external.http import ExternalServiceError
from app.services.recommender import funding_index

MAX_UPLOAD_BYTES = 5 * 1024 * 1024
MAX_ROWS = 5000

TEMPLATES = {
    "funding": ["title", "organization", "funder_type", "description", "domains", "keywords", "eligibility_text",
                "applicant_types", "eligible_countries", "career_stages", "min_amount", "max_amount", "currency",
                "open_date", "deadline", "status", "source_name", "source_url", "external_id"],
    "publications": ["title", "abstract", "authors", "venue", "year", "publication_date", "doi", "url",
                     "citation_count", "domain", "keywords", "pub_type"],
    "patents": ["patent_number", "title", "abstract", "assignee", "inventors", "filing_date", "grant_date", "status",
                "classification", "technology_domain", "citation_count", "jurisdiction", "url"],
}

ALIASES = {
    "funding": {"funder": "organization", "agency": "organization", "type": "funder_type", "summary": "description",
                "domain": "domains", "eligibility": "eligibility_text", "countries": "eligible_countries",
                "amount": "max_amount", "award_ceiling": "max_amount", "award_floor": "min_amount",
                "close_date": "deadline", "closing_date": "deadline", "url": "source_url", "link": "source_url",
                "id": "external_id"},
    "publications": {"journal": "venue", "date": "publication_date", "citations": "citation_count",
                     "cited_by": "citation_count", "cited_by_count": "citation_count", "type": "pub_type",
                     "author": "authors"},
    "patents": {"id": "patent_number", "publication_number": "patent_number", "lens_id": "patent_number",
                "display_key": "patent_number", "assignees": "assignee", "applicants": "assignee", "owners": "assignee",
                "inventor/author": "inventors", "inventor": "inventors", "filing/creation_date": "filing_date",
                "application_date": "filing_date", "priority_date": "filing_date", "cpc": "classification",
                "cpc_classifications": "classification", "domain": "technology_domain",
                "cited_by_patent_count": "citation_count", "citations": "citation_count", "result_link": "url"},
}

FUNDER_TYPE_ALIASES = {"grant": "government_grant", "government": "government_grant", "council": "research_council",
                       "accelerator": "startup_accelerator", "venture": "venture_program",
                       "international": "international_agency", "fund": "innovation_fund"}


# ---------------------------------------------------------------- value helpers
def _list(value) -> list[str]:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return []
    if isinstance(value, list):
        return [str(v).strip() for v in value if str(v).strip()]
    return [v.strip() for v in re.split(r"[;|,]", str(value)) if v.strip()]


def _str(value, limit: int | None = None) -> str | None:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    s = str(value).strip()
    if not s or s.lower() in {"nan", "none", "null"}:
        return None
    return s[:limit] if limit else s


def _date(value) -> date | None:
    s = _str(value)
    if not s:
        return None
    try:
        return date.fromisoformat(s[:10])
    except ValueError:
        parsed = pd.to_datetime(s, errors="coerce")
        return None if pd.isna(parsed) else parsed.date()


def _float(value) -> float | None:
    s = _str(value)
    if s is None:
        return None
    try:
        return float(s.replace(",", "").replace("$", ""))
    except ValueError:
        return None


def _int(value, default: int = 0) -> int:
    f = _float(value)
    return int(f) if f is not None else default


def _areas(values: list[str], fallback_text: str = "") -> list[str]:
    keys = set(taxonomy.area_keys())
    names = {a["name"].lower(): a["key"] for a in taxonomy.areas()}
    out = []
    for v in values:
        k = v if v in keys else names.get(v.lower())
        if k and k not in out:
            out.append(k)
    if not out and fallback_text:
        out = taxonomy.classify_text(fallback_text, 2)
    return out


# ---------------------------------------------------------------- record loaders
def upsert_funding(db: Session, rec: dict, record_type: str, today: date | None = None) -> FundingOpportunity:
    today = today or date.today()
    title = _str(html.unescape(str(rec.get("title") or "")), 500)
    org = _str(html.unescape(str(rec.get("organization") or "")), 300)
    if not title or not org:
        raise ValueError("title and organization are required")
    ftype = (_str(rec.get("funder_type")) or "government_grant").lower().replace(" ", "_")
    ftype = FUNDER_TYPE_ALIASES.get(ftype, ftype)
    if ftype not in taxonomy.FUNDER_TYPES:
        raise ValueError(f"unknown funder_type '{ftype}'")
    description = _str(rec.get("description")) or title
    deadline = _date(rec.get("deadline"))
    if rec.get("deadline_in_days") is not None:
        deadline = today + timedelta(days=int(rec["deadline_in_days"]))
    open_date = _date(rec.get("open_date"))
    if rec.get("opened_days_ago") is not None:
        open_date = today - timedelta(days=int(rec["opened_days_ago"]))
    status = (_str(rec.get("status")) or "open").lower()
    if status not in ("open", "forecasted", "closed", "rolling"):
        status = "open"
    eligibility_text = _str(rec.get("eligibility_text"), 4000)
    if status == "open" and deadline and deadline < today:
        status = "closed"
    elif status == "forecasted" and deadline and deadline < today:
        # Stale forecast: keep the official record, but do not present a past *estimated* date as a deadline.
        note = (f"Forecast notice: the estimated application date ({deadline.isoformat()}) has passed and no "
                "updated date was published when this record was retrieved - check the source for the timeline.")
        eligibility_text = f"{note} {eligibility_text or ''}".strip()[:4000]
        deadline = None
    applicant_types = [t for t in _list(rec.get("applicant_types")) if t in taxonomy.APPLICANT_TYPES]
    external_id = _str(rec.get("external_id"), 255) or (f"seed:{rec['key']}" if rec.get("key") else None)
    verified_at = rec.get("verified_at")
    if isinstance(verified_at, str):
        verified_at = datetime.fromisoformat(verified_at.replace("Z", "+00:00")).astimezone(timezone.utc).replace(tzinfo=None)
    item = None
    if external_id:
        item = db.execute(select(FundingOpportunity).where(FundingOpportunity.external_id == external_id)).scalar_one_or_none()
    if item is None:
        item = FundingOpportunity(external_id=external_id)
        db.add(item)
    item.title, item.organization, item.funder_type = title, org, ftype
    item.description = description
    item.domains = _areas(_list(rec.get("domains")), f"{title} {description}")
    item.keywords = _list(rec.get("keywords"))[:15]
    item.eligibility_text = eligibility_text
    item.applicant_types = applicant_types
    item.eligible_countries = _list(rec.get("eligible_countries")) or ["Global"]
    item.career_stages = [c for c in _list(rec.get("career_stages")) if c in taxonomy.CAREER_STAGES]
    item.min_amount, item.max_amount = _float(rec.get("min_amount")), _float(rec.get("max_amount"))
    item.currency = (_str(rec.get("currency"), 8) or "USD").upper()
    item.open_date, item.deadline, item.status = open_date, deadline, status
    default_source = {"illustrative": "Illustrative sample (not a real call)",
                      "imported": "Imported by administrator (unverified)"}.get(record_type)
    item.source_name = _str(rec.get("source_name"), 200) or default_source
    url = _str(rec.get("source_url"), 1000)
    item.source_url = url if url and url.startswith(("http://", "https://")) else None
    item.record_type = record_type
    item.verified_at = verified_at if record_type == "verified" else None
    return item


def add_publication(db: Session, rec: dict, owner_id: int | None = None, source: str | None = None) -> Publication:
    title = _str(rec.get("title"), 500)
    if not title:
        raise ValueError("title is required")
    domain = rec.get("domain")
    domain = domain if domain in taxonomy.area_keys() else (_areas([str(domain)] if domain else [],
                                                                    f"{title} {rec.get('abstract') or ''}") or [None])[0]
    year = _int(rec.get("year"), 0) or None
    pub_date = _date(rec.get("publication_date"))
    pub = Publication(owner_id=owner_id, title=title, abstract=_str(rec.get("abstract"), 10000),
                      authors=_list(rec.get("authors"))[:50] if not isinstance(rec.get("authors"), list)
                      else rec["authors"][:50],
                      venue=_str(rec.get("venue"), 300), year=year or (pub_date.year if pub_date else None),
                      publication_date=pub_date, doi=_str(rec.get("doi"), 255), url=_str(rec.get("url"), 500),
                      citation_count=_int(rec.get("citation_count")), domain=domain,
                      keywords=(rec["keywords"] if isinstance(rec.get("keywords"), list) else _list(rec.get("keywords")))[:15],
                      pub_type=_str(rec.get("pub_type"), 64), source=source or _str(rec.get("source"), 32) or "imported",
                      external_id=_str(rec.get("external_id"), 255))
    db.add(pub)
    return pub


def add_patent(db: Session, rec: dict, record_type: str, source: str, owner_id: int | None = None) -> Patent:
    title = _str(rec.get("title"), 500)
    if not title:
        raise ValueError("title is required")
    classification = (_list(rec.get("classification")) or [None])[0]
    domain = rec.get("technology_domain")
    if domain not in taxonomy.area_keys():
        domain = taxonomy.classify_cpc(classification) or (_areas([str(domain)] if domain else [],
                                                                  f"{title} {rec.get('abstract') or ''}") or [None])[0]
    status = (_str(rec.get("status")) or "").lower()
    grant = _date(rec.get("grant_date"))
    if status not in ("granted", "pending", "expired", "abandoned"):
        status = "granted" if grant else "pending"
    assignee = _list(rec.get("assignee"))
    patent = Patent(owner_id=owner_id, patent_number=_str(rec.get("patent_number"), 64), title=title,
                    abstract=_str(rec.get("abstract"), 10000), assignee=(assignee[0] if assignee else "Unassigned")[:255],
                    inventors=rec["inventors"] if isinstance(rec.get("inventors"), list) else _list(rec.get("inventors"))[:20],
                    filing_date=_date(rec.get("filing_date")), grant_date=grant, status=status,
                    classification=classification, technology_domain=domain,
                    citation_count=_int(rec.get("citation_count")), jurisdiction=_str(rec.get("jurisdiction"), 16),
                    keywords=rec.get("keywords") if isinstance(rec.get("keywords"), list) else [],
                    source=source, record_type=record_type, url=_str(rec.get("url"), 500))
    db.add(patent)
    return patent


def load_trends(db: Session, payload: dict, source: str = "openalex") -> int:
    retrieved = payload.get("retrieved_at")
    retrieved_dt = datetime.fromisoformat(retrieved.replace("Z", "+00:00")).astimezone(timezone.utc).replace(tzinfo=None) \
        if retrieved else None
    n = 0
    for key, points in (payload.get("series") or {}).items():
        for p in points:
            existing = db.execute(select(TrendPoint).where(TrendPoint.area_key == key, TrendPoint.year == p["year"],
                                                           TrendPoint.source == source)).scalar_one_or_none()
            if existing:
                existing.count, existing.retrieved_at = p["count"], retrieved_dt
            else:
                db.add(TrendPoint(area_key=key, year=p["year"], count=p["count"], source=source,
                                  retrieved_at=retrieved_dt))
            n += 1
    return n


def _after_change(dataset: str) -> None:
    if dataset == "funding":
        funding_index.invalidate()
    elif dataset == "publications":
        research_analytics.invalidate_cache()
    elif dataset == "patents":
        patent_analytics.invalidate_cache()


# ---------------------------------------------------------------- uploads
def _read_table(filename: str, content: bytes) -> list[dict]:
    name = (filename or "").lower()
    if name.endswith(".json"):
        data = json.loads(content.decode("utf-8-sig"))
        records = data.get("records") if isinstance(data, dict) else data
        if not isinstance(records, list):
            raise ValueError("JSON must be a list of records or an object with a 'records' list")
        return records
    if not name.endswith(".csv"):
        raise ValueError("Only .csv and .json files are supported")
    text = content.decode("utf-8-sig", errors="replace")
    first = text.splitlines()[0] if text else ""
    skip = 1 if first.lower().startswith("search url") else 0  # Google Patents export preamble
    df = pd.read_csv(io.StringIO(text), skiprows=skip, dtype=str, keep_default_na=False)
    return df.to_dict(orient="records")


def _normalise_keys(dataset: str, rec: dict) -> dict:
    aliases = ALIASES[dataset]
    out = {}
    for k, v in rec.items():
        key = str(k).strip().lower().replace(" ", "_").lstrip("#")
        key = aliases.get(key, aliases.get(key.replace("_", " "), key))
        if key not in out or not out[key]:
            out[key] = v
    return out


def import_file(db: Session, dataset: str, filename: str, content: bytes, user: User) -> DatasetImport:
    record = DatasetImport(dataset=dataset, filename=filename, source="upload", user_id=user.id, user_email=user.email)
    errors: list[str] = []
    imported = failed = 0
    try:
        if len(content) > MAX_UPLOAD_BYTES:
            raise ValueError("File exceeds the 5 MB limit")
        rows = _read_table(filename, content)
        if len(rows) > MAX_ROWS:
            raise ValueError(f"File has {len(rows)} rows; the limit is {MAX_ROWS}")
        for i, raw in enumerate(rows, start=1):
            rec = _normalise_keys(dataset, raw)
            try:
                with db.begin_nested():
                    if dataset == "funding":
                        upsert_funding(db, rec, "imported")
                    elif dataset == "publications":
                        add_publication(db, rec, source="imported")
                    else:
                        add_patent(db, rec, "imported", "upload")
                imported += 1
            except Exception as exc:  # noqa: BLE001 - row-level errors are reported back to the admin
                failed += 1
                if len(errors) < 25:
                    errors.append(f"Row {i}: {exc}")
        record.rows_total = len(rows)
    except Exception as exc:  # noqa: BLE001
        errors.append(str(exc))
        record.rows_total = 0
    record.rows_imported, record.rows_failed, record.errors = imported, failed, errors
    record.status = "completed" if imported and not failed else ("partial" if imported else "failed")
    db.add(record)
    db.commit()
    db.refresh(record)
    _after_change(dataset)
    return record


# ---------------------------------------------------------------- live syncs
def sync_grantsgov(db: Session, keywords: list[str] | None, limit: int, user: User | None) -> DatasetImport:
    pairs = [(k, None) for k in keywords] if keywords else [(a["grants_keyword"], a["key"]) for a in taxonomy.areas()]
    record = DatasetImport(dataset="funding", filename=None, source="grants.gov", user_id=user.id if user else None,
                           user_email=user.email if user else "scheduler")
    try:
        records = grantsgov.collect(pairs, rows_per_keyword=limit, with_details=True, pause_seconds=0.2)
        ok = 0
        for rec in records:
            upsert_funding(db, rec, "verified")
            ok += 1
        record.rows_total, record.rows_imported, record.status, record.errors = len(records), ok, "completed", []
    except ExternalServiceError as exc:
        record.status, record.errors = "failed", [f"{exc}. The existing snapshot remains in use."]
    db.add(record)
    db.commit()
    db.refresh(record)
    _after_change("funding")
    return record


def sync_openalex(db: Session, query: str, domain: str | None, limit: int, user: User) -> DatasetImport:
    record = DatasetImport(dataset="publications", filename=None, source="openalex", user_id=user.id,
                           user_email=user.email)
    try:
        year = datetime.now(timezone.utc).year
        works = openalex.search_works(query, year - 6, year, per_page=limit)
        existing = set(db.execute(select(Publication.external_id).where(Publication.owner_id.is_(None),
                                                                        Publication.source == "openalex")).scalars())
        ok = skipped = 0
        for w in works:
            rec = openalex.to_publication_record(w, domain)
            if rec["external_id"] in existing:
                skipped += 1
                continue
            add_publication(db, rec, source="openalex")
            ok += 1
        record.rows_total, record.rows_imported, record.status = len(works), ok, "completed"
        record.errors = [f"{skipped} duplicate work(s) skipped"] if skipped else []
    except ExternalServiceError as exc:
        record.status, record.errors = "failed", [f"{exc}. Local publication data remains in use."]
    db.add(record)
    db.commit()
    db.refresh(record)
    _after_change("publications")
    return record


def template_csv(dataset: str) -> str:
    return ",".join(TEMPLATES[dataset]) + "\n"
