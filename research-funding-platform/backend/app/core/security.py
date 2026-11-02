"""Password hashing (bcrypt), JWT access tokens, OAuth state tokens and login throttling."""
from __future__ import annotations

import secrets
import threading
import time
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from app.core.config import get_settings


def _pw_bytes(password: str) -> bytes:
    # bcrypt only uses the first 72 bytes; bcrypt>=5 raises for longer input, so truncate explicitly.
    return password.encode("utf-8")[:72]


def hash_password(password: str) -> str:
    return bcrypt.hashpw(_pw_bytes(password), bcrypt.gensalt(rounds=12)).decode("utf-8")


def verify_password(password: str, hashed: str | None) -> bool:
    if not hashed:
        return False
    try:
        return bcrypt.checkpw(_pw_bytes(password), hashed.encode("utf-8"))
    except ValueError:
        return False


def create_access_token(user_id: int, role: str, expires_minutes: int | None = None) -> tuple[str, int]:
    settings = get_settings()
    minutes = expires_minutes or settings.access_token_expire_minutes
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "role": role,
        "type": "access",
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=minutes)).timestamp()),
        "jti": secrets.token_hex(8),
    }
    token = jwt.encode(payload, settings.secret_key, algorithm=settings.jwt_algorithm)
    return token, minutes * 60


def decode_access_token(token: str) -> dict:
    settings = get_settings()
    payload = jwt.decode(token, settings.secret_key, algorithms=[settings.jwt_algorithm])
    if payload.get("type") != "access":
        raise jwt.InvalidTokenError("wrong token type")
    return payload


def create_state_token(provider: str) -> str:
    """Signed, short-lived OAuth 'state' value (CSRF protection without server-side storage)."""
    settings = get_settings()
    now = datetime.now(timezone.utc)
    payload = {"type": "oauth_state", "provider": provider, "nonce": secrets.token_urlsafe(12),
               "exp": int((now + timedelta(minutes=10)).timestamp())}
    return jwt.encode(payload, settings.secret_key, algorithm=settings.jwt_algorithm)


def verify_state_token(state: str, provider: str) -> bool:
    settings = get_settings()
    try:
        payload = jwt.decode(state, settings.secret_key, algorithms=[settings.jwt_algorithm])
    except jwt.PyJWTError:
        return False
    return payload.get("type") == "oauth_state" and payload.get("provider") == provider


class LoginThrottle:
    """In-memory sliding-window limiter for failed logins (per e-mail). Suitable for a single API instance."""

    def __init__(self) -> None:
        self._failures: dict[str, deque] = defaultdict(deque)
        self._lock = threading.Lock()

    def _window(self) -> float:
        return get_settings().login_lockout_minutes * 60

    def is_locked(self, key: str) -> bool:
        settings = get_settings()
        with self._lock:
            q = self._failures[key]
            cutoff = time.monotonic() - self._window()
            while q and q[0] < cutoff:
                q.popleft()
            return len(q) >= settings.login_max_attempts

    def register_failure(self, key: str) -> None:
        with self._lock:
            self._failures[key].append(time.monotonic())

    def reset(self, key: str | None = None) -> None:
        with self._lock:
            if key is None:
                self._failures.clear()
            else:
                self._failures.pop(key, None)


login_throttle = LoginThrottle()
