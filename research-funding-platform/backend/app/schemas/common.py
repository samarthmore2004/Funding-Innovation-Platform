from __future__ import annotations

from datetime import datetime, timezone
from typing import Annotated, Generic, TypeVar

from pydantic import BaseModel, ConfigDict, PlainSerializer

T = TypeVar("T")


def iso_utc(value: datetime | None) -> str | None:
    """Serialise naive-UTC datetimes from the DB as explicit UTC ISO strings."""
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


UTCDateTime = Annotated[datetime, PlainSerializer(iso_utc, return_type=str)]


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int
    pages: int


class Message(BaseModel):
    detail: str


def paginate_meta(total: int, page: int, page_size: int) -> dict:
    pages = max(1, -(-total // page_size)) if page_size else 1
    return {"total": total, "page": page, "page_size": page_size, "pages": pages}
