from typing import Literal
from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from app.deps import current_user
from core.profit import evaluate_product
from core.supabase import rest_get

router = APIRouter(prefix="/products", dependencies=[Depends(current_user)])

Category = Literal["home_gadgets", "beauty", "phone_accessories", "fitness"]
LOAD_ERROR = "We couldn't load products right now. Please try again in a minute."


def _assumptions_by_category(token: str) -> dict[str, dict]:
    rows = rest_get("category_assumptions", token, {"select": "*"})
    return {row["category"]: row for row in rows}


def _estimates(assumption: dict, rto_rate: float, ad_cost_paise: int) -> dict:
    """RTO rate and ad cost are estimates the seller can edit; the UI must label them."""
    return {
        "rto_rate": rto_rate,
        "ad_cost_paise": ad_cost_paise,
        "source": assumption.get("source"),
        "edited_by_seller": rto_rate != float(assumption["rto_rate"])
        or ad_cost_paise != assumption["ad_cost_per_order_paise"],
    }


@router.get("")
def list_products(request: Request, category: Category | None = None, sort: Literal["score", "profit"] = "score"):
    params = {"select": "*"}
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
            "score": result["score"],
            "profit_paise": result["profit_paise"],
            "profit_rupees": result["profit_paise"] / 100,
            "loss_trap": result["loss_trap"],
            "estimates": _estimates(a, rto, ad),
        })
    key = "score" if sort == "score" else "profit_paise"
    items.sort(key=lambda i: i[key], reverse=True)
    return items


class Overrides(BaseModel):
    selling_price_paise: int | None = Field(None, ge=0)
    rto_rate: float | None = Field(None, ge=0, le=1)
    ad_cost_paise: int | None = Field(None, ge=0)


@router.post("/{product_id}/simulate")
def simulate(product_id: UUID, request: Request, overrides: Overrides | None = None):
    overrides = overrides or Overrides()
    try:
        rows = rest_get("products", request.state.token, {"id": f"eq.{product_id}", "select": "*"})
        if not rows:
            raise HTTPException(404, "This product isn't available any more.")
        product = rows[0]
        assumptions = _assumptions_by_category(request.state.token)
    except httpx.HTTPError:
        raise HTTPException(503, LOAD_ERROR)

    a = assumptions.get(product["category"])
    if a is None:
        raise HTTPException(503, LOAD_ERROR)

    if overrides.selling_price_paise is not None:
        product = product | {"selling_price_paise": overrides.selling_price_paise}
    rto = overrides.rto_rate if overrides.rto_rate is not None else float(a["rto_rate"])
    ad = overrides.ad_cost_paise if overrides.ad_cost_paise is not None else a["ad_cost_per_order_paise"]

    result = evaluate_product(product, rto, ad)
    return {
        "id": product["id"],
        "name": product["name"],
        "score": result["score"],
        "profit_paise": result["profit_paise"],
        "profit_rupees": result["profit_paise"] / 100,
        "loss_trap": result["loss_trap"],
        "breakdown": result["breakdown"],
        "inputs": {
            "selling_price_paise": product["selling_price_paise"],
            "supplier_price_paise": product["supplier_price_paise"],
            "shipping_paise": product["shipping_paise"],
            "fees_paise": product["fees_paise"],
        },
        "estimates": _estimates(a, rto, ad),
    }
