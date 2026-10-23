from functools import lru_cache

import httpx

from core.config import get_settings


@lru_cache
def _http() -> httpx.Client:
    """One pooled, keep-alive client: saves a ~0.4 s TLS handshake on every Supabase call."""
    return httpx.Client(timeout=15)


def _idempotent(method: str, url: str, attempts: int = 3, **kwargs) -> httpx.Response:
    """GET/PATCH/upsert-upload can safely be repeated, so retry them on dropped connections.
    (Seen in testing: an 8 s video upload failed with SSL "bad record mac" on a flaky network.)"""
    for attempt in range(attempts):
        try:
            return _http().request(method, url, **kwargs)
        except httpx.TransportError:
            if attempt == attempts - 1:
                raise
    raise AssertionError("unreachable")


class SupabaseError(RuntimeError):
    """A service-role call failed. The message is for logs, not sellers."""


def _base() -> str:
    return get_settings().supabase_url.rstrip("/")


def _rest_url(path: str) -> str:
    return f"{_base()}/rest/v1/{path}"


def _service_headers(**extra: str) -> dict:
    key = get_settings().supabase_service_role_key
    if not key:
        raise SupabaseError("SUPABASE_SERVICE_ROLE_KEY is empty. Add it to api/.env (Supabase → Project Settings → API keys).")
    return {"apikey": key, "Authorization": f"Bearer {key}", **extra}


def _check(resp: httpx.Response, what: str) -> httpx.Response:
    if resp.is_error and "PGRST204" in resp.text:
        raise SupabaseError(f"{what}: a column is missing. Run the newest file in supabase/migrations "
                            f"in the Supabase SQL Editor, then try again. Details: {resp.text}")
    if resp.is_error and "PGRST202" in resp.text:
        raise SupabaseError(f"{what}: a database function is missing. Run the newest file in supabase/migrations "
                            f"in the Supabase SQL Editor, then try again. Details: {resp.text}")
    if resp.is_error:
        raise SupabaseError(f"{what} failed ({resp.status_code}): {resp.text}")
    return resp


def rest_get(path: str, user_token: str, params: dict | None = None) -> list[dict]:
    """GET from Supabase's REST API as the signed-in user, so Row Level Security applies."""
    resp = _idempotent(
        "GET",
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


def service_get(table: str, params: dict) -> list[dict]:
    """Read rows with the service-role key (bypasses RLS). Server-side only."""
    resp = _idempotent("GET", _rest_url(table), params=params, headers=_service_headers(), timeout=15)
    return _check(resp, f"Reading {table}").json()


def service_insert(table: str, row: dict) -> dict:
    """Insert one row with the service-role key and return it."""
    resp = _http().post(_rest_url(table), json=row, headers=_service_headers(Prefer="return=representation"), timeout=15)
    return _check(resp, f"Saving to {table}").json()[0]


def service_update(table: str, row_id: str, fields: dict) -> None:
    """Update one row by id with the service-role key."""
    resp = _idempotent(
        "PATCH", _rest_url(table), params={"id": f"eq.{row_id}"}, json=fields,
        headers=_service_headers(Prefer="return=minimal"), timeout=15,
    )
    _check(resp, f"Updating {table}")


def service_rpc(function: str, args: dict | None = None):
    """Call a Postgres function (supabase/migrations) with the service-role key."""
    resp = _http().post(_rest_url(f"rpc/{function}"), json=args or {}, headers=_service_headers(), timeout=15)
    _check(resp, f"Calling {function}")
    return resp.json() if resp.content else None  # functions returning void send an empty body


def storage_upload(bucket: str, path: str, data: bytes, content_type: str) -> str:
    """Upload a file to Supabase Storage (overwrites) and return its public URL."""
    resp = _idempotent(
        "POST",
        f"{_base()}/storage/v1/object/{bucket}/{path}",
        content=data,
        headers=_service_headers(**{"Content-Type": content_type, "x-upsert": "true"}),
        timeout=120,
    )
    _check(resp, f"Uploading to storage bucket {bucket}")
    return f"{_base()}/storage/v1/object/public/{bucket}/{path}"


def service_upsert(table: str, rows: list[dict], on_conflict: str) -> None:
    """Insert or update rows with the service-role key (bypasses RLS). Server-side only."""
    resp = _http().post(
        _rest_url(table),
        params={"on_conflict": on_conflict},
        json=rows,
        headers=_service_headers(Prefer="resolution=merge-duplicates,return=minimal"),
        timeout=30,
    )
    _check(resp, f"Uploading {table}")


def service_delete_except(table: str, keep_ids: list[str]) -> int:
    """Delete every row whose id is not in keep_ids (service-role key). Returns how many were deleted."""
    resp = _http().delete(
        _rest_url(table),
        params={"id": f"not.in.({','.join(keep_ids)})"},
        headers=_service_headers(Prefer="return=representation"),
        timeout=30,
    )
    return len(_check(resp, f"Removing old {table} rows").json())
