"""Real market data for products, behind one function so the provider can be swapped.

Provider: SerpApi (Google Shopping India for prices and sellers, Google Trends for
Kerala + Tamil Nadu search interest). Costs 2 API searches per product.
Used by the offline enrich script, and by product search (app/discover.py), which caches
every lookup for 7 days and caps new lookups per seller.
"""

from dataclasses import dataclass
from datetime import UTC, datetime
from statistics import mean, median

import httpx

from core.config import get_settings

SERPAPI_URL = "https://serpapi.com/search.json"
TREND_GEOS = ["IN-KL", "IN-TN"]  # Kerala, Tamil Nadu
SELLERS_FOR_MAX_COMPETITION = 20
MIN_PRICES = 3
MIN_ACTIVE_SHARE = 0.2  # a region needs searches on ≥20% of days to be a trend signal, not noise


NO_TRENDS_DATA = "hasn't returned any results"  # SerpApi's error when Google Trends has too little data


@dataclass(frozen=True)
class MarketSnapshot:
    market_price_paise: int | None  # None when too few listings to trust
    competition_score: int
    trend_score: int
    image_url: str | None
    trend_region: str  # "Kerala + Tamil Nadu", "India", or "none" (too few searches anywhere → trend 0)
    listings: int
    sellers: int
    fetched_at: datetime


# ---------- Pure helpers (unit-tested) ----------

def market_price_paise(prices_rupees: list[float]) -> int | None:
    """Typical selling price: median after dropping bundles/accessories far from the middle."""
    prices = [p for p in prices_rupees if p and p > 0]
    if len(prices) < MIN_PRICES:
        return None
    mid = median(prices)
    typical = [p for p in prices if mid / 3 <= p <= mid * 3]
    return int(median(typical) + 0.5) * 100  # whole rupees (half-up), stored as paise


def competition_score(seller_names: list[str]) -> int:
    """More distinct sellers on page one = more competition. 20+ sellers -> 100."""
    distinct = {s.strip().lower() for s in seller_names if s and s.strip()}
    return min(100, round(len(distinct) * 100 / SELLERS_FOR_MAX_COMPETITION))


def trend_score(series_by_geo: list[list[float]]) -> int:
    """Momentum of search interest over the last 90 days, averaged across regions.

    Per region: compare the latest 30% of points with the earlier 70%.
    Flat -> 50, +50% or more -> 100, -50% or worse -> 0. Then scaled by the share of
    non-zero points, so products almost nobody searches for score low.
    Regions with no searches at all count as 0.
    """
    scores = []
    for series in series_by_geo:
        if not series or not any(series):
            scores.append(0.0)
            continue
        split = max(1, int(len(series) * 0.7))
        earlier, recent = series[:split], series[split:] or series[-1:]
        earlier_avg, recent_avg = mean(earlier), mean(recent)
        if earlier_avg == 0:
            momentum_score = 100.0
        else:
            momentum_score = min(max(50 + (recent_avg / earlier_avg - 1) * 100, 0), 100)
        nonzero_share = sum(1 for v in series if v > 0) / len(series)
        scores.append(momentum_score * nonzero_share)
    return round(mean(scores)) if scores else 0


# ---------- Provider calls ----------

def _serpapi(params: dict) -> dict:
    key = get_settings().serpapi_api_key
    if not key:
        raise RuntimeError("SERPAPI_API_KEY is empty. Add it to api/.env (serpapi.com → Dashboard → API key).")
    resp = httpx.get(SERPAPI_URL, params=params | {"api_key": key}, timeout=60)
    data = resp.json() if resp.headers.get("content-type", "").startswith("application/json") else {}
    if resp.is_error or "error" in data:
        raise RuntimeError(f"SerpApi error ({resp.status_code}): {data.get('error', resp.text[:200])}")
    return data


def fetch_shopping(keyword: str) -> list[dict]:
    """Page one of Google Shopping India for this phrase."""
    return _serpapi({
        "engine": "google_shopping",
        "q": keyword,
        "gl": "in",
        "hl": "en",
        "google_domain": "google.co.in",
    }).get("shopping_results", [])


def fetch_trend_series(trend_keyword: str) -> tuple[list[list[float]], str, list[str]]:
    """90 days of search interest: (series per region, region label, dates)."""
    # Kerala + Tamil Nadu first; niche products often have too few state-level searches (a single spike in
    # 90 days is noise), so fall back to all of India. If India is sparse too, use it anyway: low interest is real.
    series_by_geo, trend_region, dates = [], "none", []
    for geos, region in [(TREND_GEOS, "Kerala + Tamil Nadu"), (["IN"], "India")]:
        try:
            trends = _serpapi({
                "engine": "google_trends",
                "q": ",".join([trend_keyword] * len(geos)),
                "geo": ",".join(geos),
                "date": "today 3-m",
                "data_type": "TIMESERIES",
            })
        except RuntimeError as e:
            if NO_TRENDS_DATA in str(e):
                continue
            raise
        series_by_geo, dates = [[] for _ in geos], []
        for point in trends.get("interest_over_time", {}).get("timeline_data", []):
            dates.append(point.get("date", ""))
            for v in point.get("values", []):
                idx = v.get("query_index", 0)
                if idx < len(series_by_geo):
                    series_by_geo[idx].append(float(v.get("extracted_value") or 0))
        points = [v for s in series_by_geo for v in s]
        if any(points):
            trend_region = region
            if sum(v > 0 for v in points) / len(points) >= MIN_ACTIVE_SHARE:
                break
    if trend_region == "none":
        series_by_geo, dates = [], []
    return series_by_geo, trend_region, dates


def fetch_region_series(terms: list[str], geo: str) -> dict[str, list[float]]:
    """Up to 5 terms compared in one region over 90 days (1 search). Missing data → all zeros."""
    try:
        trends = _serpapi({"engine": "google_trends", "q": ",".join(terms), "geo": geo,
                           "date": "today 3-m", "data_type": "TIMESERIES"})
    except RuntimeError as e:
        if NO_TRENDS_DATA in str(e):
            return {t: [] for t in terms}
        raise
    series: dict[str, list[float]] = {t: [] for t in terms}
    for point in trends.get("interest_over_time", {}).get("timeline_data", []):
        for v in point.get("values", []):
            idx = v.get("query_index", 0)
            if idx < len(terms):
                series[terms[idx]].append(float(v.get("extracted_value") or 0))
    return series


def fetch_market_snapshot(keyword: str, trend_keyword: str | None = None) -> MarketSnapshot:
    """keyword: specific product phrase for Shopping prices. trend_keyword: what people actually type
    into Google (usually broader, e.g. "vegetable chopper"); defaults to keyword."""
    shopping = fetch_shopping(keyword)
    series_by_geo, trend_region, _ = fetch_trend_series(trend_keyword or keyword)

    sellers = [r.get("source", "") for r in shopping]
    return MarketSnapshot(
        market_price_paise=market_price_paise([r.get("extracted_price") for r in shopping]),
        competition_score=competition_score(sellers),
        trend_score=trend_score(series_by_geo),
        image_url=next((r["thumbnail"] for r in shopping if r.get("thumbnail")), None),
        trend_region=trend_region,
        listings=len(shopping),
        sellers=len({s.strip().lower() for s in sellers if s}),
        fetched_at=datetime.now(UTC),
    )
