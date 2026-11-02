def test_profile_autocreate_and_update(client, new_user):
    headers, _, _ = new_user()
    profile = client.get("/api/profile", headers=headers)
    assert profile.status_code == 200
    assert profile.json()["completeness"] == 0
    resp = client.put("/api/profile", headers=headers, json={
        "headline": "Researcher", "bio": "Robotics and computer vision", "organization_name": "Test University",
        "organization_type": "university", "country": "India", "career_stage": "early_career",
        "research_domains": ["robotics"], "keywords": ["slam", "motion planning", "drones"],
        "technology_areas": ["computer_vision"]})
    assert resp.status_code == 200, resp.text
    assert resp.json()["completeness"] >= 80
    bad = client.put("/api/profile", headers=headers, json={"research_domains": ["astrology"]})
    assert bad.status_code == 422


def test_profile_options(client, auth):
    opts = client.get("/api/profile/options", headers=auth("researcher")).json()
    assert len(opts["domains"]) == 15
    assert {"university", "startup"} <= {o["key"] for o in opts["organization_types"]}


def test_publication_crud_and_isolation(client, new_user, auth):
    headers, _, _ = new_user()
    created = client.post("/api/profile/publications", headers=headers, json={
        "title": "Deep reinforcement learning for warehouse robots", "year": 2024, "citation_count": 12,
        "doi": "10.1234/demo.5678", "keywords": ["reinforcement learning", "robotics"]})
    assert created.status_code == 201, created.text
    pub = created.json()
    assert pub["is_own"] and pub["url"] == "https://doi.org/10.1234/demo.5678"
    assert pub["domain"] in ("robotics", "ai_ml")
    upd = client.put(f"/api/profile/publications/{pub['id']}", headers=headers,
                     json={"title": "Updated title for the paper", "citation_count": 20})
    assert upd.status_code == 200 and upd.json()["citation_count"] == 20
    # another user cannot touch it
    assert client.delete(f"/api/profile/publications/{pub['id']}", headers=auth("researcher")).status_code == 404
    stats = client.get("/api/profile", headers=headers).json()["stats"]
    assert stats["publications"] == 1 and stats["citations"] == 20 and stats["h_index"] == 1
    assert client.delete(f"/api/profile/publications/{pub['id']}", headers=headers).status_code == 204


def test_doi_lookup_degrades_gracefully_offline(client, auth):
    resp = client.get("/api/profile/publications/lookup?doi=10.1038/s41586-024-08449-y", headers=auth("researcher"))
    assert resp.status_code == 503
    assert "manually" in resp.json()["detail"]


def test_patent_and_history_crud(client, new_user):
    headers, _, _ = new_user()
    pat = client.post("/api/profile/patents", headers=headers, json={
        "title": "Battery thermal management controller", "classification": "H01M 10/60", "status": "pending"})
    assert pat.status_code == 201
    assert pat.json()["technology_domain"] == "clean_energy" and pat.json()["record_type"] == "user"
    assert len(client.get("/api/profile/patents", headers=headers).json()) == 1

    bad = client.post("/api/profile/history", headers=headers,
                      json={"kind": "position", "title": "Postdoc", "start_year": 2022, "end_year": 2020})
    assert bad.status_code == 422
    ok = client.post("/api/profile/history", headers=headers,
                     json={"kind": "grant", "title": "Seed grant", "start_year": 2022, "end_year": 2024})
    assert ok.status_code == 201
    entry_id = ok.json()["id"]
    assert client.put(f"/api/profile/history/{entry_id}", headers=headers,
                      json={"kind": "grant", "title": "Seed grant (extended)", "start_year": 2022}).status_code == 200
    assert client.delete(f"/api/profile/history/{entry_id}", headers=headers).status_code == 204
