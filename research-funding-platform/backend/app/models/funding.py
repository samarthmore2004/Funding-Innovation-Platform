from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import JSON, Date, DateTime, Float, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, utcnow


class FundingOpportunity(Base):
    __tablename__ = "funding_opportunities"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(500))
    organization: Mapped[str] = mapped_column(String(300), index=True)
    funder_type: Mapped[str] = mapped_column(String(48), index=True)
    description: Mapped[str] = mapped_column(Text, default="")
    domains: Mapped[list] = mapped_column(JSON, default=list)
    keywords: Mapped[list] = mapped_column(JSON, default=list)
    eligibility_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    applicant_types: Mapped[list] = mapped_column(JSON, default=list)
    eligible_countries: Mapped[list] = mapped_column(JSON, default=list)
    career_stages: Mapped[list] = mapped_column(JSON, default=list)
    min_amount: Mapped[float | None] = mapped_column(Float, nullable=True)
    max_amount: Mapped[float | None] = mapped_column(Float, nullable=True)
    currency: Mapped[str] = mapped_column(String(8), default="USD")
    open_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    deadline: Mapped[date | None] = mapped_column(Date, nullable=True, index=True)
    status: Mapped[str] = mapped_column(String(24), default="open", index=True)
    source_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    source_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    record_type: Mapped[str] = mapped_column(String(24), default="illustrative", index=True)
    verified_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    external_id: Mapped[str | None] = mapped_column(String(255), nullable=True, unique=True)
    created_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)


class SavedFunding(Base):
    __tablename__ = "saved_funding"
    __table_args__ = (UniqueConstraint("user_id", "funding_id", name="uq_saved_user_funding"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    funding_id: Mapped[int] = mapped_column(ForeignKey("funding_opportunities.id", ondelete="CASCADE"), index=True)
    status: Mapped[str] = mapped_column(String(24), default="interested")
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)

    funding: Mapped[FundingOpportunity] = relationship(lazy="joined")


class RecommendationLog(Base):
    __tablename__ = "recommendation_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    funding_id: Mapped[int] = mapped_column(ForeignKey("funding_opportunities.id", ondelete="CASCADE"), index=True)
    match_score: Mapped[float] = mapped_column(Float)
    similarity: Mapped[float] = mapped_column(Float)
    eligibility_status: Mapped[str] = mapped_column(String(24))
    context: Mapped[str] = mapped_column(String(32), default="profile")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)


class RecommendationFeedback(Base):
    __tablename__ = "recommendation_feedback"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    funding_id: Mapped[int] = mapped_column(ForeignKey("funding_opportunities.id", ondelete="CASCADE"), index=True)
    action: Mapped[str] = mapped_column(String(16))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
