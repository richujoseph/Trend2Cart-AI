import time

import jwt

from tests.conftest import make_token


def test_health(client):
    assert client.get("/health").json() == {"status": "ok"}


def test_me_requires_token(client):
    r = client.get("/me")
    assert r.status_code == 401
    assert r.json()["detail"] == "Please sign in to continue."


def test_me_rejects_expired_token(client):
    r = client.get("/me", headers={"Authorization": f"Bearer {make_token(exp=int(time.time()) - 10)}"})
    assert r.status_code == 401
    assert "expired" in r.json()["detail"]


def test_me_rejects_wrong_signature(client):
    bad = jwt.encode({"sub": "u1", "aud": "authenticated"}, "x" * 40, algorithm="HS256")
    assert client.get("/me", headers={"Authorization": f"Bearer {bad}"}).status_code == 401


def test_me_returns_profile(client, auth_headers, monkeypatch):
    from app import main

    monkeypatch.setattr(main, "rest_get", lambda *a, **k: [{"id": "u1", "plan": "free"}])
    r = client.get("/me", headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["profile"]["plan"] == "free"
