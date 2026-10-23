from datetime import datetime, timedelta, timezone
from typing import Literal
from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from app.deps import current_user
from core.doctor import FunnelError, diagnose, money_result, write_advice
from core.llm import LLMError
from core.supabase import SupabaseError, rest_get, service_insert

router = APIRouter(prefix="/doctor", dependencies=[Depends(current_user)])
BUSY = "We couldn't check your results right now. Please try again in a minute."
OVERALL_RTO = (0.22, "GoKwik 2026 (via base.com): COD RTO in India is 20–25%")
DAILY_CHECKUPS = 20  # each check-up is an LLM call; keeps one account from draining the free Gemini quota


class Results(BaseModel):
    reel_id: UUID | None = None
    product_id: UUID | None = None  # for a Reel made outside the app
    views: int = Field(ge=0, le=1_000_000_000)
    clicks: int = Field(ge=0, le=1_000_000_000)
    orders: int = Field(ge=0, le=1_000_000_000)
    returns: int = Field(ge=0, le=1_000_000_000)
    language: Literal["ml", "hi", "en"] | None = None
    # Optional money inputs: the price actually charged (defaults to the product's market price) and ad spend.
    selling_price_paise: int | None = Field(None, gt=0, le=10_000_000)
    ad_spend_paise: int = Field(0, ge=0, le=1_000_000_000)


@router.post("", status_code=201)
def run_doctor(body: Results, request: Request, user: dict = Depends(current_user)):
    token = request.state.token
    try:
        since = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
        recent = rest_get("campaign_results", token, {"select": "id", "entered_at": f"gte.{since}", "limit": str(DAILY_CHECKUPS)})
        if len(recent) >= DAILY_CHECKUPS:
            raise HTTPException(429, f"You've done {DAILY_CHECKUPS} check-ups in the last 24 hours. Please try again tomorrow.")
        language = body.language
        product_id = body.product_id
        if body.reel_id:
            reels = rest_get("reels", token, {"id": f"eq.{body.reel_id}", "select": "product_id,language"})
            if not reels:
                raise HTTPException(404, "We couldn't find this Reel.")
            product_id = reels[0]["product_id"]
            language = language or reels[0]["language"]
        if not product_id:
            raise HTTPException(422, "Pick the Reel (or the product) these results are for.")
        products = rest_get("products", token, {"id": f"eq.{product_id}", "select": "id,name,category,selling_price_paise,supplier_price_paise,shipping_paise"})
        if not products:
            raise HTTPException(404, "This product isn't available any more.")
        product = products[0]
        price = body.selling_price_paise or product["selling_price_paise"]
        if not price:
            raise HTTPException(422, "Enter the price you sold this product at.")
        if not language:
            profiles = rest_get("profiles", token, {"id": f"eq.{user['sub']}", "select": "language"})
            language = profiles[0]["language"] if profiles else "en"
        assumptions = rest_get("category_assumptions", token, {"category": f"eq.{product['category']}", "select": "rto_rate,source"})
    except httpx.HTTPError:
        raise HTTPException(503, BUSY)

    rto = (float(assumptions[0]["rto_rate"]), "our COD return estimate for this category") if assumptions else OVERALL_RTO
    numbers = body.model_dump(include={"views", "clicks", "orders", "returns"})
    try:
        result = diagnose(**numbers, rto_benchmark=rto[0], rto_source=rto[1])
    except FunnelError as e:
        raise HTTPException(422, str(e))
    money = money_result(body.orders, body.returns, price, product["supplier_price_paise"],
                         product["shipping_paise"], body.ad_spend_paise)
    try:
        advice = write_advice(result, numbers, product, language, price)
    except LLMError as e:
        raise HTTPException(503, str(e))

    try:
        saved = service_insert("campaign_results", {
            "user_id": user["sub"], "reel_id": str(body.reel_id) if body.reel_id else None,
            "product_id": product["id"], "language": language, **numbers,
            "selling_price_paise": price, "ad_spend_paise": body.ad_spend_paise,
        })
        service_insert("diagnoses", {
            "result_id": saved["id"], "stage": result["stage"], "explanation": advice.explanation,
            "fixes": advice.fixes, "new_hooks": advice.hooks, "rates": result["stages"],
            "message": advice.message, "money": money,
        })
    except SupabaseError:
        raise HTTPException(503, BUSY)
    # Same shape as one history item, so the page shows a new check-up and an old one the same way.
    return {
        "id": saved["id"], "reel_id": saved["reel_id"], "product_id": product["id"], "language": language,
        **numbers, "selling_price_paise": price, "ad_spend_paise": body.ad_spend_paise,
        "entered_at": saved.get("entered_at"), "products": {"name": product["name"]},
        "diagnoses": [{
            "stage": result["stage"], "explanation": advice.explanation, "fixes": advice.fixes,
            "new_hooks": advice.hooks, "rates": result["stages"], "message": advice.message, "money": money,
        }],
    }


@router.get("")
def history(request: Request):
    try:
        return rest_get("campaign_results", request.state.token, {
            "select": "id,reel_id,product_id,views,clicks,orders,returns,language,selling_price_paise,ad_spend_paise,"
                      "entered_at,products(name),diagnoses(stage,explanation,fixes,new_hooks,rates,message,money)",
            "order": "entered_at.desc",
            "limit": "30",
        })
    except httpx.HTTPError:
        raise HTTPException(503, BUSY)
