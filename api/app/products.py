from datetime import datetime
from typing import Literal
from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from app.deps import current_user
from core.discover import normalize_query
from core.profit import cod_fee_paise, evaluate_product, shipping_paise
from core.supabase import SupabaseError, rest_get, service_delete, service_get, service_insert

router = APIRouter(prefix="/products", dependencies=[Depends(current_user)])

Category = Literal["home_gadgets", "beauty", "phone_accessories", "fitness"]
LOAD_ERROR = "We couldn't load products right now. Please try again in a minute."
# Only products with a real market price (so profit is real) are shown. Trend and competition may still
# be NULL ("not checked yet"); those products have score None and rank after scored ones.
READY = {col: "not.is.null" for col in ("selling_price_paise", "fees_paise")}


MAX_OWN_PRODUCTS = 20


def _rank(item: dict, sort: str) -> tuple:
    """Higher sorts first."""
    if sort == "profit":
        return (item["profit_paise"],)
    if sort == "trend":
        return (item["trend_score"] is not None, item["trend_score"] or 0, item["profit_paise"])
    if sort == "competition":  # least competition first
        return (item["competition_score"] is not None, -(item["competition_score"] or 0), item["profit_paise"])
    return (item["score"] is not None, item["score"] or 0, item["profit_paise"])


def _assumptions_by_category(token: str) -> dict[str, dict]:
    rows = rest_get("category_assumptions", token, {"select": "*"})
    return {row["category"]: row for row in rows}


def _estimates(assumption: dict, rto_rate: float, ad_cost_paise: int) -> dict:
    """RTO rate and ad cost are estimates the seller can edit; the UI must label them."""
    return {
        "rto_rate": rto_rate,
        "ad_cost_paise": ad_cost_paise,
        "default_rto_rate": float(assumption["rto_rate"]),
        "default_ad_cost_paise": assumption["ad_cost_per_order_paise"],
        "source": assumption.get("source"),
        "edited_by_seller": rto_rate != float(assumption["rto_rate"])
        or ad_cost_paise != assumption["ad_cost_per_order_paise"],
    }


@router.get("")
def list_products(request: Request, category: Category | None = None,
                  sort: Literal["score", "profit", "trend", "competition"] = "score"):
    params = {"select": "*"} | READY
    if category:
        params["category"] = f"eq.{category}"
    try:
        products = rest_get("products", request.state.token, params)
        assumptions = _assumptions_by_category(request.state.token)
    except httpx.HTTPError:
        raise HTTPException(503, LOAD_ERROR)

    items = []
    for p in products:
        a = assumptions.get(p["category"])
        if a is None:
            continue  # category not configured yet; seed category_assumptions
        rto, ad = float(a["rto_rate"]), a["ad_cost_per_order_paise"]
        result = evaluate_product(p, rto, ad)
        items.append({
            "id": p["id"],
            "name": p["name"],
            "category": p["category"],
            "image_urls": p["image_urls"],
            "selling_price_paise": p["selling_price_paise"],
            "selling_price_source": p.get("selling_price_source"),
            "score": result["score"],
            "profit_paise": result["profit_paise"],
            "loss_trap": result["loss_trap"],
            "trend_score": p["trend_score"],
            "competition_score": p["competition_score"],
            "mine": p.get("owner_id") is not None,
            "estimates": _estimates(a, rto, ad),
        })
    items.sort(key=lambda i: _rank(i, sort), reverse=True)
    return items


class Overrides(BaseModel):
    selling_price_paise: int | None = Field(None, ge=0)
    rto_rate: float | None = Field(None, ge=0, le=1)
    ad_cost_paise: int | None = Field(None, ge=0)


@router.post("/{product_id}/simulate")
def simulate(product_id: UUID, request: Request, overrides: Overrides | None = None):
    overrides = overrides or Overrides()
    try:
        rows = rest_get("products", request.state.token, {"id": f"eq.{product_id}", "select": "*"} | READY)
        if not rows:
            raise HTTPException(404, "This product isn't available right now.")
        product = rows[0]
        assumptions = _assumptions_by_category(request.state.token)
    except httpx.HTTPError:
        raise HTTPException(503, LOAD_ERROR)

    a = assumptions.get(product["category"])
    if a is None:
        raise HTTPException(503, LOAD_ERROR)

    if overrides.selling_price_paise is not None:
        price = overrides.selling_price_paise
        product = product | {"selling_price_paise": price, "fees_paise": cod_fee_paise(price)}
    rto = overrides.rto_rate if overrides.rto_rate is not None else float(a["rto_rate"])
    ad = overrides.ad_cost_paise if overrides.ad_cost_paise is not None else a["ad_cost_per_order_paise"]

    result = evaluate_product(product, rto, ad)
    return {
        "id": product["id"],
        "name": product["name"],
        "category": product["category"],
        "image_urls": product["image_urls"],
        "supplier": product["supplier"],
        "market_data_updated_at": product.get("market_data_updated_at"),
        "selling_price_source": product.get("selling_price_source"),
        "trend_score": product["trend_score"],
        "competition_score": product["competition_score"],
        "score": result["score"],
        "profit_paise": result["profit_paise"],
        "loss_trap": result["loss_trap"],
        "mine": product.get("owner_id") is not None,
        "breakdown": result["breakdown"],
        "inputs": {
            "selling_price_paise": product["selling_price_paise"],
            "supplier_price_paise": product["supplier_price_paise"],
            "shipping_paise": product["shipping_paise"],
            "fees_paise": product["fees_paise"],
            "market_selling_price_paise": rows[0]["selling_price_paise"],
        },
        "estimates": _estimates(a, rto, ad),
    }


class OwnProduct(BaseModel):
    query: str = Field(min_length=3, max_length=100)  # the market search this product came from
    name: str = Field(min_length=3, max_length=80)
    category: Category
    supplier_price_paise: int = Field(gt=0, le=10_000_000)
    selling_price_paise: int = Field(gt=0, le=10_000_000)
    weight_slabs: int = Field(1, ge=1, le=4)  # courier bills per 500 g


@router.post("/mine", status_code=201)
def add_own_product(body: OwnProduct, user: dict = Depends(current_user)):
    """Add a searched product to the seller's own shop, using the real market data from that search."""
    query = normalize_query(body.query)
    try:
        lookups = service_get("market_lookups", {"key": f"eq.search:{query}", "select": "data"}) if query else []
        owned = service_get("products", {"owner_id": f"eq.{user['sub']}", "select": "id", "limit": str(MAX_OWN_PRODUCTS)})
    except (httpx.HTTPError, SupabaseError):
        raise HTTPException(503, LOAD_ERROR)
    if not lookups:
        raise HTTPException(404, "Search for this product first, then add it from the results.")
    if len(owned) >= MAX_OWN_PRODUCTS:
        raise HTTPException(429, f"You can keep up to {MAX_OWN_PRODUCTS} of your own products. Remove one to add another.")
    m = lookups[0]["data"]
    typical = f"market typical ₹{m['market_price_paise'] // 100}" if m.get("market_price_paise") else "market price unclear"
    checked = datetime.fromisoformat(m["fetched_at"])
    try:
        row = service_insert("products", {
            "owner_id": user["sub"],
            "name": " ".join(body.name.split()),
            "category": body.category,
            "image_urls": [m["image_url"]] if m.get("image_url") else [],
            "supplier": "Your supplier",
            "supplier_price_paise": body.supplier_price_paise,
            "supplier_reliability": None,  # unrated: the score uses the other factors only
            "shipping_paise": body.weight_slabs * shipping_paise(),
            "selling_price_paise": body.selling_price_paise,
            "fees_paise": cod_fee_paise(body.selling_price_paise),
            "selling_price_source": f"Your price ({typical}, Google Shopping India {checked:%Y-%m-%d})",
            "trend_score": m["trend_score"] if m.get("trend_region") != "none" else None,
            "competition_score": m["competition_score"],
            "search_keyword": query,
            "market_data_updated_at": m["fetched_at"],
        })
    except (httpx.HTTPError, SupabaseError):
        raise HTTPException(503, "We couldn't add this product right now. Please try again in a minute.")
    return {"id": row["id"]}


@router.delete("/mine/{product_id}", status_code=204)
def remove_own_product(product_id: UUID, user: dict = Depends(current_user)):
    try:
        deleted = service_delete("products", {"id": f"eq.{product_id}", "owner_id": f"eq.{user['sub']}"})
    except SupabaseError:
        # reels.product_id is ON DELETE RESTRICT: a product with Reels stays.
        raise HTTPException(409, "This product has Reels, so it can't be removed.")
    except httpx.HTTPError:
        raise HTTPException(503, LOAD_ERROR)
    if not deleted:
        raise HTTPException(404, "We couldn't find this product in your shop.")
