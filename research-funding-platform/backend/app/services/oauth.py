"""Optional social login via OAuth2 authorization-code flow (Google, GitHub).

Disabled unless the provider's client id/secret are configured. The callback creates or links a local user,
issues the platform JWT and redirects to the frontend with the token in the URL fragment (never sent to servers).
"""
from __future__ import annotations

from urllib.parse import urlencode

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.base import utcnow
from app.models import User
from app.services.profile_service import get_or_create_profile

PROVIDERS = {
    "google": {
        "label": "Google",
        "authorize_url": "https://accounts.google.com/o/oauth2/v2/auth",
        "token_url": "https://oauth2.googleapis.com/token",
        "userinfo_url": "https://openidconnect.googleapis.com/v1/userinfo",
        "scope": "openid email profile",
    },
    "github": {
        "label": "GitHub",
        "authorize_url": "https://github.com/login/oauth/authorize",
        "token_url": "https://github.com/login/oauth/access_token",
        "userinfo_url": "https://api.github.com/user",
        "emails_url": "https://api.github.com/user/emails",
        "scope": "read:user user:email",
    },
}


class OAuthError(RuntimeError):
    pass


def credentials(provider: str) -> tuple[str, str]:
    s = get_settings()
    return {"google": (s.google_client_id, s.google_client_secret),
            "github": (s.github_client_id, s.github_client_secret)}.get(provider, ("", ""))


def enabled(provider: str) -> bool:
    cid, secret = credentials(provider)
    return provider in PROVIDERS and bool(cid and secret)


def providers_payload() -> dict:
    return {"providers": [{"name": k, "label": v["label"], "enabled": enabled(k)} for k, v in PROVIDERS.items()]}


def redirect_uri(provider: str) -> str:
    return f"{get_settings().oauth_redirect_base_url.rstrip('/')}/api/auth/oauth/{provider}/callback"


def authorize_url(provider: str, state: str) -> str:
    cfg = PROVIDERS[provider]
    cid, _ = credentials(provider)
    params = {"client_id": cid, "redirect_uri": redirect_uri(provider), "response_type": "code",
              "scope": cfg["scope"], "state": state}
    if provider == "google":
        params["prompt"] = "select_account"
    return f"{cfg['authorize_url']}?{urlencode(params)}"


def fetch_identity(provider: str, code: str) -> tuple[str, str]:
    """Exchange the code and return (email, full_name)."""
    cfg = PROVIDERS[provider]
    cid, secret = credentials(provider)
    timeout = get_settings().http_timeout_seconds
    try:
        with httpx.Client(timeout=timeout) as client:
            tok = client.post(cfg["token_url"], data={"client_id": cid, "client_secret": secret, "code": code,
                                                      "redirect_uri": redirect_uri(provider),
                                                      "grant_type": "authorization_code"},
                              headers={"Accept": "application/json"})
            tok.raise_for_status()
            access = tok.json().get("access_token")
            if not access:
                raise OAuthError("Provider did not return an access token")
            headers = {"Authorization": f"Bearer {access}", "Accept": "application/json"}
            info = client.get(cfg["userinfo_url"], headers=headers)
            info.raise_for_status()
            data = info.json()
            email = data.get("email")
            name = data.get("name") or data.get("login") or ""
            if provider == "github" and not email:
                emails = client.get(cfg["emails_url"], headers=headers).json()
                primary = next((e for e in emails if e.get("primary") and e.get("verified")), None)
                email = primary.get("email") if primary else None
            if provider == "google" and data.get("email_verified") is False:
                raise OAuthError("Google account e-mail is not verified")
    except httpx.HTTPError as exc:
        raise OAuthError(f"OAuth exchange with {cfg['label']} failed") from exc
    if not email:
        raise OAuthError("The provider did not share a verified e-mail address")
    return email.lower(), name or email.split("@")[0]


def login_or_create(db: Session, provider: str, email: str, name: str) -> User:
    user = db.execute(select(User).where(User.email == email)).scalar_one_or_none()
    if user is None:
        user = User(email=email, full_name=name[:200], hashed_password=None, role="researcher",
                    auth_provider=provider)
        db.add(user)
        db.commit()
        db.refresh(user)
        get_or_create_profile(db, user)
    if not user.is_active:
        raise OAuthError("Account is deactivated")
    user.last_login_at = utcnow()
    db.commit()
    return user
