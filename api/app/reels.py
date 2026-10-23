import re
from datetime import datetime
from typing import Literal
from uuid import UUID
from zoneinfo import ZoneInfo

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from app.deps import current_user
from app.products import READY
from core.config import get_settings
from core.supabase import SupabaseError, rest_get, service_insert, service_rpc

router = APIRouter(prefix="/reels", dependencies=[Depends(current_user)])
BUSY = "We couldn't start your Reel right now. Please try again in a minute."


class NewReel(BaseModel):
    product_id: UUID
    audience: str = Field(min_length=3, max_length=80)
    language: Literal["ml", "hi", "en"]
    template_id: int = Field(1, ge=1, le=3)
    # Optional seller photos already uploaded to the private seller-photos bucket ("<user id>/<file>").
    photo_paths: list[str] = Field(default_factory=list, max_length=4)
    # Optional opening line, e.g. a hook suggested by the Conversion Doctor.
    hook: str | None = Field(None, min_length=3, max_length=100)


PHOTO_FILE = re.compile(r"[A-Za-z0-9_-]{1,64}\.(jpg|jpeg|png|webp)")


def _reset_date(iso: str) -> str:
    """"2026-11-30T18:30:00+00:00" → "1 Dec" (India time)."""
    d = datetime.fromisoformat(iso).astimezone(ZoneInfo("Asia/Kolkata"))
    return f"{d.day} {d:%b}"


@router.post("", status_code=201)
def create_reel(body: NewReel, request: Request, user: dict = Depends(current_user)):
    token = request.state.token
    # Only files in the seller's own folder: stops one seller pointing a job at another seller's photos.
    for path in body.photo_paths:
        folder, _, name = path.partition("/")
        if folder != user["sub"] or not PHOTO_FILE.fullmatch(name):
            raise HTTPException(422, "One of the photos couldn't be used. Please remove it and upload it again.")
    try:
        products = rest_get("products", token, {"id": f"eq.{body.product_id}", "select": "id"} | READY)
        profiles = rest_get("profiles", token, {"id": f"eq.{user['sub']}", "select": "plan"})
    except httpx.HTTPError:
        raise HTTPException(503, BUSY)
    if not products:
        raise HTTPException(404, "This product isn't available right now.")
    if not profiles:
        raise HTTPException(404, "Your account setup isn't finished. Please sign out and sign in again.")

    limit = get_settings().free_reels_per_month if profiles[0]["plan"] == "free" else None
    try:
        quota = service_rpc("use_reel_quota", {"p_user": user["sub"], "p_limit": limit})
    except SupabaseError:
        raise HTTPException(503, BUSY)
    if not quota.get("allowed"):
        raise HTTPException(
            429,
            f"You've used all {limit} free Reels this month. You'll get {limit} more on "
            f"{_reset_date(quota['resets_at'])}.",
        )

    try:
        row = service_insert("reels", {
            "user_id": user["sub"],
            "product_id": str(body.product_id),
            "audience": " ".join(body.audience.split()),
            "language": body.language,
            "template_id": body.template_id,
            "photo_paths": body.photo_paths,
            # The worker replaces script with the finished one; until then it carries the seller's requested hook.
            "script": {"requested_hook": " ".join(body.hook.split())} if body.hook else None,
            "status": "queued",
        })
    except SupabaseError:
        service_rpc("refund_reel_quota", {"p_user": user["sub"]})
        raise HTTPException(503, BUSY)
    return {
        "id": row["id"],
        "status": row["status"],
        "reels_left_this_month": None if limit is None else max(limit - quota["used"], 0),
    }


@router.get("")
def list_reels(request: Request):
    try:
        return rest_get("reels", request.state.token, {
            "select": "id,status,error,video_url,language,template_id,product_id,audience,created_at,products(name)",
            "order": "created_at.desc",
            "limit": "50",
        })
    except httpx.HTTPError:
        raise HTTPException(503, "We couldn't load your Reels right now. Please try again in a minute.")


@router.get("/{reel_id}")
def get_reel(reel_id: UUID, request: Request):
    try:
        rows = rest_get("reels", request.state.token, {
            "id": f"eq.{reel_id}",
            "select": "id,status,error,video_url,caption,hashtags,language,template_id,product_id,audience,"
                      "created_at,products(name)",
        })
    except httpx.HTTPError:
        raise HTTPException(503, "We couldn't check your Reel right now. Please try again in a minute.")
    if not rows:
        raise HTTPException(404, "We couldn't find this Reel.")
    return rows[0]
