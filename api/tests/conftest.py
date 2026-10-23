import time

import jwt
import pytest
from fastapi.testclient import TestClient

SECRET = "test-secret-at-least-32-characters-long"
URL = "https://example.supabase.co"


def make_token(**overrides) -> str:
    claims = {"sub": "u1", "aud": "authenticated", "iss": f"{URL}/auth/v1", "exp": int(time.time()) + 60}
    return jwt.encode(claims | overrides, SECRET, algorithm="HS256")


@pytest.fixture
def auth_headers():
    return {"Authorization": f"Bearer {make_token()}"}


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", URL)
    monkeypatch.setenv("SUPABASE_ANON_KEY", "anon")
    monkeypatch.setenv("SUPABASE_JWT_SECRET", SECRET)
    from core.config import get_settings

    get_settings.cache_clear()
    from app import main

    return TestClient(main.app)
