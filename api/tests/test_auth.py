import time

import jwt
import pytest
from fastapi.testclient import TestClient

SECRET = "test-secret-at-least-32-characters-long"
URL = "https://example.supabase.co"


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", URL)
    monkeypatch.setenv("SUPABASE_ANON_KEY", "anon")
    monkeypatch.setenv("SUPABASE_JWT_SECRET", SECRET)
    from core.config import get_settings

    get_settings.cache_clear()
    from app import main

    monkeypatch.setattr(main, "rest_get", lambda *a, **k: [{"id": "u1", "plan": "free"}])
    return TestClient(main.app)


def token(**overrides):
    claims = {"sub": "u1", "aud": "authenticated", "iss": f"{URL}/auth/v1", "exp": int(time.time()) + 60}
    return jwt.encode(claims | overrides, SECRET, algorithm="HS256")


def test_health(client):
    assert client.get("/health").json() == {"status": "ok"}


def test_me_requires_token(client):
    r = client.get("/me")
    assert r.status_code == 401
    assert r.json()["detail"] == "Please sign in to continue."


def test_me_rejects_expired_token(client):
    r = client.get("/me", headers={"Authorization": f"Bearer {token(exp=int(time.time()) - 10)}"})
    assert r.status_code == 401
    assert "expired" in r.json()["detail"]


def test_me_rejects_wrong_signature(client):
    bad = jwt.encode({"sub": "u1", "aud": "authenticated"}, "x" * 40, algorithm="HS256")
    assert client.get("/me", headers={"Authorization": f"Bearer {bad}"}).status_code == 401


def test_me_returns_profile(client):
    r = client.get("/me", headers={"Authorization": f"Bearer {token()}"})
    assert r.status_code == 200
    assert r.json()["profile"]["plan"] == "free"
