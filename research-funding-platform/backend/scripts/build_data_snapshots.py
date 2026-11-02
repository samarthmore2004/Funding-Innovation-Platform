"""Build the real-data snapshots shipped in ../data from public APIs.

Usage (from the backend folder):
    python -m scripts.build_data_snapshots              # Grants.gov + OpenAlex
    python -m scripts.build_data_snapshots --only grantsgov
    python -m scripts.build_data_snapshots --only openalex --works-per-window 20

* Grants.gov (keyless): open/forecasted U.S. federal opportunities -> data/funding_verified_grantsgov.json
* OpenAlex (keyless shared quota, or OPENALEX_API_KEY): yearly publication counts per technology area
  -> data/publication_trends_openalex.json and influential works per area -> data/publications_openalex.json

The application never calls these APIs at start-up; it seeds from the snapshot files, so it works offline.
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

from app.core import taxonomy
from app.core.config import get_settings
from app.services.external import grantsgov, openalex
from app.services.external.http import ExternalServiceError

TREND_START, TREND_END = 2012, 2025
WINDOWS = [(2017, 2020), (2021, 2025)]


def _write(path: Path, payload: dict) -> None:
    path.write_text(json.dumps(payload, indent=1, ensure_ascii=False), encoding="utf-8")
    print(f"wrote {path.name}")


def build_grantsgov(data_dir: Path, rows: int) -> None:
    keywords = [(a["grants_keyword"], a["key"]) for a in taxonomy.areas()]
    records = grantsgov.collect(keywords, rows_per_keyword=rows, with_details=True)
    _write(data_dir / "funding_verified_grantsgov.json", {
        "source": "Grants.gov public API (search2 + fetchOpportunity)",
        "source_url": "https://www.grants.gov/",
        "retrieved_at": datetime.now(timezone.utc).isoformat(),
        "notice": "Verified records retrieved from the official U.S. federal grants portal. Deadlines and amounts "
                  "are as published at retrieval time; always confirm on the official page before applying.",
        "count": len(records),
        "records": records,
    })


def build_openalex(data_dir: Path, per_window: int) -> None:
    trends: dict[str, list[dict]] = {}
    works: list[dict] = []
    seen: set[str] = set()
    failures: list[str] = []
    for area in taxonomy.areas():
        key, query = area["key"], area["openalex_query"]
        try:
            trends[key] = openalex.yearly_counts(query, TREND_START, TREND_END)
            print(f"  trend {key}: {sum(p['count'] for p in trends[key])} works")
        except ExternalServiceError as exc:
            failures.append(f"trend {key}: {exc}")
        for start, end in WINDOWS:
            try:
                results = openalex.search_works(query, start, end, per_page=per_window)
            except ExternalServiceError as exc:
                failures.append(f"works {key} {start}-{end}: {exc}")
                continue
            for w in results:
                rec = openalex.to_publication_record(w, domain_hint=key)
                ident = rec["external_id"] or rec["title"]
                if ident in seen:
                    continue
                seen.add(ident)
                works.append(rec)
            time.sleep(0.2)
        print(f"  works so far: {len(works)}")
    retrieved = datetime.now(timezone.utc).isoformat()
    if trends:
        _write(data_dir / "publication_trends_openalex.json", {
            "source": "OpenAlex works API, group_by=publication_year on title_and_abstract.search",
            "license": "CC0 (OpenAlex data)",
            "retrieved_at": retrieved,
            "year_range": [TREND_START, TREND_END],
            "queries": {a["key"]: a["openalex_query"] for a in taxonomy.areas()},
            "series": trends,
        })
    if works:
        _write(data_dir / "publications_openalex.json", {
            "source": "OpenAlex works API (most-cited works per technology area and time window)",
            "license": "CC0 (OpenAlex data)",
            "retrieved_at": retrieved,
            "windows": WINDOWS,
            "count": len(works),
            "records": works,
        })
    if failures:
        print("Failures:\n  " + "\n  ".join(failures))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--only", choices=["grantsgov", "openalex"])
    parser.add_argument("--grants-rows", type=int, default=8)
    parser.add_argument("--works-per-window", type=int, default=25)
    args = parser.parse_args()
    data_dir = get_settings().data_path
    if args.only in (None, "grantsgov"):
        print("Grants.gov ...")
        build_grantsgov(data_dir, args.grants_rows)
    if args.only in (None, "openalex"):
        print("OpenAlex ...")
        build_openalex(data_dir, args.works_per_window)
    return 0


if __name__ == "__main__":
    sys.exit(main())
