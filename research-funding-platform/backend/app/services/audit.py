"""Audit trail helper (security & compliance module)."""
from __future__ import annotations

import json
import logging

from sqlalchemy.orm import Session

from app.models import AuditLog, User

logger = logging.getLogger("rfip.audit")


def record(db: Session, action: str, user: User | None = None, *, entity_type: str | None = None,
           entity_id: str | int | None = None, detail: str | dict | None = None, ip: str | None = None,
           email: str | None = None, commit: bool = True) -> None:
    if isinstance(detail, dict):
        detail = json.dumps(detail, default=str)[:4000]
    entry = AuditLog(user_id=user.id if user else None, user_email=(user.email if user else email),
                     action=action, entity_type=entity_type,
                     entity_id=str(entity_id) if entity_id is not None else None, detail=detail, ip_address=ip)
    db.add(entry)
    if commit:
        db.commit()
    logger.info("audit action=%s user=%s entity=%s:%s", action, entry.user_email, entity_type, entity_id)
