import pytest

from app.services import scoring

PROJECT = {
    "title": "Edge AI crop disease detection for smallholder farms",
    "description": "Smartphone computer vision models that detect crop diseases offline and recommend treatments to "
                   "smallholder farmers, validated with agricultural extension partners.",
    "domain": "agritech", "keywords": ["computer vision", "crop", "precision agriculture"], "stage": "prototype",
    "trl": 5, "market_size": "large", "target_market": "Smallholder farmers", "patents_filed": 1,
    "patents_granted": 0, "team_size": 5, "has_industry_partner": False,
}


def test_weights_follow_specification():
    assert scoring.WEIGHTS == {"research_novelty": 0.30, "patent_strength": 0.20, "technology_maturity": 0.15,
                               "market_potential": 0.20, "funding_relevance": 0.15}
    assert sum(scoring.WEIGHTS.values()) == pytest.approx(1.0)


@pytest.mark.parametrize("value,band", [(80, "High"), (75, "High"), (65, "Promising"), (45, "Developing"), (10, "Early")])
def test_band_thresholds(value, band):
    assert scoring.band(value) == band


def test_score_preview_is_consistent_and_not_persisted(client, auth):
    resp = client.post("/api/innovation/score-preview", headers=auth("founder"), json=PROJECT)
    assert resp.status_code == 200, resp.text
    score = resp.json()
    assert score["id"] is None
    assert len(score["components"]) == 5
    for comp in score["components"]:
        assert 0 <= comp["value"] <= 100
        assert comp["weighted"] == pytest.approx(comp["value"] * comp["weight"], abs=0.01)
        assert comp["explanation"] and comp["factors"]
    assert score["overall"] == pytest.approx(sum(c["weighted"] for c in score["components"]), abs=0.15)
    assert "not a validated prediction" in score["disclaimer"]


def test_score_monotonic_in_trl_and_ip(db):
    base = scoring.ProjectInput(**PROJECT)
    low_trl = scoring.compute(db, scoring.ProjectInput(**{**PROJECT, "trl": 2, "stage": "research"}), None)
    high_trl = scoring.compute(db, scoring.ProjectInput(**{**PROJECT, "trl": 8, "stage": "pilot"}), None)
    get = lambda r, k: next(c["value"] for c in r["components"] if c["key"] == k)  # noqa: E731
    assert get(high_trl, "technology_maturity") > get(low_trl, "technology_maturity")
    weak_ip = scoring.compute(db, base, None)
    strong_ip = scoring.compute(db, scoring.ProjectInput(**{**PROJECT, "patents_filed": 4, "patents_granted": 3}), None)
    assert get(strong_ip, "patent_strength") > get(weak_ip, "patent_strength")
    big = scoring.compute(db, scoring.ProjectInput(**{**PROJECT, "market_size": "very_large"}), None)
    small = scoring.compute(db, scoring.ProjectInput(**{**PROJECT, "market_size": "niche"}), None)
    assert get(big, "market_potential") > get(small, "market_potential")


def test_project_lifecycle_scoring_and_history(client, auth, new_user):
    headers, _, _ = new_user("startup_founder")
    created = client.post("/api/innovation/projects", headers=headers, json=PROJECT)
    assert created.status_code == 201
    pid = created.json()["id"]
    assert created.json()["latest_score"] is None
    first = client.post(f"/api/innovation/projects/{pid}/score", headers=headers)
    assert first.status_code == 200 and first.json()["id"]
    client.put(f"/api/innovation/projects/{pid}", headers=headers, json={**PROJECT, "trl": 7, "stage": "pilot"})
    second = client.post(f"/api/innovation/projects/{pid}/score", headers=headers).json()
    detail = client.get(f"/api/innovation/projects/{pid}", headers=headers).json()
    assert len(detail["score_history"]) == 2
    assert detail["latest_score"]["id"] == second["id"]
    # other non-manager users cannot see it; managers can and may move the stage
    assert client.get(f"/api/innovation/projects/{pid}", headers=auth("researcher")).status_code == 403
    assert client.patch(f"/api/innovation/projects/{pid}/stage", headers=auth("manager"),
                        json={"stage": "market_ready"}).json()["stage"] == "market_ready"
    assert client.put(f"/api/innovation/projects/{pid}", headers=auth("manager"), json=PROJECT).status_code == 403
    invalid = client.post("/api/innovation/projects", headers=headers, json={**PROJECT, "trl": 12})
    assert invalid.status_code == 422
    assert client.delete(f"/api/innovation/projects/{pid}", headers=headers).status_code == 204


def test_weights_endpoint(client, auth):
    body = client.get("/api/innovation/weights", headers=auth("researcher")).json()
    assert body["weights"]["research_novelty"] == 0.30 and "Innovation Score" in body["formula"]


def test_portfolio(client, auth):
    manager = client.get("/api/innovation/portfolio", headers=auth("manager")).json()
    assert manager["projects_count"] >= 12 and manager["scored_count"] >= 12
    assert {s["stage"] for s in manager["by_stage"]} == {"idea", "research", "prototype", "pilot", "market_ready"}
    own = client.get("/api/innovation/portfolio", headers=auth("researcher")).json()
    assert own["projects_count"] == 2


def test_commercialization_analysis(client, auth):
    projects = client.get("/api/innovation/projects", headers=auth("founder")).json()
    pid = projects[0]["id"]
    resp = client.get(f"/api/commercialization/projects/{pid}", headers=auth("founder"))
    assert resp.status_code == 200, resp.text
    body = resp.json()
    fits = [p["fit_score"] for p in body["pathways"]]
    assert len(fits) == 5 and fits == sorted(fits, reverse=True)
    assert body["pathways"][0]["recommended"] is True
    assert {p["key"] for p in body["pathways"]} == {"licensing", "startup", "productization",
                                                   "industry_partnership", "grant_research"}
    assert body["productization_ideas"] and body["risks"] and body["summary"]
    assert body["project"]["id"] == pid
    overview = client.get("/api/commercialization/overview", headers=auth("founder")).json()
    assert len(overview["items"]) == len(projects)
    assert client.get(f"/api/commercialization/projects/{pid}", headers=auth("researcher")).status_code == 403
