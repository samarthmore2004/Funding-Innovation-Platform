"""Research profile, publications, patents and research-history management."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import taxonomy
from app.core.deps import get_current_user
from app.db.session import get_db
from app.models import Patent, Publication, ResearchHistoryEntry, User
from app.schemas.profile import (HistoryIn, HistoryOut, PatentIn, PatentOut, ProfileIn, ProfileOut, PublicationIn,
                                 PublicationOut)
from app.services import audit
from app.services.external import crossref, openalex
from app.services.external.http import ExternalServiceError
from app.services.profile_service import get_or_create_profile, to_profile_out

router = APIRouter(prefix="/profile", tags=["Research profile"])


@router.get("/options")
def options() -> dict:
    return taxonomy.options_payload()


@router.get("", response_model=ProfileOut)
def get_profile(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> ProfileOut:
    return to_profile_out(db, get_or_create_profile(db, user))


@router.put("", response_model=ProfileOut)
def update_profile(payload: ProfileIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> ProfileOut:
    profile = get_or_create_profile(db, user)
    for field, value in payload.model_dump().items():
        setattr(profile, field, value)
    db.commit()
    db.refresh(profile)
    audit.record(db, "profile.updated", user, entity_type="profile", entity_id=profile.id)
    return to_profile_out(db, profile)


# ---------------------------------------------------------------- publications
def _own(db: Session, model, item_id: int, user: User, owner_attr: str = "owner_id"):
    item = db.get(model, item_id)
    if item is None or getattr(item, owner_attr) != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Item not found")
    return item


@router.get("/publications", response_model=list[PublicationOut])
def list_publications(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[PublicationOut]:
    rows = db.execute(select(Publication).where(Publication.owner_id == user.id)
                      .order_by(Publication.year.desc().nulls_last(), Publication.id.desc())).scalars()
    return [PublicationOut.from_model(p) for p in rows]


@router.get("/publications/lookup")
def lookup_publication(doi: str = Query(min_length=6, max_length=255), user: User = Depends(get_current_user)) -> dict:
    """Fetch metadata for a DOI from Crossref, falling back to OpenAlex."""
    errors = []
    try:
        item = crossref.get_work_by_doi(doi)
        if item:
            return {"found": True, "source": "crossref", "publication": crossref.to_publication_record(item)}
    except ExternalServiceError as exc:
        errors.append(str(exc))
    try:
        work = openalex.get_work_by_doi(doi)
        if work:
            return {"found": True, "source": "openalex", "publication": openalex.to_publication_record(work)}
    except ExternalServiceError as exc:
        errors.append(str(exc))
    if errors and len(errors) == 2:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE,
                            "DOI lookup services are unavailable right now; please enter the publication manually. "
                            + " | ".join(errors))
    raise HTTPException(status.HTTP_404_NOT_FOUND, "No publication found for this DOI")


@router.post("/publications", response_model=PublicationOut, status_code=201)
def create_publication(payload: PublicationIn, user: User = Depends(get_current_user),
                       db: Session = Depends(get_db)) -> PublicationOut:
    data = payload.model_dump()
    if not data.get("domain"):
        guess = taxonomy.classify_text(f"{payload.title} {payload.abstract or ''} {' '.join(payload.keywords)}", 1)
        data["domain"] = guess[0] if guess else None
    if not data.get("year") and payload.publication_date:
        data["year"] = payload.publication_date.year
    if data.get("doi") and not data.get("url"):
        data["url"] = f"https://doi.org/{openalex.normalise_doi(data['doi'])}"
    pub = Publication(owner_id=user.id, source="manual", **data)
    db.add(pub)
    db.commit()
    db.refresh(pub)
    return PublicationOut.from_model(pub)


@router.put("/publications/{pub_id}", response_model=PublicationOut)
def update_publication(pub_id: int, payload: PublicationIn, user: User = Depends(get_current_user),
                       db: Session = Depends(get_db)) -> PublicationOut:
    pub = _own(db, Publication, pub_id, user)
    for k, v in payload.model_dump().items():
        setattr(pub, k, v)
    db.commit()
    db.refresh(pub)
    return PublicationOut.from_model(pub)


@router.delete("/publications/{pub_id}", status_code=204)
def delete_publication(pub_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> Response:
    db.delete(_own(db, Publication, pub_id, user))
    db.commit()
    return Response(status_code=204)


# ---------------------------------------------------------------- patents
@router.get("/patents", response_model=list[PatentOut])
def list_patents(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[PatentOut]:
    rows = db.execute(select(Patent).where(Patent.owner_id == user.id).order_by(Patent.id.desc())).scalars()
    return [PatentOut.from_model(p) for p in rows]


@router.post("/patents", response_model=PatentOut, status_code=201)
def create_patent(payload: PatentIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> PatentOut:
    data = payload.model_dump()
    if not data.get("technology_domain"):
        data["technology_domain"] = taxonomy.classify_cpc(payload.classification) or next(
            iter(taxonomy.classify_text(f"{payload.title} {payload.abstract or ''}", 1)), None)
    patent = Patent(owner_id=user.id, source="user", record_type="user", keywords=[], **data)
    db.add(patent)
    db.commit()
    db.refresh(patent)
    return PatentOut.from_model(patent)


@router.put("/patents/{patent_id}", response_model=PatentOut)
def update_patent(patent_id: int, payload: PatentIn, user: User = Depends(get_current_user),
                  db: Session = Depends(get_db)) -> PatentOut:
    patent = _own(db, Patent, patent_id, user)
    for k, v in payload.model_dump().items():
        setattr(patent, k, v)
    db.commit()
    db.refresh(patent)
    return PatentOut.from_model(patent)


@router.delete("/patents/{patent_id}", status_code=204)
def delete_patent(patent_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> Response:
    db.delete(_own(db, Patent, patent_id, user))
    db.commit()
    return Response(status_code=204)


# ---------------------------------------------------------------- research history
@router.get("/history", response_model=list[HistoryOut])
def list_history(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[HistoryOut]:
    rows = db.execute(select(ResearchHistoryEntry).where(ResearchHistoryEntry.user_id == user.id)
                      .order_by(ResearchHistoryEntry.start_year.desc().nulls_last())).scalars()
    return [HistoryOut.model_validate(h) for h in rows]


@router.post("/history", response_model=HistoryOut, status_code=201)
def create_history(payload: HistoryIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> HistoryOut:
    if payload.start_year and payload.end_year and payload.end_year < payload.start_year:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "end_year cannot be before start_year")
    entry = ResearchHistoryEntry(user_id=user.id, **payload.model_dump())
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return HistoryOut.model_validate(entry)


@router.put("/history/{entry_id}", response_model=HistoryOut)
def update_history(entry_id: int, payload: HistoryIn, user: User = Depends(get_current_user),
                   db: Session = Depends(get_db)) -> HistoryOut:
    entry = _own(db, ResearchHistoryEntry, entry_id, user, "user_id")
    if payload.start_year and payload.end_year and payload.end_year < payload.start_year:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "end_year cannot be before start_year")
    for k, v in payload.model_dump().items():
        setattr(entry, k, v)
    db.commit()
    db.refresh(entry)
    return HistoryOut.model_validate(entry)


@router.delete("/history/{entry_id}", status_code=204)
def delete_history(entry_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> Response:
    db.delete(_own(db, ResearchHistoryEntry, entry_id, user, "user_id"))
    db.commit()
    return Response(status_code=204)
