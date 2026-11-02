from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.core import taxonomy
from app.schemas.common import UTCDateTime

Stage = Literal["idea", "research", "prototype", "pilot", "market_ready"]
MarketSize = Literal["niche", "medium", "large", "very_large"]


class ProjectIn(BaseModel):
    title: str = Field(min_length=3, max_length=300)
    description: str = Field(min_length=20, max_length=8000)
    domain: str
    keywords: list[str] = Field(default_factory=list)
    stage: Stage = "idea"
    trl: int = Field(default=1, ge=1, le=9)
    market_size: MarketSize = "medium"
    target_market: str | None = Field(default=None, max_length=300)
    patents_filed: int = Field(default=0, ge=0, le=1000)
    patents_granted: int = Field(default=0, ge=0, le=1000)
    team_size: int | None = Field(default=None, ge=1, le=10000)
    has_industry_partner: bool = False

    @field_validator("domain")
    @classmethod
    def _domain(cls, v: str) -> str:
        if v not in taxonomy.area_keys():
            raise ValueError("Unknown technology domain")
        return v

    @field_validator("keywords")
    @classmethod
    def _keywords(cls, v: list[str]) -> list[str]:
        out = []
        for k in v:
            k = k.strip()
            if k and k.lower() not in [o.lower() for o in out]:
                out.append(k[:100])
        return out[:20]

    @field_validator("patents_granted")
    @classmethod
    def _granted(cls, v: int, info) -> int:
        filed = info.data.get("patents_filed", 0)
        if v > filed:
            raise ValueError("patents_granted cannot exceed patents_filed")
        return v


class StageIn(BaseModel):
    stage: Stage


class ScoreFactor(BaseModel):
    name: str
    value: float | str | None = None
    detail: str = ""


class ScoreComponent(BaseModel):
    key: str
    label: str
    weight: float
    value: float
    weighted: float
    explanation: str
    factors: list[ScoreFactor] = []


class ScoreOut(BaseModel):
    id: int | None = None
    project_id: int | None = None
    overall: float
    band: str
    components: list[ScoreComponent]
    weights: dict[str, float]
    explanation: str
    disclaimer: str
    created_at: UTCDateTime | None = None


class ProjectOut(BaseModel):
    id: int
    owner_id: int
    owner_name: str | None = None
    title: str
    description: str
    domain: str | None = None
    keywords: list[str] = []
    stage: str
    trl: int
    market_size: str
    target_market: str | None = None
    patents_filed: int = 0
    patents_granted: int = 0
    team_size: int | None = None
    has_industry_partner: bool = False
    latest_score: ScoreOut | None = None
    created_at: UTCDateTime
    updated_at: UTCDateTime
