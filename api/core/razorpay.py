"""Razorpay (test mode for the MVP): create an order, verify the checkout signature."""

import hashlib
import hmac

import httpx

from core.config import get_settings


class PaymentError(Exception):
    """Message is safe to show to sellers."""


def configured() -> bool:
    s = get_settings()
    return bool(s.razorpay_key_id and s.razorpay_key_secret)


def create_order(amount_paise: int, receipt: str, notes: dict) -> dict:
    s = get_settings()
    try:
        resp = httpx.post(
            "https://api.razorpay.com/v1/orders",
            auth=(s.razorpay_key_id, s.razorpay_key_secret),
            json={"amount": amount_paise, "currency": "INR", "receipt": receipt, "notes": notes},
            timeout=20,
        )
    except httpx.HTTPError:
        raise PaymentError("We couldn't reach the payment service. Please try again in a minute.")
    if resp.is_error:
        raise PaymentError("We couldn't start the payment. Please try again in a minute.")
    return resp.json()


def signature_valid(order_id: str, payment_id: str, signature: str) -> bool:
    """Razorpay Checkout signs "order_id|payment_id" with the key secret (HMAC-SHA256, hex)."""
    expected = hmac.new(
        get_settings().razorpay_key_secret.encode(), f"{order_id}|{payment_id}".encode(), hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature)
