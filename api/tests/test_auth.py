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

    monkeypatch.setattr(main, "rest_get", lambda *a, **k: [{"id": "u1", "plan": "free", "reels_used_this_month": 2,
                                                          "month_reset_at": "2999-01-01T00:00:00+00:00"}])
    r = client.get("/me", headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["profile"]["plan"] == "free"
    assert r.json()["reels"] == {"limit": 3, "used": 2, "left": 1, "resets_at": "2999-01-01T00:00:00+00:00"}


def test_me_counts_zero_after_month_reset(client, auth_headers, monkeypatch):
    from app import main

    monkeypatch.setattr(main, "rest_get", lambda *a, **k: [{"id": "u1", "plan": "free", "reels_used_this_month": 3,
                                                          "month_reset_at": "2000-01-01T00:00:00+00:00"}])
    assert client.get("/me", headers=auth_headers).json()["reels"]["left"] == 3


def test_unexpected_error_is_readable_and_keeps_cors(client, auth_headers, monkeypatch):
    from app import main

    def boom(*a, **k):
        raise KeyError("market_data_updated_at")

    monkeypatch.setattr(main, "rest_get", boom)
    r = client.get("/me", headers=auth_headers | {"Origin": "http://localhost:3000"})
    assert r.status_code == 500
    assert r.json()["detail"] == "Something went wrong on our side. Please try again."
    assert r.headers["access-control-allow-origin"] == "http://localhost:3000"
