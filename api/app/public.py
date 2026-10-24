"""Public, signed-out data for the landing page. Only real catalog facts; cached for 10 minutes."""

import time

import httpx
from fastapi import APIRouter, HTTPException

from core.profit import COD_MIN_PAISE, GST_ON_SERVICES, evaluate_product, shipping_paise
from core.supabase import SupabaseError, service_get

router = APIRouter(prefix="/public")
CACHE_SECONDS = 600
_cache: tuple[float, dict | None] = (0.0, None)


def catalog_stats(products: list[dict], assumptions: list[dict]) -> dict:
    """Pure: counts and a showcase of the most profitable curated products."""
    rto = {a["category"]: (float(a["rto_rate"]), a["ad_cost_per_order_paise"]) for a in assumptions}
    rows = []
    for p in products:
        if p["category"] not in rto:
            continue
        r = evaluate_product(p, *rto[p["category"]])
        rows.append({"name": p["name"], "category": p["category"], "image": (p["image_urls"] or [None])[0],
                     "profit_paise": r["profit_paise"], "score": r["score"]})
    rows.sort(key=lambda x: x["profit_paise"], reverse=True)
    return {
        "products": len(rows),
        "profitable": sum(r["profit_paise"] > 0 for r in rows),
        "loss_traps": sum(r["profit_paise"] <= 0 for r in rows),
        "best_profit_paise": rows[0]["profit_paise"] if rows else None,
        "showcase": [r for r in rows if r["image"]][:6],
        "shipping_paise": shipping_paise(),
        "cod_min_paise": int(COD_MIN_PAISE * GST_ON_SERVICES),
    }


@router.get("/stats")
def stats():
    global _cache
    if time.monotonic() - _cache[0] < CACHE_SECONDS and _cache[1]:
        return _cache[1]
    try:
        products = service_get("products", {"owner_id": "is.null", "selling_price_paise": "not.is.null",
                                            "fees_paise": "not.is.null", "select": "*"})
        assumptions = service_get("category_assumptions", {"select": "*"})
    except (httpx.HTTPError, SupabaseError):
        raise HTTPException(503, "Couldn't load stats right now.")
    data = catalog_stats(products, assumptions)
    _cache = (time.monotonic(), data)
    return data
