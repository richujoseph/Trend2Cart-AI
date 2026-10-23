import uuid

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from app.deps import current_user
from core import razorpay
from core.config import get_settings
from core.supabase import SupabaseError, rest_get, service_get, service_insert, service_update

router = APIRouter(prefix="/preorders", dependencies=[Depends(current_user)])
BUSY = "We couldn't start the payment right now. Please try again in a minute."


@router.post("", status_code=201)
def create_preorder(request: Request, user: dict = Depends(current_user)):
    if not razorpay.configured():
        raise HTTPException(503, "Payments aren't switched on yet. Please check back soon.")
    try:
        profiles = rest_get("profiles", request.state.token, {"id": f"eq.{user['sub']}", "select": "plan"})
    except httpx.HTTPError:
        raise HTTPException(503, BUSY)
    if profiles and profiles[0]["plan"] != "free":
        raise HTTPException(409, "You're already a founding member. Thank you!")

    amount = get_settings().founding_price_paise
    receipt = f"pre_{uuid.uuid4().hex[:20]}"
    try:
        order = razorpay.create_order(amount, receipt, {"user_id": user["sub"]})
        service_insert("preorders", {"user_id": user["sub"], "amount_paise": amount, "status": "created",
                                     "razorpay_order_id": order["id"]})
    except razorpay.PaymentError as e:
        raise HTTPException(503, str(e))
    except SupabaseError:
        raise HTTPException(503, BUSY)
    return {
        "order_id": order["id"], "amount_paise": amount, "currency": "INR",
        "key_id": get_settings().razorpay_key_id,
        "prefill": {"email": user.get("email") or "", "contact": user.get("phone") or ""},
    }


class Payment(BaseModel):
    razorpay_order_id: str = Field(min_length=5, max_length=64)
    razorpay_payment_id: str = Field(min_length=5, max_length=64)
    razorpay_signature: str = Field(min_length=10, max_length=256)


@router.post("/verify")
def verify_preorder(body: Payment, user: dict = Depends(current_user)):
    if not razorpay.configured():
        raise HTTPException(503, "Payments aren't switched on yet. Please check back soon.")
    if not razorpay.signature_valid(body.razorpay_order_id, body.razorpay_payment_id, body.razorpay_signature):
        raise HTTPException(400, "We couldn't confirm this payment. If money was taken, it will be refunded automatically.")
    try:
        rows = service_get("preorders", {"razorpay_order_id": f"eq.{body.razorpay_order_id}", "select": "id,user_id,status"})
        if not rows or rows[0]["user_id"] != user["sub"]:
            raise HTTPException(404, "We couldn't find this pre-order.")
        if rows[0]["status"] != "paid":
            service_update("preorders", rows[0]["id"], {"status": "paid", "razorpay_payment_id": body.razorpay_payment_id})
            service_update("profiles", user["sub"], {"plan": "founding"})
    except SupabaseError:
        raise HTTPException(503, "Your payment went through, but we couldn't update your plan yet. "
                                 "Please refresh in a minute; contact us if it doesn't change.")
    return {"plan": "founding"}
