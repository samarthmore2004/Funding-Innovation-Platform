"""Test configuration: isolated SQLite database seeded from the real snapshot files; external APIs disabled."""
from __future__ import annotations

import os
import shutil
import tempfile

_TMP = tempfile.mkdtemp(prefix="rfip-test-")
os.environ.update({
    "DATABASE_URL": f"sqlite:///{os.path.join(_TMP, 'test.db').replace(os.sep, '/')}",
    "ENVIRONMENT": "test",
    "ENABLE_SCHEDULER": "false",
    "EXTERNAL_APIS_ENABLED": "false",
    "SECRET_KEY": "test-secret-key-for-pytest-only-0123456789",
    "SEED_DEMO_USERS": "true",
    "DEMO_USER_PASSWORD": "Demo@2026",
    "PATENTSVIEW_API_KEY": "",
    "GOOGLE_CLIENT_ID": "",
    "GITHUB_CLIENT_ID": "",
})

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.core.security import login_throttle  # noqa: E402
from app.db.base import Base  # noqa: E402
from app.db.session import SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.seed import seed  # noqa: E402

DEMO_PASSWORD = os.environ["DEMO_USER_PASSWORD"]
ACCOUNTS = {
    "admin": "admin@example.com",
    "researcher": "researcher@example.com",
    "founder": "founder@example.com",
    "manager": "manager@example.com",
}


@pytest.fixture(scope="session", autouse=True)
def _database():
    Base.metadata.create_all(engine)
    seed.run(reset_first=False, demo=True)
    yield
    engine.dispose()
    shutil.rmtree(_TMP, ignore_errors=True)


@pytest.fixture(scope="session")
def client() -> TestClient:
    with TestClient(app) as c:
        yield c


@pytest.fixture(autouse=True)
def _reset_throttle():
    login_throttle.reset()
    yield
    login_throttle.reset()


@pytest.fixture(scope="session")
def tokens(client) -> dict[str, str]:
    out = {}
    for role, email in ACCOUNTS.items():
        resp = client.post("/api/auth/login", json={"email": email, "password": DEMO_PASSWORD})
        assert resp.status_code == 200, resp.text
        out[role] = resp.json()["access_token"]
    return out


@pytest.fixture(scope="session")
def auth(tokens):
    def _headers(role: str) -> dict[str, str]:
        return {"Authorization": f"Bearer {tokens[role]}"}
    return _headers


@pytest.fixture
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


_counter = {"n": 0}


@pytest.fixture
def new_user(client):
    """Register a fresh user and return (headers, email, password)."""
    def _make(role: str = "researcher", password: str = "Passw0rd!x"):
        _counter["n"] += 1
        email = f"user{_counter['n']}-{os.getpid()}@example.com"
        resp = client.post("/api/auth/register", json={"email": email, "password": password,
                                                       "full_name": "Test User", "role": role})
        assert resp.status_code == 201, resp.text
        return {"Authorization": f"Bearer {resp.json()['access_token']}"}, email, password
    return _make
