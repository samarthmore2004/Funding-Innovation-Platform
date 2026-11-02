"""Application settings loaded from environment variables / .env files."""
from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# os.path.abspath keeps Windows 8.3 short paths intact (Path.resolve would expand them).
BACKEND_DIR = Path(os.path.abspath(__file__)).parents[2]
REPO_DIR = BACKEND_DIR.parent
DEFAULT_DATA_DIR = REPO_DIR / "data"

INSECURE_DEFAULT_SECRET = "dev-only-insecure-secret-change-me"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(str(REPO_DIR / ".env"), str(BACKEND_DIR / ".env")),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "Research Funding & Innovation Intelligence Platform"
    app_version: str = "1.0.0"
    environment: str = Field(default="development", description="development | test | production")

    database_url: str = Field(default=f"sqlite:///{(BACKEND_DIR / 'rfip.db').as_posix()}")

    secret_key: str = INSECURE_DEFAULT_SECRET
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 480

    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173,http://localhost:8080"
    frontend_url: str = "http://localhost:5173"

    data_dir: str = str(DEFAULT_DATA_DIR)

    # Demo data
    seed_demo_users: bool = True
    demo_user_password: str = "Demo@2026"

    # Background jobs
    enable_scheduler: bool = True
    alerts_interval_minutes: int = 360
    grantsgov_sync_enabled: bool = False
    grantsgov_sync_interval_minutes: int = 1440

    # Login protection
    login_max_attempts: int = 5
    login_lockout_minutes: int = 5

    # External integrations (all optional; the app falls back to local data)
    external_apis_enabled: bool = True
    http_timeout_seconds: float = 20.0
    openalex_api_key: str = ""
    openalex_mailto: str = ""
    crossref_mailto: str = ""
    patentsview_api_key: str = ""

    # Optional social OAuth2 providers
    google_client_id: str = ""
    google_client_secret: str = ""
    github_client_id: str = ""
    github_client_secret: str = ""
    oauth_redirect_base_url: str = "http://localhost:8000"

    log_level: str = "INFO"

    @field_validator("database_url")
    @classmethod
    def _normalise_db_url(cls, value: str) -> str:
        # Heroku/Render style URLs use postgres:// which SQLAlchemy no longer accepts.
        if value.startswith("postgres://"):
            value = "postgresql+psycopg://" + value[len("postgres://"):]
        elif value.startswith("postgresql://"):
            value = "postgresql+psycopg://" + value[len("postgresql://"):]
        return value

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def is_sqlite(self) -> bool:
        return self.database_url.startswith("sqlite")

    @property
    def data_path(self) -> Path:
        return Path(self.data_dir)


@lru_cache
def get_settings() -> Settings:
    return Settings()
