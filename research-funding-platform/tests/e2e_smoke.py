"""End-to-end smoke test against a RUNNING deployment (local uvicorn or Docker).

    python tests/e2e_smoke.py                      # default http://localhost:8000
    python tests/e2e_smoke.py --base-url http://localhost:8080   # through the nginx frontend proxy

Walks the main workflow: register -> profile -> recommendations -> save funding -> research/patent/technology
intelligence -> create + score a project -> commercialization -> alerts -> report exports -> admin checks.
Uses only the Python standard library so it can run from any machine. Exit code 0 = all steps passed.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request
import uuid

RESULTS: list[tuple[str, bool, str]] = []


class Client:
    def __init__(self, base: str) -> None:
        self.base = base.rstrip("/")
        self.token: str | None = None

    def request(self, method: str, path: str, body: dict | None = None, raw: bool = False):
        data = json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request(self.base + path, data=data, method=method)
        req.add_header("Content-Type", "application/json")
        if self.token:
            req.add_header("Authorization", f"Bearer {self.token}")
        start = time.perf_counter()
        try:
            with urllib.request.urlopen(req, timeout=120) as resp:
                payload = resp.read()
                status, headers = resp.status, dict(resp.headers)
        except urllib.error.HTTPError as exc:
            payload, status, headers = exc.read(), exc.code, dict(exc.headers)
        elapsed = (time.perf_counter() - start) * 1000
        if raw:
            return status, payload, headers, elapsed
        try:
            return status, json.loads(payload or b"null"), elapsed
        except json.JSONDecodeError:
            return status, payload, elapsed


def step(name: str, ok: bool, detail: str = "") -> None:
    RESULTS.append((name, ok, detail))
    print(f"[{'PASS' if ok else 'FAIL'}] {name}{' - ' + detail if detail else ''}")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default=os.environ.get("RFIP_BASE_URL", "http://localhost:8000"))
    parser.add_argument("--admin-email", default="admin@example.com")
    parser.add_argument("--admin-password", default=os.environ.get("DEMO_USER_PASSWORD", "Demo@2026"))
    args = parser.parse_args()
    c = Client(args.base_url)

    s, body, ms = c.request("GET", "/api/health")
    step("health", s == 200 and body.get("database") == "ok", f"{ms:.0f} ms")

    email = f"e2e-{uuid.uuid4().hex[:8]}@example.com"
    s, body, _ = c.request("POST", "/api/auth/register", {"email": email, "password": "E2eTest123",
                                                          "full_name": "E2E Tester", "role": "startup_founder"})
    step("register", s == 201, email)
    c.token = body.get("access_token") if isinstance(body, dict) else None

    s, body, _ = c.request("PUT", "/api/profile", {
        "headline": "Founder", "organization_name": "E2E Labs", "organization_type": "startup", "country": "India",
        "career_stage": "industry", "research_domains": ["clean_energy", "iot_edge"],
        "keywords": ["battery", "solar", "energy storage", "edge analytics"], "technology_areas": ["clean_energy"]})
    step("update profile", s == 200 and body["completeness"] >= 60, f"completeness {body.get('completeness')}")

    s, body, ms = c.request("GET", "/api/recommendations?limit=5")
    items = body.get("items", []) if isinstance(body, dict) else []
    step("recommendations", s == 200 and len(items) > 0,
         f"{len(items)} items, top {items[0]['match_score'] if items else '-'} ({ms:.0f} ms)")
    if items:
        fid = items[0]["funding"]["id"]
        s, _, _ = c.request("POST", f"/api/funding/{fid}/save", {"status": "interested"})
        step("save funding", s == 200)
        s, body, _ = c.request("GET", f"/api/funding/{fid}")
        step("funding detail + eligibility", s == 200 and "eligibility" in body)

    for path in ("/api/funding?page_size=5", "/api/research/trends", "/api/research/emerging-topics",
                 "/api/research/hotspots", "/api/patents/analytics/clusters", "/api/technology/areas",
                 "/api/technology/opportunities", "/api/dashboard"):
        s, _, ms = c.request("GET", path)
        step(f"GET {path}", s == 200, f"{ms:.0f} ms")

    project = {"title": "E2E battery analytics", "description": "Battery health analytics for solar storage using "
               "machine learning on edge gateways.", "domain": "clean_energy", "keywords": ["battery", "solar"],
               "stage": "prototype", "trl": 5, "market_size": "large", "target_market": "Solar operators",
               "patents_filed": 1, "patents_granted": 0, "team_size": 3, "has_industry_partner": False}
    s, body, _ = c.request("POST", "/api/innovation/projects", project)
    step("create project", s == 201)
    pid = body.get("id") if isinstance(body, dict) else None
    s, body, ms = c.request("POST", f"/api/innovation/projects/{pid}/score")
    ok = s == 200 and abs(body["overall"] - sum(x["weighted"] for x in body["components"])) < 0.2
    step("innovation score (formula consistent)", ok, f"overall {body.get('overall')} ({ms:.0f} ms)")
    s, body, _ = c.request("GET", f"/api/commercialization/projects/{pid}")
    step("commercialization", s == 200 and len(body.get("pathways", [])) == 5,
         body.get("pathways", [{}])[0].get("title", "") if isinstance(body, dict) else "")

    s, body, _ = c.request("POST", "/api/notifications/refresh")
    step("alert engine", s == 200, f"created {body.get('created') if isinstance(body, dict) else '?'}")

    for fmt, magic in (("pdf", b"%PDF"), ("xlsx", b"PK"), ("csv", None)):
        s, payload, headers, _ = c.request("GET", f"/api/reports/funding/download?format={fmt}", raw=True)
        ok = s == 200 and (magic is None or payload[:len(magic)] == magic)
        step(f"report export {fmt}", ok, f"{len(payload)} bytes")

    s, _, _ = c.request("GET", "/api/admin/users")
    step("RBAC: founder blocked from admin API", s == 403)

    c.token = None
    s, body, _ = c.request("POST", "/api/auth/login", {"email": args.admin_email, "password": args.admin_password})
    if s == 200:
        c.token = body["access_token"]
        for path in ("/api/admin/analytics", "/api/admin/recommendation-monitoring", "/api/admin/system",
                     "/api/admin/datasets", "/api/admin/audit-logs"):
            s, _, ms = c.request("GET", path)
            step(f"admin GET {path}", s == 200, f"{ms:.0f} ms")
    else:
        step("admin login", False, "demo admin not available (SEED_DEMO_USERS=false?) - admin checks skipped")

    failed = [r for r in RESULTS if not r[1]]
    print(f"\n{len(RESULTS) - len(failed)}/{len(RESULTS)} steps passed")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
