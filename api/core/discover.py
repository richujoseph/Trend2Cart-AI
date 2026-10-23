"""Product search and "Trending in Kerala / Tamil Nadu", from real Google Shopping + Google Trends data.

Search: any product a seller types → market price range, sellers, top listings, 90-day search interest.
Trending: a fixed list of COD-friendly product types, ranked by their real 90-day search momentum across
India. Google Trends has no clean "trending products" feed (its rising searches are mostly offers, brands
and news), so we measure momentum for product types small sellers can actually stock. State-level data is
too thin for this (in Oct 2026 only 4 of the 30 types had enough Kerala searches), so the list is India-wide;
the per-product search still checks Kerala + Tamil Nadu first.
"""

import re
from datetime import UTC, datetime
from statistics import mean

from core.market_data import (
    competition_score,
    fetch_region_series,
    fetch_shopping,
    fetch_trend_series,
    market_price_paise,
    trend_score,
)

MAX_LISTINGS = 8

# Product types first-time Instagram/WhatsApp sellers can source from wholesalers and ship COD.
# Google Trends compares up to 5 terms per search and scales them to the biggest one, so each group of five
# holds terms of similar popularity; otherwise small terms round down to zero next to "earbuds".
CANDIDATES: list[tuple[str, str]] = [
    ("earbuds", "phone_accessories"), ("smart watch", "phone_accessories"), ("power bank", "phone_accessories"),
    ("mobile cover", "phone_accessories"), ("water bottle", "home_gadgets"),
    ("electric kettle", "home_gadgets"), ("yoga mat", "fitness"), ("ring light", "phone_accessories"),
    ("led strip light", "home_gadgets"), ("type c charger", "phone_accessories"),
    ("mosquito bat", "home_gadgets"), ("mobile stand", "phone_accessories"), ("skipping rope", "fitness"),
    ("resistance band", "fitness"), ("massage gun", "fitness"),
    ("vegetable chopper", "home_gadgets"), ("neck fan", "home_gadgets"), ("lint remover", "home_gadgets"),
    ("selfie stick", "phone_accessories"), ("car mobile holder", "phone_accessories"),
    ("ice roller", "beauty"), ("heatless curls", "beauty"), ("hair straightener brush", "beauty"),
    ("makeup organizer", "beauty"), ("nail art", "beauty"),
    ("electric lunch box", "home_gadgets"), ("portable blender", "home_gadgets"), ("bag sealer", "home_gadgets"),
    ("phone tripod", "phone_accessories"), ("hand gripper", "fitness"),
]


# ---------- Pure helpers (unit-tested) ----------

def normalize_query(q: str) -> str | None:
    """"  Neck   FAN!! " → "neck fan". None when it isn't a usable product search."""
    cleaned = " ".join(re.sub(r"[^\w\s&+-]", " ", q.lower()).split())[:60]
    return cleaned if len(cleaned) >= 3 and any(c.isalpha() for c in cleaned) else None


def momentum_pct(series: list[float]) -> int | None:
    """Last 30% of days vs the earlier 70%, as a % change. None when there's too little data to say."""
    if len(series) < 10 or sum(v > 0 for v in series) / len(series) < 0.2:
        return None
    split = int(len(series) * 0.7)
    earlier, recent = mean(series[:split]), mean(series[split:])
    if earlier == 0:
        return None
    return round((recent / earlier - 1) * 100)


def price_range_paise(prices_rupees: list[float]) -> tuple[int, int] | None:
    """Middle half of listing prices (25th–75th percentile) in whole rupees, as paise."""
    prices = sorted(p for p in prices_rupees if p and p > 0)
    if len(prices) < 4:
        return None
    q = len(prices) // 4
    return int(prices[q] + 0.5) * 100, int(prices[-q - 1] + 0.5) * 100


def weekly(series_by_geo: list[list[float]]) -> list[int]:
    """Daily interest averaged across regions, then per week, for a small chart."""
    if not series_by_geo or not series_by_geo[0]:
        return []
    days = [mean(day) for day in zip(*series_by_geo)]
    return [round(mean(days[i:i + 7])) for i in range(0, len(days), 7)]


def rank_trending(series: dict[str, list[float]]) -> list[dict]:
    """Candidates with enough searches, best trend score first (rise weighted by how steadily people search,
    so a jump from almost nothing doesn't top the list)."""
    categories = dict(CANDIDATES)
    items = []
    for term, s in series.items():
        change = momentum_pct(s)
        if change is None:
            continue
        items.append({"term": term, "category": categories.get(term), "change_pct": change,
                      "score": trend_score([s]), "weekly": weekly([s])})
    return sorted(items, key=lambda i: (i["score"], i["change_pct"]), reverse=True)


def build_lookup(query: str, shopping: list[dict], series_by_geo: list[list[float]], trend_region: str) -> dict:
    prices = [r.get("extracted_price") for r in shopping]
    sellers = [r.get("source", "") for r in shopping]
    low_high = price_range_paise(prices)
    listings = [
        {
            "title": r.get("title"), "price_paise": int(r["extracted_price"] * 100 + 0.5),
            "source": r.get("source"), "thumbnail": r.get("thumbnail"),
            "link": r.get("product_link") or r.get("link"),
            "rating": r.get("rating"), "reviews": r.get("reviews"),
        }
        for r in shopping if r.get("extracted_price") and r.get("title")
    ][:MAX_LISTINGS]
    combined = [mean(day) for day in zip(*series_by_geo)] if series_by_geo and series_by_geo[0] else []
    return {
        "query": query,
        "market_price_paise": market_price_paise(prices),
        "price_low_paise": low_high[0] if low_high else None,
        "price_high_paise": low_high[1] if low_high else None,
        "listings_count": len(shopping),
        "sellers": len({s.strip().lower() for s in sellers if s}),
        "competition_score": competition_score(sellers),
        "trend_score": trend_score(series_by_geo),
        "trend_change_pct": momentum_pct(combined),
        "trend_region": trend_region,
        "weekly": weekly(series_by_geo),
        "image_url": next((r["thumbnail"] for r in shopping if r.get("thumbnail")), None),
        "listings": listings,
        "fetched_at": datetime.now(UTC).isoformat(),
    }


# ---------- Provider calls ----------

def lookup_product(query: str) -> dict:
    """2–3 SerpApi searches."""
    shopping = fetch_shopping(query)
    series_by_geo, region, _ = fetch_trend_series(query)
    return build_lookup(query, shopping, series_by_geo, region)


def fetch_trending() -> dict:
    """One search per 5 candidates (6 for the full list)."""
    terms = [t for t, _ in CANDIDATES]
    series: dict[str, list[float]] = {}
    for i in range(0, len(terms), 5):
        series |= fetch_region_series(terms[i:i + 5], "IN")
    return {"region": "India", "items": rank_trending(series), "fetched_at": datetime.now(UTC).isoformat()}
