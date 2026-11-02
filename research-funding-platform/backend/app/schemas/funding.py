from __future__ import annotations

from datetime import date
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

from app.core import taxonomy
from app.schemas.common import ORMModel, UTCDateTime

FunderType = Literal["government_grant", "research_council", "innovation_fund", "startup_accelerator",
                     "venture_program", "international_agency"]
FundingStatus = Literal["open", "forecasted", "closed", "rolling"]
SavedStatus = Literal["interested", "preparing", "submitted", "awarded", "rejected"]
ApplicantType = Literal["researcher", "startup", "university", "enterprise", "nonprofit", "government"]


class FundingIn(BaseModel):
    title: str = Field(min_length=3, max_length=500)
    organization: str = Field(min_length=2, max_length=300)
    funder_type: FunderType
    description: str = Field(min_length=10, max_length=8000)
    domains: list[str] = Field(default_factory=list)
    keywords: list[str] = Field(default_factory=list)
    eligibility_text: str | None = Field(default=None, max_length=4000)
    applicant_types: list[ApplicantType] = Field(default_factory=list)
    eligible_countries: list[str] = Field(default_factory=lambda: ["Global"])
    career_stages: list[str] = Field(default_factory=list)
    min_amount: float | None = Field(default=None, ge=0)
    max_amount: float | None = Field(default=None, ge=0)
    currency: str = Field(default="USD", max_length=8)
    open_date: date | None = None
    deadline: date | None = None
    status: FundingStatus = "open"
    source_name: str | None = Field(default=None, max_length=200)
    source_url: str | None = Field(default=None, max_length=1000)

    @field_validator("domains")
    @classmethod
    def _domains(cls, v: list[str]) -> list[str]:
        keys = set(taxonomy.area_keys())
        bad = [d for d in v if d not in keys]
        if bad:
            raise ValueError(f"Unknown domain(s): {', '.join(bad)}")
        return list(dict.fromkeys(v))

    @field_validator("source_url")
    @classmethod
    def _url(cls, v: str | None) -> str | None:
        if v and not v.startswith(("http://", "https://")):
            raise ValueError("source_url must start with http:// or https://")
        return v or None

    @model_validator(mode="after")
    def _amounts(self):
        if self.min_amount is not None and self.max_amount is not None and self.min_amount > self.max_amount:
            raise ValueError("min_amount cannot exceed max_amount")
        return self


class FundingOut(ORMModel):
    id: int
    title: str
    organization: str
    funder_type: str
    description: str
    domains: list[str] = []
    keywords: list[str] = []
    eligibility_text: str | None = None
    applicant_types: list[str] = []
    eligible_countries: list[str] = []
    career_stages: list[str] = []
    min_amount: float | None = None
    max_amount: float | None = None
    currency: str = "USD"
    open_date: date | None = None
    deadline: date | None = None
    status: str
    source_name: str | None = None
    source_url: str | None = None
    record_type: str
    verified_at: UTCDateTime | None = None
    external_id: str | None = None
    days_until_deadline: int | None = None
    created_at: UTCDateTime

    @classmethod
    def from_model(cls, item, today: date | None = None) -> "FundingOut":
        out = cls.model_validate(item)
        if item.deadline:
            out.days_until_deadline = (item.deadline - (today or date.today())).days
        return out


class SaveIn(BaseModel):
    status: SavedStatus = "interested"
    notes: str | None = Field(default=None, max_length=4000)


class SavedUpdate(BaseModel):
    status: SavedStatus | None = None
    notes: str | None = Field(default=None, max_length=4000)


class SavedOut(BaseModel):
    id: int
    funding: FundingOut
    status: str
    notes: str | None = None
    created_at: UTCDateTime
    updated_at: UTCDateTime

    @classmethod
    def from_model(cls, saved) -> "SavedOut":
        return cls(id=saved.id, funding=FundingOut.from_model(saved.funding), status=saved.status, notes=saved.notes,
                   created_at=saved.created_at, updated_at=saved.updated_at)


class FeedbackIn(BaseModel):
    funding_id: int
    action: Literal["clicked", "saved", "dismissed"]


class SyncGrantsIn(BaseModel):
    keywords: list[str] | None = None
    limit_per_keyword: int = Field(default=10, ge=1, le=25)


class SyncOpenAlexIn(BaseModel):
    query: str = Field(min_length=2, max_length=200)
    domain: str | None = None
    limit: int = Field(default=25, ge=1, le=100)
