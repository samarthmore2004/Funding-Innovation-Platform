from datetime import date, timedelta

import pytest

from app.services import eligibility, recommender


def test_funding_search_pagination_and_filters(client, auth):
    resp = client.get("/api/funding?page=1&page_size=5", headers=auth("researcher"))
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["items"]) == 5 and body["total"] > 100 and body["pages"] >= 20
    deadlines = [i["deadline"] for i in body["items"] if i["deadline"]]
    assert deadlines == sorted(deadlines)

    accel = client.get("/api/funding?funder_type=startup_accelerator", headers=auth("researcher")).json()
    assert accel["total"] > 0 and all(i["funder_type"] == "startup_accelerator" for i in accel["items"])

    dom = client.get("/api/funding?domain=quantum&page_size=50", headers=auth("researcher")).json()
    assert dom["total"] > 0 and all("quantum" in i["domains"] for i in dom["items"])

    verified = client.get("/api/funding?record_type=verified&page_size=50", headers=auth("researcher")).json()
    assert verified["total"] > 0
    for item in verified["items"]:
        assert item["source_url"].startswith("https://www.grants.gov/") and item["verified_at"]

    illustrative = client.get("/api/funding?record_type=illustrative&page_size=50", headers=auth("researcher")).json()
    assert all(i["source_url"] is None for i in illustrative["items"])

    searched = client.get("/api/funding?q=quantum", headers=auth("researcher")).json()
    assert searched["total"] > 0


def test_funding_facets_and_detail(client, auth):
    facets = client.get("/api/funding/facets", headers=auth("researcher")).json()
    assert {f["value"] for f in facets["funder_types"]} >= {"government_grant", "startup_accelerator"}
    first = client.get("/api/funding?page_size=1", headers=auth("researcher")).json()["items"][0]
    detail = client.get(f"/api/funding/{first['id']}", headers=auth("researcher")).json()
    assert detail["eligibility"]["status"] in {"eligible", "partially_eligible", "ineligible"}
    assert 0 <= detail["match"]["match_score"] <= 100
    assert client.get("/api/funding/999999", headers=auth("researcher")).status_code == 404


def test_save_track_and_unsave(client, new_user):
    headers, _, _ = new_user()
    fid = client.get("/api/funding?page_size=1", headers=headers).json()["items"][0]["id"]
    saved = client.post(f"/api/funding/{fid}/save", headers=headers, json={"status": "interested", "notes": "Look"})
    assert saved.status_code == 200
    sid = saved.json()["id"]
    upd = client.patch(f"/api/funding/saved/{sid}", headers=headers, json={"status": "submitted"})
    assert upd.status_code == 200 and upd.json()["status"] == "submitted"
    assert len(client.get("/api/funding/saved", headers=headers).json()) == 1
    assert client.delete(f"/api/funding/{fid}/save", headers=headers).status_code == 204
    assert client.get("/api/funding/saved", headers=headers).json() == []


class _F:
    def __init__(self, **kw):
        self.status = kw.get("status", "open")
        self.deadline = kw.get("deadline", date.today() + timedelta(days=20))
        self.applicant_types = kw.get("applicant_types", ["researcher", "university"])
        self.eligible_countries = kw.get("eligible_countries", ["Global"])
        self.career_stages = kw.get("career_stages", [])


CTX = eligibility.ApplicantContext(role="researcher", applicant_types={"researcher", "university"},
                                   country="India", career_stage="early_career")


@pytest.mark.parametrize("kwargs,expected", [
    ({}, "eligible"),
    ({"eligible_countries": ["United States"]}, "ineligible"),
    ({"eligible_countries": ["European Union"]}, "ineligible"),
    ({"deadline": date.today() - timedelta(days=1)}, "ineligible"),
    ({"status": "closed"}, "ineligible"),
    ({"applicant_types": ["startup"]}, "ineligible"),
    ({"applicant_types": []}, "partially_eligible"),
    ({"career_stages": ["early_career"]}, "eligible"),
    ({"career_stages": ["senior"]}, "ineligible"),
    ({"deadline": None, "status": "rolling"}, "eligible"),
])
def test_eligibility_rules(kwargs, expected):
    assert eligibility.evaluate(_F(**kwargs), CTX)["status"] == expected


def test_eligibility_unknown_country_is_partial():
    ctx = eligibility.ApplicantContext(role="researcher", applicant_types={"researcher"})
    result = eligibility.evaluate(_F(eligible_countries=["India"]), ctx)
    assert result["status"] == "partially_eligible" and 0 < result["score"] < 1


def test_match_score_properties():
    assert recommender.relevance(0) == 0
    assert 0.5 < recommender.relevance(0.1) < recommender.relevance(0.3) < 1
    low = recommender.match_score(0.02, False, 0.5)
    high = recommender.match_score(0.3, True, 1.0)
    assert 0 <= low < high <= 100


def test_recommendations_endpoint(client, auth):
    resp = client.get("/api/recommendations?limit=8", headers=auth("researcher"))
    assert resp.status_code == 200
    body = resp.json()
    scores = [i["match_score"] for i in body["items"]]
    assert scores == sorted(scores, reverse=True) and len(scores) > 0
    assert all(i["eligibility"]["status"] != "ineligible" for i in body["items"])
    assert body["items"][0]["reasons"] and body["profile_terms"]
    top = body["items"][0]["funding"]
    assert set(top["domains"]) & {"ai_ml", "digital_health", "computer_vision"}, "top match should fit the profile"
    with_inel = client.get("/api/recommendations?limit=50&include_ineligible=true", headers=auth("researcher")).json()
    assert any(i["eligibility"]["status"] == "ineligible" for i in with_inel["items"])


def test_recommendations_for_empty_profile_explain_themselves(client, new_user):
    headers, _, _ = new_user()
    body = client.get("/api/recommendations", headers=headers).json()
    assert any("profile is empty" in n for n in body["notes"])


def test_recommendation_feedback(client, auth):
    fid = client.get("/api/recommendations?limit=1", headers=auth("founder")).json()["items"][0]["funding"]["id"]
    assert client.post("/api/recommendations/feedback", headers=auth("founder"),
                       json={"funding_id": fid, "action": "clicked"}).status_code == 200
    assert client.post("/api/recommendations/feedback", headers=auth("founder"),
                       json={"funding_id": fid, "action": "bogus"}).status_code == 422


def test_ingest_unescapes_html_and_neutralises_stale_forecasts(db):
    from app.services import data_import
    past = (date.today() - timedelta(days=400)).isoformat()
    rec = {"title": "CHIPS Incentives &ndash; Test", "organization": "Agency &amp; Partners",
           "funder_type": "government_grant", "description": "Semiconductor manufacturing incentives",
           "status": "forecasted", "deadline": past, "external_id": "test:stale-forecast",
           "eligibility_text": "Original text."}
    item = data_import.upsert_funding(db, rec, "verified")
    assert item.title == "CHIPS Incentives – Test" and item.organization == "Agency & Partners"
    assert item.status == "forecasted" and item.deadline is None
    assert past in item.eligibility_text and item.eligibility_text.endswith("Original text.")
    open_rec = {**rec, "status": "open", "external_id": "test:past-open"}
    assert data_import.upsert_funding(db, open_rec, "verified").status == "closed"
    imported = data_import.upsert_funding(db, {**rec, "status": "open", "deadline": None,
                                               "external_id": "test:imported"}, "imported")
    assert imported.source_name.startswith("Imported by administrator")
    db.rollback()


def test_recommendations_exclude_zero_relevance(client, auth):
    items = client.get("/api/recommendations?limit=50", headers=auth("manager")).json()["items"]
    assert items
    assert all(i["similarity"] >= recommender.MIN_SIMILARITY or i["domain_match"] for i in items)


def test_offline_evaluation_quality(db):
    result = recommender.evaluate_offline(db, k=5)
    assert result["personas"] == 15
    assert result["precision_at_k"] >= 0.6 and result["recall_at_k"] >= 0.6
