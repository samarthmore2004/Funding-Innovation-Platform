import io
import json

import pytest
from openpyxl import load_workbook


def test_notifications_flow(client, auth):
    h = auth("researcher")
    refreshed = client.post("/api/notifications/refresh", headers=h)
    assert refreshed.status_code == 200
    page = client.get("/api/notifications?page_size=50", headers=h).json()
    assert page["total"] > 0 and page["unread_count"] >= 0
    types = {n["type"] for n in page["items"]}
    assert "system" in types and types & {"funding_match", "funding_deadline", "tech_alert", "trend_update",
                                          "patent_alert"}
    first = page["items"][0]
    assert client.post(f"/api/notifications/{first['id']}/read", headers=h).json()["is_read"] is True
    # dedupe: a second refresh must not recreate the same alerts
    again = client.post("/api/notifications/refresh", headers=h).json()
    assert again["created"] == 0
    client.post("/api/notifications/read-all", headers=h)
    assert client.get("/api/notifications/unread-count", headers=h).json()["unread_count"] == 0
    assert client.delete(f"/api/notifications/{first['id']}", headers=h).status_code == 204
    assert client.delete(f"/api/notifications/{first['id']}", headers=auth("founder")).status_code == 404


def test_alert_preferences_are_respected(client, new_user):
    headers, _, _ = new_user()
    client.put("/api/profile", headers=headers, json={"research_domains": ["quantum"], "keywords": ["qubit"],
                                                      "technology_areas": ["quantum"], "country": "Germany"})
    client.patch("/api/users/me", headers=headers, json={"notification_preferences": {
        "in_app": True, "deadline_reminder_days": 14, "alert_types": ["system"]}})
    result = client.post("/api/notifications/refresh", headers=headers).json()
    assert result["created"] == 0


def test_broadcast(client, auth):
    resp = client.post("/api/admin/notifications/broadcast", headers=auth("admin"),
                       json={"title": "Maintenance window", "message": "Short downtime on Sunday.",
                             "roles": ["startup_founder"]})
    assert resp.status_code == 200 and resp.json()["created"] >= 1
    items = client.get("/api/notifications?type=system", headers=auth("founder")).json()["items"]
    assert any(n["title"] == "Maintenance window" for n in items)
    assert client.post("/api/admin/notifications/broadcast", headers=auth("manager"),
                       json={"title": "x" * 5, "message": "nope"}).status_code == 403


@pytest.mark.parametrize("report_type", ["funding", "patents", "research_trends", "innovation", "commercialization"])
def test_report_preview(client, auth, report_type):
    resp = client.get(f"/api/reports/{report_type}/preview", headers=auth("manager"))
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["title"] and body["summary"] and body["columns"]
    assert body["total_rows"] >= len(body["rows"])


def test_report_downloads(client, auth):
    h = auth("researcher")
    csv = client.get("/api/reports/funding/download?format=csv", headers=h)
    assert csv.status_code == 200 and csv.headers["content-type"].startswith("text/csv")
    assert "attachment" in csv.headers["content-disposition"] and b"Match score" in csv.content
    xlsx = client.get("/api/reports/patents/download?format=xlsx&domain=quantum", headers=h)
    assert xlsx.content[:2] == b"PK"
    wb = load_workbook(io.BytesIO(xlsx.content))
    assert {"Summary", "Data", "Top assignees"} <= set(wb.sheetnames)
    pdf = client.get("/api/reports/research_trends/download?format=pdf", headers=h)
    assert pdf.content[:4] == b"%PDF"
    pid = client.get("/api/innovation/projects", headers=h).json()[0]["id"]
    comm = client.get(f"/api/reports/commercialization/download?format=pdf&project_id={pid}", headers=h)
    assert comm.status_code == 200 and comm.content[:4] == b"%PDF"
    history = client.get("/api/reports/history", headers=h).json()
    assert len(history) >= 4 and {r["format"] for r in history} >= {"csv", "xlsx", "pdf"}
    assert client.get("/api/reports/unknown/preview", headers=h).status_code == 404
    assert client.get("/api/reports/funding/download?format=docx", headers=h).status_code == 422


def test_admin_analytics_monitoring_system(client, auth):
    h = auth("admin")
    analytics = client.get("/api/admin/analytics", headers=h).json()
    assert analytics["users_total"] >= 9 and analytics["recommendations_served"] > 0
    assert len(analytics["registrations_by_day"]) == 31
    mon = client.get("/api/admin/recommendation-monitoring", headers=h).json()
    assert mon["served_total"] > 0 and mon["evaluation"]["precision_at_k"] is not None
    assert mon["evaluation"]["eligibility_accuracy"] == 1.0
    system = client.get("/api/admin/system", headers=h).json()
    assert system["database"]["ok"] and system["metrics"]["requests_total"] > 0
    assert {j["name"] for j in system["jobs"]} == {"alerts", "grantsgov_sync"}
    run = client.post("/api/admin/jobs/alerts/run", headers=h).json()
    assert run["status"] == "success"
    assert client.post("/api/admin/jobs/unknown/run", headers=h).status_code == 404
    logs = client.get("/api/admin/audit-logs?action=auth.login", headers=h).json()
    assert logs["total"] > 0 and "auth.login" in logs["actions"]


def test_dataset_admin_imports(client, auth):
    h = auth("admin")
    datasets = client.get("/api/admin/datasets", headers=h).json()
    keys = {d["key"]: d for d in datasets["datasets"]}
    assert keys["funding"]["count"] > 100 and keys["patents"]["count"] > 500
    template = client.get("/api/admin/datasets/funding/template", headers=h)
    assert template.status_code == 200 and template.text.startswith("title,organization")

    funding_csv = ("title,organization,funder_type,description,domains,eligible_countries,max_amount,deadline,source_url\n"
                   "Imported Robotics Call,Test Agency,research_council,Support for robotics research,robotics,Global,"
                   "50000,2031-01-01,https://example.org/call\n"
                   ",Missing Title Agency,research_council,No title here,robotics,Global,1000,2031-01-01,\n")
    resp = client.post("/api/admin/datasets/funding/import", headers=h,
                       files={"file": ("funding.csv", funding_csv.encode(), "text/csv")})
    body = resp.json()
    assert body["status"] == "partial" and body["rows_imported"] == 1 and body["rows_failed"] == 1
    found = client.get("/api/funding?q=Imported Robotics Call", headers=h).json()["items"]
    assert found and found[0]["record_type"] == "imported"

    google_csv = ("search URL:,https://patents.google.com/?q=battery\n"
                  "id,title,assignee,inventor/author,priority date,filing/creation date,publication date,grant date,"
                  "result link\n"
                  "US-0000000-X1,Example battery separator,Example Corp,Jane Doe,2020-01-01,2020-02-01,2021-08-01,,"
                  "https://patents.google.com/patent/US0000000X1\n")
    pat = client.post("/api/admin/datasets/patents/import", headers=h,
                      files={"file": ("gp.csv", google_csv.encode(), "text/csv")}).json()
    assert pat["status"] == "completed" and pat["rows_imported"] == 1

    pubs = json.dumps({"records": [{"title": "Imported paper on smart grids", "year": 2023, "citation_count": 3}]})
    pub = client.post("/api/admin/datasets/publications/import", headers=h,
                      files={"file": ("pubs.json", pubs.encode(), "application/json")}).json()
    assert pub["status"] == "completed"
    bad = client.post("/api/admin/datasets/patents/import", headers=h,
                      files={"file": ("x.txt", b"hello", "text/plain")}).json()
    assert bad["status"] == "failed" and bad["errors"]


def test_external_sync_fails_gracefully_offline(client, auth):
    resp = client.post("/api/admin/datasets/funding/sync-grantsgov", headers=auth("admin"), json={"limit_per_keyword": 2})
    assert resp.status_code == 200
    assert resp.json()["status"] == "failed" and "snapshot" in resp.json()["errors"][0]
