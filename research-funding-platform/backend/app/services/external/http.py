"""Small HTTP helper shared by the external data-source clients."""
from __future__ import annotations

import logging

import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)

USER_AGENT = "RFIP/1.0 (Research Funding & Innovation Intelligence Platform; academic capstone)"


class ExternalServiceError(RuntimeError):
    """Raised when an external API is disabled, unreachable or returns an unusable response."""


def _client() -> httpx.Client:
    settings = get_settings()
    return httpx.Client(timeout=settings.http_timeout_seconds, headers={"User-Agent": USER_AGENT},
                        follow_redirects=True)


def ensure_enabled(service: str) -> None:
    if not get_settings().external_apis_enabled:
        raise ExternalServiceError(f"{service}: external API access is disabled (EXTERNAL_APIS_ENABLED=false)")


def get_json(service: str, url: str, params: dict | None = None, headers: dict | None = None) -> dict:
    ensure_enabled(service)
    try:
        with _client() as client:
            resp = client.get(url, params=params, headers=headers)
    except httpx.HTTPError as exc:
        logger.warning("%s request failed: %s", service, exc)
        raise ExternalServiceError(f"{service} is unreachable: {exc.__class__.__name__}") from exc
    return _decode(service, resp)


def post_json(service: str, url: str, payload: dict, headers: dict | None = None) -> dict:
    ensure_enabled(service)
    try:
        with _client() as client:
            resp = client.post(url, json=payload, headers=headers)
    except httpx.HTTPError as exc:
        logger.warning("%s request failed: %s", service, exc)
        raise ExternalServiceError(f"{service} is unreachable: {exc.__class__.__name__}") from exc
    return _decode(service, resp)


def _decode(service: str, resp: httpx.Response) -> dict:
    if resp.status_code == 404:
        raise ExternalServiceError(f"{service}: resource not found (404)")
    if resp.status_code == 429:
        raise ExternalServiceError(f"{service}: rate limit or daily quota exceeded (429)")
    if resp.status_code >= 400:
        raise ExternalServiceError(f"{service}: HTTP {resp.status_code}")
    try:
        return resp.json()
    except ValueError as exc:
        raise ExternalServiceError(f"{service}: invalid JSON response") from exc
