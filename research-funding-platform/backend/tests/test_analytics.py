def test_research_endpoints(client, auth):
    h = auth("researcher")
    ov = client.get("/api/research/overview", headers=h).json()
    assert ov["total_publications"] >= 600 and ov["trend_points"] >= 200
    trends = client.get("/api/research/trends?domains=quantum,ai_ml&start_year=2015&end_year=2025", headers=h).json()
    assert trends["source"] == "openalex_snapshot"
    assert len(trends["series"]) == 11 and trends["series"][0]["quantum"] > 0
    assert {g["domain"] for g in trends["growth"]} == {"quantum", "ai_ml"}
    default = client.get("/api/research/trends", headers=h).json()
    assert {d["key"] for d in default["domains"]} <= {"ai_ml", "digital_health", "computer_vision"}

    emerging = client.get("/api/research/emerging-topics?limit=10", headers=h).json()
    assert emerging["items"] and emerging["window"]["recent"][1] > emerging["window"]["previous"][1]
    assert all(i["recent_count"] >= 4 for i in emerging["items"])

    hot = client.get("/api/research/hotspots", headers=h).json()
    assert hot["items"] and all(0 <= i["hotspot_score"] <= 100 for i in hot["items"])

    cit = client.get("/api/research/citations", headers=h).json()
    assert cit["by_year"] and cit["top_cited"]
    assert sum(b["count"] for b in cit["distribution"]) >= 600

    pubs = client.get("/api/research/publications?domain=nlp&sort=year&page_size=5", headers=h).json()
    assert pubs["total"] > 0 and all(p["domain"] == "nlp" for p in pubs["items"])

    mine = client.get("/api/research/my-analytics", headers=h).json()
    assert mine["total_publications"] == 4 and mine["h_index"] >= 3


def test_live_trend_falls_back_when_openalex_unavailable(client, auth):
    body = client.get("/api/research/live-trend?query=quantum computing", headers=auth("researcher")).json()
    assert body["source"] == "local_fallback" and "unavailable" in body["note"]
    assert len(body["series"]) == 10


def test_patent_endpoints(client, auth):
    h = auth("founder")
    page = client.get("/api/patents?domain=clean_energy&sort=citations&page_size=5", headers=h).json()
    assert page["total"] > 0
    cites = [p["citation_count"] for p in page["items"]]
    assert cites == sorted(cites, reverse=True)
    assert all(p["record_type"] == "illustrative" for p in page["items"])
    facets = client.get("/api/patents/facets", headers=h).json()
    assert facets["assignees"] and facets["classifications"]
    trends = client.get("/api/patents/analytics/trends", headers=h).json()
    assert trends["series"] and all("total" in r for r in trends["series"])
    assignees = client.get("/api/patents/analytics/assignees?limit=5", headers=h).json()["items"]
    assert len(assignees) == 5
    names = ",".join(a["assignee"] for a in assignees[:2])
    comp = client.get(f"/api/patents/analytics/competitors?assignees={names}", headers=h).json()
    assert len(comp["summary"]) == 2 and comp["by_year"]
    clusters = client.get("/api/patents/analytics/clusters", headers=h).json()
    assert 3 <= clusters["k"] <= 8 and len(clusters["points"]) >= 500
    imap = client.get("/api/patents/analytics/innovation-map", headers=h).json()
    assert imap["cells"] and imap["assignees"]
    detail = client.get(f"/api/patents/{page['items'][0]['id']}", headers=h).json()
    assert len(detail["similar"]) == 5
    live = client.get("/api/patents/live-search?q=battery", headers=h)
    assert live.status_code == 503 and "PATENTSVIEW_API_KEY" in live.json()["detail"]


def test_technology_endpoints(client, auth):
    h = auth("manager")
    areas = client.get("/api/technology/areas", headers=h).json()
    assert len(areas["items"]) == 15 and areas["notes"]
    for a in areas["items"]:
        for key in ("maturity_index", "emerging_score", "adoption_index", "opportunity_score"):
            assert 0 <= a[key] <= 100
        assert a["maturity_stage"] in {"Emerging", "Growing", "Maturing", "Established"}
    detail = client.get("/api/technology/areas/quantum", headers=h).json()
    assert detail["publication_series"] and detail["patent_series"]
    assert client.get("/api/technology/areas/unknown", headers=h).status_code == 404
    emerging = client.get("/api/technology/emerging", headers=h).json()["items"]
    assert emerging[0]["emerging_score"] >= emerging[-1]["emerging_score"]
    opps = client.get("/api/technology/opportunities", headers=h).json()["items"]
    assert opps and opps[0]["rationale"]
    adoption = client.get("/api/technology/adoption", headers=h).json()
    last, first = adoption["series"][-1], adoption["series"][0]
    assert all(last[a["key"]] >= first[a["key"]] for a in adoption["areas"])
    comp = client.get("/api/technology/competitive?area=robotics", headers=h).json()
    assert comp["assignees"] and abs(sum(a["share"] for a in comp["assignees"]) - 1) < 0.01


def test_dashboards_by_role(client, auth):
    expectations = {"researcher": ("researcher", "recommendations"), "founder": ("startup", "funding_opportunities"),
                    "manager": ("manager", "portfolio"), "admin": ("admin", "platform")}
    for role, (view, key) in expectations.items():
        body = client.get("/api/dashboard", headers=auth(role)).json()
        assert body["view"] == view and key in body and len(body["kpis"]) == 5
    preview = client.get("/api/dashboard?view=researcher", headers=auth("manager")).json()
    assert preview["view"] == "researcher"
    denied = client.get("/api/dashboard?view=admin", headers=auth("researcher")).json()
    assert denied["view"] == "researcher"
