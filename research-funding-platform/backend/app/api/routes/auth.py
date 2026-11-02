from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import RedirectResponse
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.deps import client_ip, get_current_user
from app.core.security import (create_access_token, create_state_token, hash_password, login_throttle,
                               verify_password, verify_state_token)
from app.db.base import utcnow
from app.db.session import get_db
from app.models import User
from app.schemas.common import Message
from app.schemas.user import ChangePasswordIn, LoginIn, RegisterIn, TokenOut, UserOut
from app.services import audit, oauth
from app.services.profile_service import get_or_create_profile

router = APIRouter(prefix="/auth", tags=["Authentication"])


def _token_response(user: User) -> TokenOut:
    token, expires = create_access_token(user.id, user.role)
    return TokenOut(access_token=token, expires_in=expires, user=UserOut.from_user(user))


def _authenticate(db: Session, email: str, password: str, request: Request) -> User:
    key = email.lower()
    if login_throttle.is_locked(key):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS,
                            "Too many failed login attempts. Please wait a few minutes and try again.")
    user = db.execute(select(User).where(User.email == key)).scalar_one_or_none()
    if user is None or not verify_password(password, user.hashed_password):
        login_throttle.register_failure(key)
        audit.record(db, "auth.login_failed", None, email=key, ip=client_ip(request))
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect email or password",
                            headers={"WWW-Authenticate": "Bearer"})
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Account is deactivated. Contact an administrator.")
    login_throttle.reset(key)
    user.last_login_at = utcnow()
    db.commit()
    audit.record(db, "auth.login", user, ip=client_ip(request))
    return user


@router.post("/register", response_model=TokenOut, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterIn, request: Request, db: Session = Depends(get_db)) -> TokenOut:
    email = payload.email.lower()
    if db.execute(select(User.id).where(User.email == email)).first():
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists")
    user = User(email=email, full_name=payload.full_name.strip(), hashed_password=hash_password(payload.password),
                role=payload.role, organization=payload.organization, last_login_at=utcnow())
    db.add(user)
    db.commit()
    db.refresh(user)
    get_or_create_profile(db, user)
    audit.record(db, "auth.register", user, entity_type="user", entity_id=user.id, detail={"role": user.role},
                 ip=client_ip(request))
    return _token_response(user)


@router.post("/login", response_model=TokenOut)
def login(payload: LoginIn, request: Request, db: Session = Depends(get_db)) -> TokenOut:
    return _token_response(_authenticate(db, payload.email, payload.password, request))


@router.post("/token", summary="OAuth2 password flow (used by the Swagger 'Authorize' button)")
def token(request: Request, form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)) -> dict:
    user = _authenticate(db, form.username, form.password, request)
    access, expires = create_access_token(user.id, user.role)
    return {"access_token": access, "token_type": "bearer", "expires_in": expires}


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)) -> UserOut:
    return UserOut.from_user(user)


@router.post("/change-password", response_model=Message)
def change_password(payload: ChangePasswordIn, request: Request, user: User = Depends(get_current_user),
                    db: Session = Depends(get_db)) -> Message:
    if user.hashed_password and not verify_password(payload.current_password, user.hashed_password):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Current password is incorrect")
    user.hashed_password = hash_password(payload.new_password)
    db.commit()
    audit.record(db, "auth.password_changed", user, ip=client_ip(request))
    return Message(detail="Password updated")


@router.get("/oauth/providers")
def oauth_providers() -> dict:
    return oauth.providers_payload()


@router.get("/oauth/{provider}/login")
def oauth_login(provider: str) -> RedirectResponse:
    if not oauth.enabled(provider):
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"OAuth provider '{provider}' is not configured")
    return RedirectResponse(oauth.authorize_url(provider, create_state_token(provider)))


@router.get("/oauth/{provider}/callback")
def oauth_callback(provider: str, request: Request, code: str | None = None, state: str | None = None,
                   error: str | None = None, db: Session = Depends(get_db)) -> RedirectResponse:
    frontend = get_settings().frontend_url.rstrip("/") + "/oauth/callback"
    if not oauth.enabled(provider):
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"OAuth provider '{provider}' is not configured")
    if error or not code or not state or not verify_state_token(state, provider):
        return RedirectResponse(f"{frontend}#error=" + ("access_denied" if error else "invalid_state"))
    try:
        email, name = oauth.fetch_identity(provider, code)
        user = oauth.login_or_create(db, provider, email, name)
    except oauth.OAuthError as exc:
        return RedirectResponse(f"{frontend}#error=" + str(exc).replace(" ", "+"))
    audit.record(db, "auth.login", user, detail={"provider": provider}, ip=client_ip(request))
    access, _ = create_access_token(user.id, user.role)
    return RedirectResponse(f"{frontend}#access_token={access}")
