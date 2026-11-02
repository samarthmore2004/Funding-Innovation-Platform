"""Recommendations, research trends, patent landscape and technology intelligence endpoints."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models import FundingOpportunity, Patent, RecommendationFeedback, User
from app.schemas.common import Message
from app.schemas.funding import FeedbackIn
from app.services import innovation_service, patent_analytics, recommender, research_analytics, technology_intel
from app.services.external import patentsview
from app.services.external.http import ExternalServiceError

recommendations = APIRouter(prefix="/recommendations", tags=["Recommendations"])
research = APIRouter(prefix="/research", tags=["Research trend intelligence"])
patents = APIRouter(prefix="/patents", tags=["Patent landscape"])
technology = APIRouter(prefix="/technology", tags=["Technology intelligence"])


# ---------------------------------------------------------------- recommendations
@recommendations.get("")
def get_recommendations(limit: int = Query(10, ge=1, le=50), include_ineligible: bool = False,
                        funder_type: str | None = None, min_score: float = Query(0, ge=0, le=100),
                        user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    return recommender.recommend(db, user, limit=limit, include_ineligible=include_ineligible,
                                 funder_type=funder_type, min_score=min_score, log=True)


@recommendations.get("/project/{project_id}")
def project_recommendations(project_id: int, limit: int = Query(10, ge=1, le=50), user: User = Depends(get_current_user),
                            db: Session = Depends(get_db)) -> dict:
    project = innovation_service.get_project(db, project_id, user)
    return recommender.recommend(db, user, limit=limit, project=project, log=True)


@recommendations.post("/feedback", response_model=Message)
def feedback(payload: FeedbackIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> Message:
    if db.get(FundingOpportunity, payload.funding_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Funding opportunity not found")
    db.add(RecommendationFeedback(user_id=user.id, funding_id=payload.funding_id, action=payload.action))
    db.commit()
    return Message(detail="Feedback recorded")


# ---------------------------------------------------------------- research
@research.get("/overview")
def research_overview(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    return research_analytics.overview(db)


@research.get("/trends")
def research_trends(domains: str | None = None, start_year: int | None = Query(None, ge=1990, le=2100),
                    end_year: int | None = Query(None, ge=1990, le=2100), user: User = Depends(get_current_user),
                    db: Session = Depends(get_db)) -> dict:
    selected = [d.strip() for d in domains.split(",") if d.strip()] if domains else None
    if not selected:
        from app.services.dashboard_service import _interests
        selected = _interests(db, user)[:5] or None
    return research_analytics.trends(db, selected, start_year, end_year)


@research.get("/emerging-topics")
def research_emerging(domain: str | None = None, limit: int = Query(15, ge=1, le=40),
                      user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    return research_analytics.emerging_topics(db, domain, limit)


@research.get("/hotspots")
def research_hotspots(limit: int = Query(8, ge=1, le=20), user: User = Depends(get_current_user),
                      db: Session = Depends(get_db)) -> dict:
    return research_analytics.hotspots(db, limit)


@research.get("/citations")
def research_citations(domain: str | None = None, user: User = Depends(get_current_user),
                       db: Session = Depends(get_db)) -> dict:
    return research_analytics.citations(db, domain)


@research.get("/publications")
def research_publications(q: str | None = None, domain: str | None = None, year_from: int | None = None,
                          year_to: int | None = None, sort: str = Query("citations", pattern="^(citations|year|title)$"),
                          page: int = Query(1, ge=1), page_size: int = Query(10, ge=1, le=100),
                          user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    return research_analytics.search_publications(db, q, domain, year_from, year_to, sort, page, page_size)


@research.get("/live-trend")
def research_live_trend(query: str = Query(min_length=2, max_length=120), start_year: int | None = Query(None, ge=1990),
                        end_year: int | None = Query(None, le=2100), user: User = Depends(get_current_user),
                        db: Session = Depends(get_db)) -> dict:
    return research_analytics.live_trend(db, query, start_year, end_year)


@research.get("/my-analytics")
def research_my_analytics(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    return research_analytics.my_analytics(db, user)


# ---------------------------------------------------------------- patents
@patents.get("")
def patent_search(q: str | None = None, assignee: str | None = None, classification: str | None = None,
                  domain: str | None = None, status_: str | None = Query(None, alias="status"),
                  year_from: int | None = None, year_to: int | None = None,
                  sort: str = Query("filing_date", pattern="^(filing_date|citations|title)$"),
                  page: int = Query(1, ge=1), page_size: int = Query(12, ge=1, le=100),
                  user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    return patent_analytics.search(db, q, assignee, classification, domain, status_, year_from, year_to, sort, page,
                                   page_size)


@patents.get("/facets")
def patent_facets(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    return patent_analytics.facets(db)


@patents.get("/analytics/trends")
def patent_trends(domain: str | None = None, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    return patent_analytics.trends(db, domain)


@patents.get("/analytics/assignees")
def patent_assignees(domain: str | None = None, limit: int = Query(10, ge=1, le=50),
                     user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    return patent_analytics.assignees(db, domain, limit)


@patents.get("/analytics/competitors")
def patent_competitors(assignees: str = Query(min_length=2), user: User = Depends(get_current_user),
                       db: Session = Depends(get_db)) -> dict:
    names = [a.strip() for a in assignees.split(",") if a.strip()]
    if not 1 <= len(names) <= 5:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Provide between 1 and 5 assignees")
    return patent_analytics.competitors(db, names)


@patents.get("/analytics/clusters")
def patent_clusters(domain: str | None = None, k: int | None = Query(None, ge=2, le=12),
                    user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    return patent_analytics.clusters(db, domain, k)


@patents.get("/analytics/innovation-map")
def patent_innovation_map(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    return patent_analytics.innovation_map(db)


@patents.get("/live-search")
def patent_live_search(q: str = Query(min_length=2, max_length=120), user: User = Depends(get_current_user)) -> dict:
    try:
        items = patentsview.search(q)
    except ExternalServiceError as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(exc)) from exc
    return {"source": "patentsview", "items": items, "note": "Live results from the USPTO PatentsView API."}


@patents.get("/{patent_id}")
def patent_detail(patent_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    patent = db.get(Patent, patent_id)
    if patent is None or (patent.owner_id is not None and patent.owner_id != user.id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Patent not found")
    return patent_analytics.get_with_similar(db, patent)


# ---------------------------------------------------------------- technology
@technology.get("/areas")
def tech_areas(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    return technology_intel.list_areas(db)


@technology.get("/areas/{key}")
def tech_area(key: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    detail = technology_intel.area_detail(db, key)
    if detail is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Unknown technology area")
    return detail


@technology.get("/emerging")
def tech_emerging(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    return technology_intel.emerging(db)


@technology.get("/opportunities")
def tech_opportunities(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    return technology_intel.opportunities(db)


@technology.get("/adoption")
def tech_adoption(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    return technology_intel.adoption(db)


@technology.get("/competitive")
def tech_competitive(area: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    from app.core import taxonomy
    if not taxonomy.area_by_key(area):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Unknown technology area")
    return technology_intel.competitive(db, area)
