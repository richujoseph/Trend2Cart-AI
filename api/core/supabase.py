import httpx

from core.config import get_settings


def rest_get(path: str, user_token: str, params: dict | None = None) -> list[dict]:
    """GET from Supabase's REST API as the signed-in user, so Row Level Security applies."""
    settings = get_settings()
    resp = httpx.get(
        f"{settings.supabase_url.rstrip('/')}/rest/v1/{path}",
        params=params,
        headers={
            "apikey": settings.supabase_anon_key,
            "Authorization": f"Bearer {user_token}",
        },
        timeout=10,
    )
    resp.raise_for_status()
    return resp.json()
