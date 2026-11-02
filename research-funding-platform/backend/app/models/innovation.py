from __future__ import annotations

from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, utcnow


class InnovationProject(Base):
    __tablename__ = "innovation_projects"

    id: Mapped[int] = mapped_column(primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(300))
    description: Mapped[str] = mapped_column(Text, default="")
    domain: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    keywords: Mapped[list] = mapped_column(JSON, default=list)
    stage: Mapped[str] = mapped_column(String(24), default="idea", index=True)
    trl: Mapped[int] = mapped_column(Integer, default=1)
    market_size: Mapped[str] = mapped_column(String(24), default="medium")
    target_market: Mapped[str | None] = mapped_column(String(300), nullable=True)
    patents_filed: Mapped[int] = mapped_column(Integer, default=0)
    patents_granted: Mapped[int] = mapped_column(Integer, default=0)
    team_size: Mapped[int | None] = mapped_column(Integer, nullable=True)
    has_industry_partner: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)

    owner = relationship("User", lazy="joined")
    scores: Mapped[list[InnovationScore]] = relationship(
        back_populates="project", cascade="all, delete-orphan", order_by="desc(InnovationScore.id)")

    @property
    def latest_score(self) -> InnovationScore | None:
        return self.scores[0] if self.scores else None


class InnovationScore(Base):
    __tablename__ = "innovation_scores"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("innovation_projects.id", ondelete="CASCADE"), index=True)
    computed_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    overall: Mapped[float] = mapped_column(Float)
    band: Mapped[str] = mapped_column(String(24))
    research_novelty: Mapped[float] = mapped_column(Float)
    patent_strength: Mapped[float] = mapped_column(Float)
    technology_maturity: Mapped[float] = mapped_column(Float)
    market_potential: Mapped[float] = mapped_column(Float)
    funding_relevance: Mapped[float] = mapped_column(Float)
    details: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)

    project: Mapped[InnovationProject] = relationship(back_populates="scores")
