from __future__ import annotations

import re
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.schemas.common import ORMModel, UTCDateTime

SelfServiceRole = Literal["researcher", "startup_founder", "innovation_manager"]
Role = Literal["researcher", "startup_founder", "innovation_manager", "admin"]
ALERT_TYPES = ("funding_match", "funding_deadline", "patent_alert", "tech_alert", "trend_update",
               "commercialization", "system")


def _check_password(value: str) -> str:
    if len(value) < 8 or len(value) > 72:
        raise ValueError("Password must be 8-72 characters long")
    if not re.search(r"[A-Za-z]", value) or not re.search(r"\d", value):
        raise ValueError("Password must contain at least one letter and one digit")
    return value


class RegisterIn(BaseModel):
    email: EmailStr
    password: str
    full_name: str = Field(min_length=2, max_length=200)
    role: SelfServiceRole = "researcher"
    organization: str | None = Field(default=None, max_length=255)

    _pw = field_validator("password")(classmethod(lambda cls, v: _check_password(v)))


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=200)


class NotificationPreferences(BaseModel):
    in_app: bool = True
    deadline_reminder_days: int = Field(default=14, ge=1, le=90)
    alert_types: list[str] = Field(default_factory=lambda: list(ALERT_TYPES))

    @field_validator("alert_types")
    @classmethod
    def _valid_types(cls, value: list[str]) -> list[str]:
        unknown = [v for v in value if v not in ALERT_TYPES]
        if unknown:
            raise ValueError(f"Unknown alert types: {', '.join(unknown)}")
        return value


class UserOut(ORMModel):
    id: int
    email: str
    full_name: str
    role: str
    organization: str | None = None
    is_active: bool
    auth_provider: str = "local"
    created_at: UTCDateTime
    last_login_at: UTCDateTime | None = None
    notification_preferences: NotificationPreferences

    @classmethod
    def from_user(cls, user) -> "UserOut":
        return cls(
            id=user.id, email=user.email, full_name=user.full_name, role=user.role, organization=user.organization,
            is_active=user.is_active, auth_provider=user.auth_provider, created_at=user.created_at,
            last_login_at=user.last_login_at, notification_preferences=NotificationPreferences(**user.preferences),
        )


class AdminUserOut(UserOut):
    projects_count: int = 0


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserOut


class UserUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=200)
    organization: str | None = Field(default=None, max_length=255)
    notification_preferences: NotificationPreferences | None = None


class ChangePasswordIn(BaseModel):
    current_password: str
    new_password: str

    _pw = field_validator("new_password")(classmethod(lambda cls, v: _check_password(v)))


class DeleteAccountIn(BaseModel):
    password: str = ""


class AdminUserUpdate(BaseModel):
    role: Role | None = None
    is_active: bool | None = None
