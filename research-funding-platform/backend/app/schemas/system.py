from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel, UTCDateTime


class NotificationOut(ORMModel):
    id: int
    type: str
    title: str
    message: str
    link: str | None = None
    priority: str = "normal"
    is_read: bool
    created_at: UTCDateTime


class BroadcastIn(BaseModel):
    title: str = Field(min_length=3, max_length=300)
    message: str = Field(min_length=3, max_length=4000)
    roles: list[Literal["researcher", "startup_founder", "innovation_manager", "admin"]] | None = None


class ImportOut(ORMModel):
    id: int
    dataset: str
    filename: str | None = None
    source: str
    status: str
    rows_total: int
    rows_imported: int
    rows_failed: int
    errors: list[str] = []
    created_at: UTCDateTime
    user_email: str | None = None


class AuditLogOut(ORMModel):
    id: int
    user_email: str | None = None
    action: str
    entity_type: str | None = None
    entity_id: str | None = None
    detail: str | None = None
    ip_address: str | None = None
    created_at: UTCDateTime


class ReportRecordOut(ORMModel):
    id: int
    report_type: str
    format: str
    filename: str
    row_count: int
    created_at: UTCDateTime


class JobRunOut(BaseModel):
    name: str
    status: str
    detail: str | None = None
    started_at: UTCDateTime
    finished_at: UTCDateTime | None = None
