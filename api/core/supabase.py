import httpx

from core.config import get_settings


def _rest_url(path: str) -> str:
    return f"{get_settings().supabase_url.rstrip('/')}/rest/v1/{path}"


def rest_get(path: str, user_token: str, params: dict | None = None) -> list[dict]:
    """GET from Supabase's REST API as the signed-in user, so Row Level Security applies."""
    resp = httpx.get(
        _rest_url(path),
        params=params,
        headers={
            "apikey": get_settings().supabase_anon_key,
            "Authorization": f"Bearer {user_token}",
        },
        timeout=10,
    )
    resp.raise_for_status()
    return resp.json()


def service_upsert(table: str, rows: list[dict], on_conflict: str) -> None:
    """Insert or update rows with the service-role key (bypasses RLS). Server-side only."""
    key = get_settings().supabase_service_role_key
    if not key:
        raise RuntimeError("SUPABASE_SERVICE_ROLE_KEY is empty. Add it to api/.env (Supabase → Project Settings → API keys).")
    resp = httpx.post(
        _rest_url(table),
        params={"on_conflict": on_conflict},
        json=rows,
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Prefer": "resolution=merge-duplicates,return=minimal",
        },
        timeout=30,
    )
    if resp.is_error and "PGRST204" in resp.text:
        raise RuntimeError(f"The {table} table is missing a column. Run the newest file in supabase/migrations "
                           f"in the Supabase SQL Editor, then try again. Details: {resp.text}")
    if resp.is_error:
        raise RuntimeError(f"Supabase rejected the {table} upload ({resp.status_code}): {resp.text}")


def service_delete_except(table: str, keep_ids: list[str]) -> int:
    """Delete every row whose id is not in keep_ids (service-role key). Returns how many were deleted."""
    key = get_settings().supabase_service_role_key
    if not key:
        raise RuntimeError("SUPABASE_SERVICE_ROLE_KEY is empty. Add it to api/.env (Supabase → Project Settings → API keys).")
    resp = httpx.delete(
        _rest_url(table),
        params={"id": f"not.in.({','.join(keep_ids)})"},
        headers={"apikey": key, "Authorization": f"Bearer {key}", "Prefer": "return=representation"},
        timeout=30,
    )
    if resp.is_error:
        raise RuntimeError(f"Supabase couldn't remove old {table} rows ({resp.status_code}): {resp.text}")
    return len(resp.json())
