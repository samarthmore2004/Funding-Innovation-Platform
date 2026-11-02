"""Publications, patents and publication-trend snapshot points."""
from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import JSON, Date, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, utcnow


class Publication(Base):
    __tablename__ = "publications"

    id: Mapped[int] = mapped_column(primary_key=True)
    owner_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    title: Mapped[str] = mapped_column(String(500))
    abstract: Mapped[str | None] = mapped_column(Text, nullable=True)
    authors: Mapped[list] = mapped_column(JSON, default=list)
    venue: Mapped[str | None] = mapped_column(String(300), nullable=True)
    year: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    publication_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    doi: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    citation_count: Mapped[int] = mapped_column(Integer, default=0)
    domain: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    keywords: Mapped[list] = mapped_column(JSON, default=list)
    pub_type: Mapped[str | None] = mapped_column(String(64), nullable=True)
    source: Mapped[str] = mapped_column(String(32), default="manual", index=True)
    external_id: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Patent(Base):
    __tablename__ = "patents"

    id: Mapped[int] = mapped_column(primary_key=True)
    owner_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    patent_number: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    title: Mapped[str] = mapped_column(String(500))
    abstract: Mapped[str | None] = mapped_column(Text, nullable=True)
    assignee: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    inventors: Mapped[list] = mapped_column(JSON, default=list)
    filing_date: Mapped[date | None] = mapped_column(Date, nullable=True, index=True)
    grant_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="pending")
    classification: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    technology_domain: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    citation_count: Mapped[int] = mapped_column(Integer, default=0)
    jurisdiction: Mapped[str | None] = mapped_column(String(16), nullable=True)
    keywords: Mapped[list] = mapped_column(JSON, default=list)
    source: Mapped[str] = mapped_column(String(64), default="manual")
    record_type: Mapped[str] = mapped_column(String(32), default="user", index=True)
    url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class TrendPoint(Base):
    """Yearly publication counts per technology area (from the OpenAlex snapshot or live sync)."""
    __tablename__ = "publication_trend_points"
    __table_args__ = (UniqueConstraint("area_key", "year", "source", name="uq_trend_area_year_source"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    area_key: Mapped[str] = mapped_column(String(64), index=True)
    year: Mapped[int] = mapped_column(Integer)
    count: Mapped[int] = mapped_column(Integer, default=0)
    source: Mapped[str] = mapped_column(String(64), default="openalex")
    retrieved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
