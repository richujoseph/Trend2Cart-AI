"""Product search and trending lists (Products page). SerpApi results are cached for 7 days."""

import logging
import threading
import time
from datetime import datetime, timedelta, timezone

import httpx
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.deps import current_user
from core.discover import fetch_trending, lookup_product, normalize_query
from core.market_data import searches_left
from core.profit import calculate_profit, cod_fee_paise, shipping_paise
from core.supabase import SupabaseError, service_get, service_insert, service_upsert

router = APIRouter(prefix="/discover", dependencies=[Depends(current_user)])
log = logging.getLogger("trend2cart.discover")

FRESH_FOR = timedelta(days=7)
DAILY_LOOKUPS = 10  # new (uncached) searches per seller per 24 h; each costs 2–3 of the 250 free SerpApi searches a month
DEFAULT_RTO = 0.22  # GoKwik 2026 (via base.com): COD RTO in India is 20–25%. Shown as an editable estimate.
BUSY = "We couldn't check the market right now. Please try again in a minute."
RESERVE = 15  # keep a few SerpApi searches for the weekly trending refresh and the demo
OUT_OF_SEARCHES = "Market search has reached its limit for this month. Saved searches and trending still work."
RETRY_TRENDING_AFTER = 3600  # seconds; a failed refresh must not retry on every page view
_trending_failed_at = 0.0
_refreshing = False
_lock = threading.Lock()


def _cached(key: str) -> dict | None:
    rows = service_get("market_lookups", {"key": f"eq.{key}", "select": "data,fetched_at"})
    return rows[0] if rows else None


def _is_fresh(row: dict) -> bool:
    return datetime.now(timezone.utc) - datetime.fromisoformat(row["fetched_at"]) < FRESH_FOR


def _save(key: str, data: dict) -> None:
    service_upsert("market_lookups", [{"key": key, "data": data, "fetched_at": data["fetched_at"]}], on_conflict="key")


def _friendly(e: RuntimeError) -> str:
    msg = str(e)
    if "run out of searches" in msg:
        return "Market search has reached its limit for this month. Saved searches and trending still work."
    if "SERPAPI_API_KEY" in msg:
        return "Market search isn't set up yet (SERPAPI_API_KEY is missing)."
    return BUSY


@router.get("/search")
def search(q: str = Query(max_length=100), user: dict = Depends(current_user)):
    query = normalize_query(q)
    if not query:
        raise HTTPException(422, "Type a product name, for example \"neck fan\".")
    key = f"search:{query}"
    try:
        row = _cached(key)
        if row and _is_fresh(row):
            return row["data"] | {"cached": True}
        since = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
        used = service_get("market_lookup_log", {"user_id": f"eq.{user['sub']}", "created_at": f"gte.{since}",
                                                 "select": "id", "limit": str(DAILY_LOOKUPS)})
    except (httpx.HTTPError, SupabaseError):
        raise HTTPException(503, BUSY)
    if len(used) >= DAILY_LOOKUPS:
        if row:  # an old result is better than nothing
            return row["data"] | {"cached": True}
        raise HTTPException(429, f"You've done {DAILY_LOOKUPS} new searches today. Try again tomorrow, or open a trending product.")
    left = searches_left()
    if left is not None and left < RESERVE:
        if row:
            return row["data"] | {"cached": True}
        raise HTTPException(503, OUT_OF_SEARCHES)
    try:
        # Counted before calling: a failed search still uses SerpApi credits.
        service_insert("market_lookup_log", {"user_id": user["sub"], "query": query})
    except (httpx.HTTPError, SupabaseError):
        raise HTTPException(503, BUSY)
    try:
        data = lookup_product(query)
    except (RuntimeError, httpx.HTTPError) as e:
        log.warning("lookup %r failed: %s", query, e)
        if row:
            return row["data"] | {"cached": True}
        raise HTTPException(503, _friendly(e) if isinstance(e, RuntimeError) else BUSY)
    try:
        _save(key, data)
    except (httpx.HTTPError, SupabaseError):
        log.warning("couldn't cache lookup %r", query)
    return data | {"cached": False}


TRENDING_KEY = "trending:india"


def _refresh_trending() -> None:
    global _refreshing, _trending_failed_at
    try:
        _save(TRENDING_KEY, fetch_trending())
        log.info("trending refreshed")
    except Exception:
        _trending_failed_at = time.monotonic()
        log.exception("trending refresh failed; next try in an hour")
    finally:
        with _lock:
            _refreshing = False


@router.get("/trending")
def trending(background: BackgroundTasks):
    global _refreshing
    try:
        row = _cached(TRENDING_KEY)
    except (httpx.HTTPError, SupabaseError):
        raise HTTPException(503, BUSY)
    stale = not row or not _is_fresh(row)
    left = searches_left()
    can_refresh = (time.monotonic() - _trending_failed_at > RETRY_TRENDING_AFTER or not _trending_failed_at) \
        and (left is None or left >= 6)
    if stale and can_refresh:
        with _lock:
            start, _refreshing = not _refreshing, True
        if start:  # serve what we have; the weekly refresh (6 searches) runs after the response
            background.add_task(_refresh_trending)
    if not row:
        return {"region": "India", "items": [], "fetched_at": None, "refreshing": can_refresh}
    return row["data"] | {"refreshing": stale and can_refresh}


class Estimate(BaseModel):
    selling_price_paise: int = Field(gt=0, le=10_000_000)
    supplier_price_paise: int = Field(ge=0, le=10_000_000)
    rto_rate: float = Field(DEFAULT_RTO, ge=0, le=1)
    ad_cost_paise: int = Field(0, ge=0, le=10_000_000)


@router.post("/estimate")
def estimate(body: Estimate):
    """Profit per order for a searched product, with the same courier costs as the catalog."""
    ship, fee = shipping_paise(), cod_fee_paise(body.selling_price_paise)
    result = calculate_profit(body.selling_price_paise, body.supplier_price_paise, ship, fee, body.rto_rate,
                              body.ad_cost_paise)
    return {
        "profit_paise": result.profit_paise, "breakdown": result.breakdown,
        "shipping_paise": ship, "fees_paise": fee, "default_rto_rate": DEFAULT_RTO,
        "rto_source": "GoKwik 2026 (via base.com): COD returns in India are 20–25%",
    }
