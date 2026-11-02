from __future__ import annotations

from datetime import date
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.core import taxonomy
from app.schemas.common import ORMModel, UTCDateTime

OrganizationType = Literal["university", "research_institute", "startup", "enterprise", "government", "nonprofit", "other"]
CareerStage = Literal["student", "early_career", "mid_career", "senior", "industry"]
HistoryKind = Literal["position", "project", "grant", "education", "award"]


def _clean_list(values: list[str] | None, limit: int = 30) -> list[str]:
    out: list[str] = []
    for v in values or []:
        v = (v or "").strip()
        if v and v.lower() not in {o.lower() for o in out}:
            out.append(v[:100])
    return out[:limit]


def _known_areas(values: list[str] | None) -> list[str]:
    keys = set(taxonomy.area_keys())
    cleaned = _clean_list(values, 15)
    unknown = [v for v in cleaned if v not in keys]
    if unknown:
        raise ValueError(f"Unknown technology area(s): {', '.join(unknown)}")
    return cleaned


class ProfileIn(BaseModel):
    headline: str | None = Field(default=None, max_length=255)
    bio: str | None = Field(default=None, max_length=5000)
    department: str | None = Field(default=None, max_length=255)
    organization_name: str | None = Field(default=None, max_length=255)
    organization_type: OrganizationType | None = None
    country: str | None = Field(default=None, max_length=100)
    career_stage: CareerStage | None = None
    research_domains: list[str] = Field(default_factory=list)
    keywords: list[str] = Field(default_factory=list)
    technology_areas: list[str] = Field(default_factory=list)
    orcid: str | None = Field(default=None, max_length=50)
    website: str | None = Field(default=None, max_length=500)
    google_scholar_url: str | None = Field(default=None, max_length=500)

    @field_validator("research_domains", "technology_areas")
    @classmethod
    def _areas(cls, v: list[str]) -> list[str]:
        return _known_areas(v)

    @field_validator("keywords")
    @classmethod
    def _keywords(cls, v: list[str]) -> list[str]:
        return _clean_list(v, 30)


class ProfileStats(BaseModel):
    publications: int = 0
    patents: int = 0
    citations: int = 0
    h_index: int = 0
    history_entries: int = 0


class ProfileOut(ORMModel):
    id: int
    user_id: int
    headline: str | None = None
    bio: str | None = None
    department: str | None = None
    organization_name: str | None = None
    organization_type: str | None = None
    country: str | None = None
    career_stage: str | None = None
    research_domains: list[str] = []
    keywords: list[str] = []
    technology_areas: list[str] = []
    orcid: str | None = None
    website: str | None = None
    google_scholar_url: str | None = None
    updated_at: UTCDateTime
    completeness: int = 0
    stats: ProfileStats = ProfileStats()


class PublicationIn(BaseModel):
    title: str = Field(min_length=2, max_length=500)
    abstract: str | None = Field(default=None, max_length=10000)
    authors: list[str] = Field(default_factory=list)
    venue: str | None = Field(default=None, max_length=300)
    year: int | None = Field(default=None, ge=1900, le=2100)
    publication_date: date | None = None
    doi: str | None = Field(default=None, max_length=255)
    url: str | None = Field(default=None, max_length=500)
    citation_count: int = Field(default=0, ge=0)
    domain: str | None = None
    keywords: list[str] = Field(default_factory=list)
    pub_type: str | None = Field(default="journal-article", max_length=64)

    @field_validator("authors", "keywords")
    @classmethod
    def _lists(cls, v: list[str]) -> list[str]:
        return _clean_list(v, 50)

    @field_validator("domain")
    @classmethod
    def _domain(cls, v: str | None) -> str | None:
        if v and v not in taxonomy.area_keys():
            raise ValueError("Unknown domain")
        return v or None


class PublicationOut(ORMModel):
    id: int
    title: str
    abstract: str | None = None
    authors: list[str] = []
    venue: str | None = None
    year: int | None = None
    publication_date: date | None = None
    doi: str | None = None
    url: str | None = None
    citation_count: int = 0
    domain: str | None = None
    keywords: list[str] = []
    pub_type: str | None = None
    source: str
    external_id: str | None = None
    is_own: bool = False

    @classmethod
    def from_model(cls, pub) -> "PublicationOut":
        out = cls.model_validate(pub)
        out.is_own = pub.owner_id is not None
        return out


PatentStatus = Literal["granted", "pending", "expired", "abandoned"]


class PatentIn(BaseModel):
    patent_number: str | None = Field(default=None, max_length=64)
    title: str = Field(min_length=2, max_length=500)
    abstract: str | None = Field(default=None, max_length=10000)
    assignee: str | None = Field(default=None, max_length=255)
    inventors: list[str] = Field(default_factory=list)
    filing_date: date | None = None
    grant_date: date | None = None
    status: PatentStatus = "pending"
    classification: str | None = Field(default=None, max_length=64)
    technology_domain: str | None = None
    citation_count: int = Field(default=0, ge=0)
    jurisdiction: str | None = Field(default=None, max_length=16)
    url: str | None = Field(default=None, max_length=500)

    @field_validator("inventors")
    @classmethod
    def _inventors(cls, v: list[str]) -> list[str]:
        return _clean_list(v, 30)

    @field_validator("technology_domain")
    @classmethod
    def _domain(cls, v: str | None) -> str | None:
        if v and v not in taxonomy.area_keys():
            raise ValueError("Unknown technology domain")
        return v or None


class PatentOut(ORMModel):
    id: int | None = None
    patent_number: str | None = None
    title: str
    abstract: str | None = None
    assignee: str | None = None
    inventors: list[str] = []
    filing_date: date | None = None
    grant_date: date | None = None
    status: str | None = None
    classification: str | None = None
    technology_domain: str | None = None
    citation_count: int = 0
    jurisdiction: str | None = None
    keywords: list[str] = []
    source: str | None = None
    record_type: str | None = None
    url: str | None = None
    is_own: bool = False

    @classmethod
    def from_model(cls, patent) -> "PatentOut":
        out = cls.model_validate(patent)
        out.is_own = patent.owner_id is not None
        return out


class HistoryIn(BaseModel):
    kind: HistoryKind = "position"
    title: str = Field(min_length=2, max_length=300)
    role: str | None = Field(default=None, max_length=200)
    institution: str | None = Field(default=None, max_length=300)
    start_year: int | None = Field(default=None, ge=1950, le=2100)
    end_year: int | None = Field(default=None, ge=1950, le=2100)
    description: str | None = Field(default=None, max_length=5000)


class HistoryOut(ORMModel):
    id: int
    kind: str
    title: str
    role: str | None = None
    institution: str | None = None
    start_year: int | None = None
    end_year: int | None = None
    description: str | None = None
