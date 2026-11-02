def test_admin_endpoints_are_admin_only(client, auth):
    for role in ("researcher", "founder", "manager"):
        assert client.get("/api/admin/users", headers=auth(role)).status_code == 403
    resp = client.get("/api/admin/users", headers=auth("admin"))
    assert resp.status_code == 200 and resp.json()["total"] >= 9


def test_funding_curation_requires_manager_or_admin(client, auth):
    payload = {"title": "Internal Seed Grant for AI Prototypes", "organization": "Westbrook TTO",
               "funder_type": "innovation_fund", "description": "Internal proof-of-concept funding for AI prototypes.",
               "domains": ["ai_ml"], "applicant_types": ["researcher"], "eligible_countries": ["Global"],
               "max_amount": 20000, "deadline": "2030-01-31"}
    assert client.post("/api/funding", json=payload, headers=auth("researcher")).status_code == 403
    resp = client.post("/api/funding", json=payload, headers=auth("manager"))
    assert resp.status_code == 201, resp.text
    created = resp.json()
    assert created["record_type"] == "internal"
    assert client.delete(f"/api/funding/{created['id']}", headers=auth("manager")).status_code == 403
    assert client.delete(f"/api/funding/{created['id']}", headers=auth("admin")).status_code == 204


def test_project_scope_all_requires_manager(client, auth):
    assert client.get("/api/innovation/projects?scope=all", headers=auth("researcher")).status_code == 403
    resp = client.get("/api/innovation/projects?scope=all", headers=auth("manager"))
    assert resp.status_code == 200 and len(resp.json()) >= 12


def test_admin_cannot_demote_self(client, auth):
    me = client.get("/api/auth/me", headers=auth("admin")).json()
    resp = client.patch(f"/api/admin/users/{me['id']}", json={"role": "researcher"}, headers=auth("admin"))
    assert resp.status_code == 400


def test_deactivated_user_cannot_log_in(client, auth, new_user):
    headers, email, password = new_user()
    uid = client.get("/api/auth/me", headers=headers).json()["id"]
    assert client.patch(f"/api/admin/users/{uid}", json={"is_active": False}, headers=auth("admin")).status_code == 200
    assert client.post("/api/auth/login", json={"email": email, "password": password}).status_code == 403
    assert client.get("/api/auth/me", headers=headers).status_code == 403


def test_account_settings_export_and_delete(client, new_user):
    headers, email, password = new_user()
    upd = client.patch("/api/users/me", headers=headers, json={
        "full_name": "Renamed User", "organization": "Test Org",
        "notification_preferences": {"in_app": True, "deadline_reminder_days": 7, "alert_types": ["funding_deadline"]}})
    assert upd.status_code == 200
    assert upd.json()["notification_preferences"]["deadline_reminder_days"] == 7
    bad = client.patch("/api/users/me", headers=headers,
                       json={"notification_preferences": {"alert_types": ["not_a_type"]}})
    assert bad.status_code == 422

    export = client.get("/api/users/me/export", headers=headers)
    assert export.status_code == 200
    assert "attachment" in export.headers["content-disposition"]
    assert export.json()["account"]["email"] == email

    assert client.post("/api/users/me/delete", headers=headers, json={"password": "wrong-pass1"}).status_code == 400
    assert client.post("/api/users/me/delete", headers=headers, json={"password": password}).status_code == 200
    assert client.post("/api/auth/login", json={"email": email, "password": password}).status_code == 401
