"""Account settings and personal-data rights (export / delete)."""
from __future__ import annotations

import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import client_ip, get_current_user
from app.core.security import verify_password
from app.db.session import get_db
from app.models import (InnovationProject, Notification, Patent, Publication, ResearchHistoryEntry, ResearchProfile,
                        SavedFunding, User)
from app.schemas.common import Message
from app.schemas.funding import SavedOut
from app.schemas.profile import HistoryOut, PatentOut, ProfileOut, PublicationOut
from app.schemas.user import DeleteAccountIn, UserOut, UserUpdate
from app.services import audit, innovation_service

router = APIRouter(prefix="/users", tags=["Account"])


@router.patch("/me", response_model=UserOut)
def update_me(payload: UserUpdate, request: Request, user: User = Depends(get_current_user),
              db: Session = Depends(get_db)) -> UserOut:
    data = payload.model_dump(exclude_unset=True)
    if "full_name" in data and data["full_name"]:
        user.full_name = data["full_name"].strip()
    if "organization" in data:
        user.organization = data["organization"]
    if data.get("notification_preferences") is not None:
        user.notification_preferences = payload.notification_preferences.model_dump()
    db.commit()
    db.refresh(user)
    audit.record(db, "user.settings_updated", user, entity_type="user", entity_id=user.id,
                 detail={"fields": sorted(data)}, ip=client_ip(request))
    return UserOut.from_user(user)


@router.get("/me/export", summary="Download all personal data (data portability)")
def export_me(request: Request, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> Response:
    profile = db.execute(select(ResearchProfile).where(ResearchProfile.user_id == user.id)).scalar_one_or_none()
    payload = {
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "account": UserOut.from_user(user).model_dump(mode="json"),
        "profile": ProfileOut.model_validate(profile).model_dump(mode="json") if profile else None,
        "publications": [PublicationOut.from_model(p).model_dump(mode="json") for p in
                         db.execute(select(Publication).where(Publication.owner_id == user.id)).scalars()],
        "patents": [PatentOut.from_model(p).model_dump(mode="json") for p in
                    db.execute(select(Patent).where(Patent.owner_id == user.id)).scalars()],
        "research_history": [HistoryOut.model_validate(h).model_dump(mode="json") for h in
                             db.execute(select(ResearchHistoryEntry).where(ResearchHistoryEntry.user_id == user.id)).scalars()],
        "saved_funding": [SavedOut.from_model(s).model_dump(mode="json") for s in
                          db.execute(select(SavedFunding).where(SavedFunding.user_id == user.id)).scalars()],
        "projects": [innovation_service.to_out(p) for p in
                     db.execute(select(InnovationProject).where(InnovationProject.owner_id == user.id)).scalars()],
        "notifications": [{"type": n.type, "title": n.title, "created_at": n.created_at.isoformat()} for n in
                          db.execute(select(Notification).where(Notification.user_id == user.id)).scalars()],
    }
    audit.record(db, "user.data_exported", user, ip=client_ip(request))
    return Response(json.dumps(payload, indent=2, default=str), media_type="application/json",
                    headers={"Content-Disposition": f'attachment; filename="rfip-my-data-{user.id}.json"'})


@router.post("/me/delete", response_model=Message, summary="Anonymise and deactivate my account")
def delete_me(payload: DeleteAccountIn, request: Request, user: User = Depends(get_current_user),
              db: Session = Depends(get_db)) -> Message:
    if user.hashed_password and not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Password is incorrect")
    if user.role == "admin":
        remaining = db.execute(select(User.id).where(User.role == "admin", User.is_active.is_(True),
                                                     User.id != user.id)).first()
        if not remaining:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "The last active administrator cannot delete the account")
    audit.record(db, "user.account_deleted", user, entity_type="user", entity_id=user.id, ip=client_ip(request),
                 commit=False)
    for model, column in ((Publication, Publication.owner_id), (Patent, Patent.owner_id),
                          (ResearchHistoryEntry, ResearchHistoryEntry.user_id), (SavedFunding, SavedFunding.user_id),
                          (Notification, Notification.user_id), (InnovationProject, InnovationProject.owner_id)):
        for row in db.execute(select(model).where(column == user.id)).scalars():
            db.delete(row)
    profile = db.execute(select(ResearchProfile).where(ResearchProfile.user_id == user.id)).scalar_one_or_none()
    if profile:
        db.delete(profile)
    user.email = f"deleted-user-{user.id}@deleted.invalid"
    user.full_name = "Deleted user"
    user.organization = None
    user.hashed_password = None
    user.is_active = False
    db.commit()
    return Message(detail="Your account has been anonymised and deactivated")
