from app.core.security import create_access_token, hash_password, verify_password


def test_health(client):
    resp = client.get("/api/health")
    assert resp.status_code == 200
    assert resp.json()["database"] == "ok"


def test_password_hashing_roundtrip():
    hashed = hash_password("Secr3t-pass")
    assert hashed != "Secr3t-pass" and hashed.startswith("$2")
    assert verify_password("Secr3t-pass", hashed)
    assert not verify_password("wrong-pass1", hashed)
    assert not verify_password("anything", None)


def test_register_login_and_me(client):
    resp = client.post("/api/auth/register", json={"email": "Alice.Researcher@Example.com", "password": "Str0ngPass",
                                                   "full_name": "Alice R", "role": "startup_founder"})
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["token_type"] == "bearer" and body["user"]["role"] == "startup_founder"
    assert body["user"]["email"] == "alice.researcher@example.com"

    login = client.post("/api/auth/login", json={"email": "alice.researcher@example.com", "password": "Str0ngPass"})
    assert login.status_code == 200
    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {login.json()['access_token']}"})
    assert me.status_code == 200 and me.json()["full_name"] == "Alice R"


def test_register_validation(client):
    dup = client.post("/api/auth/register", json={"email": "researcher@example.com", "password": "Str0ngPass",
                                                  "full_name": "Dup", "role": "researcher"})
    assert dup.status_code == 409
    weak = client.post("/api/auth/register", json={"email": "weak@example.com", "password": "short",
                                                   "full_name": "Weak", "role": "researcher"})
    assert weak.status_code == 422
    no_digit = client.post("/api/auth/register", json={"email": "nodigit@example.com", "password": "onlyletters",
                                                       "full_name": "No Digit", "role": "researcher"})
    assert no_digit.status_code == 422
    admin = client.post("/api/auth/register", json={"email": "sneaky@example.com", "password": "Str0ngPass",
                                                    "full_name": "Sneaky", "role": "admin"})
    assert admin.status_code == 422, "self-registration as administrator must be rejected"


def test_login_failures_and_throttle(client, new_user):
    _, email, _ = new_user()
    assert client.post("/api/auth/login", json={"email": email, "password": "Wrong123x"}).status_code == 401
    for _ in range(5):
        client.post("/api/auth/login", json={"email": email, "password": "Wrong123x"})
    locked = client.post("/api/auth/login", json={"email": email, "password": "Passw0rd!x"})
    assert locked.status_code == 429


def test_protected_endpoints_require_valid_token(client):
    assert client.get("/api/auth/me").status_code == 401
    assert client.get("/api/auth/me", headers={"Authorization": "Bearer not-a-jwt"}).status_code == 401
    expired, _ = create_access_token(1, "admin", expires_minutes=-1)
    assert client.get("/api/auth/me", headers={"Authorization": f"Bearer {expired}"}).status_code == 401


def test_oauth2_password_form_endpoint(client):
    resp = client.post("/api/auth/token", data={"username": "researcher@example.com", "password": "Demo@2026"})
    assert resp.status_code == 200 and resp.json()["token_type"] == "bearer"


def test_change_password(client, new_user):
    headers, email, password = new_user()
    bad = client.post("/api/auth/change-password", headers=headers,
                      json={"current_password": "nope12345", "new_password": "N3wPassword"})
    assert bad.status_code == 400
    ok = client.post("/api/auth/change-password", headers=headers,
                     json={"current_password": password, "new_password": "N3wPassword"})
    assert ok.status_code == 200
    assert client.post("/api/auth/login", json={"email": email, "password": "N3wPassword"}).status_code == 200


def test_oauth_providers_disabled_without_credentials(client):
    providers = client.get("/api/auth/oauth/providers").json()["providers"]
    assert {p["name"] for p in providers} == {"google", "github"}
    assert all(p["enabled"] is False for p in providers)
    assert client.get("/api/auth/oauth/google/login", follow_redirects=False).status_code == 404
