import logging

import httpx
from fastapi import APIRouter, Depends, FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from datetime import datetime, timezone
from typing import Literal

from app import discover, doctor, preorders, products, public, reels
from app.deps import current_user
from core.config import get_settings
from core.supabase import SupabaseError, rest_get, service_update

app = FastAPI(title="Trend2Cart API")
log = logging.getLogger("trend2cart")


# Registered before CORS so CORS wraps it: crashes still get CORS headers and a readable message.
@app.middleware("http")
async def unexpected_errors(request: Request, call_next):
    try:
        return await call_next(request)
    except Exception:
        log.exception("Unhandled error on %s %s", request.method, request.url.path)
        return JSONResponse({"detail": "Something went wrong on our side. Please try again."}, status_code=500)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in get_settings().cors_origins.split(",")],
    allow_methods=["*"],
    allow_headers=["*"],
)

FIELD_MESSAGES = {
    "selling_price_paise": "Selling price can't be negative.",
    "ad_cost_paise": "Ad cost can't be negative.",
    "rto_rate": "Return rate (RTO) must be between 0% and 100%.",
    "category": "Please pick a valid category.",
    "product_id": "This product link looks broken. Go back and pick the product again.",
    "reel_id": "This Reel link looks broken. Go back to your Reels and open it again.",
    "audience": "Describe who the Reel is for in 3–80 characters, for example \"college girls in Kochi\".",
    "language": "Please pick Malayalam, Hindi or English.",
    "template_id": "Please pick one of the 3 Reel styles.",
    "photo_paths": "You can add up to 4 photos.",
    "views": "Views must be a whole number (0 or more).",
    "clicks": "Clicks/DMs must be a whole number (0 or more).",
    "orders": "Orders must be a whole number (0 or more).",
    "returns": "Returns must be a whole number (0 or more).",
}


@app.exception_handler(RequestValidationError)
def validation_error(request: Request, exc: RequestValidationError):
    # Turn Pydantic's technical errors into one sentence a seller can act on.
    for err in exc.errors():
        field = str(err["loc"][-1]) if err["loc"] else ""
        if field in FIELD_MESSAGES:
            return JSONResponse({"detail": FIELD_MESSAGES[field]}, status_code=422)
    return JSONResponse({"detail": "Some of the details you entered don't look right. Please check and try again."}, status_code=422)


@app.get("/health")
def health():
    return {"status": "ok"}


# Every route on this router requires a valid Supabase sign-in.
protected = APIRouter(dependencies=[Depends(current_user)])


@protected.get("/me")
def me(request: Request, user: dict = Depends(current_user)):
    try:
        rows = rest_get("profiles", request.state.token, {"id": f"eq.{user['sub']}", "select": "*"})
    except httpx.HTTPError:
        raise HTTPException(503, "We couldn't load your account right now. Please try again in a minute.")
    if not rows:
        raise HTTPException(404, "Your account setup isn't finished. Please sign out and sign in again.")
    profile = rows[0]
    limit = get_settings().free_reels_per_month if profile["plan"] == "free" else None
    # The counter resets lazily when the next Reel is made; show the real number before that.
    reset_passed = datetime.fromisoformat(profile["month_reset_at"]) <= datetime.now(timezone.utc)
    used = 0 if reset_passed else profile["reels_used_this_month"]
    return {
        "email": user.get("email"), "phone": user.get("phone"), "profile": profile,
        "reels": {"limit": limit, "used": used, "left": None if limit is None else max(limit - used, 0),
                  "resets_at": None if reset_passed else profile["month_reset_at"]},
    }


class ProfileUpdate(BaseModel):
    language: Literal["ml", "hi", "en"] | None = None
    region: Literal["kerala", "tamil_nadu"] | None = None


@protected.patch("/me")
def update_me(body: ProfileUpdate, user: dict = Depends(current_user)):
    """Seller preferences. Server-side so a save either really happens or shows an error."""
    fields = body.model_dump(exclude_none=True)
    if not fields:
        raise HTTPException(422, "Nothing to save.")
    try:
        service_update("profiles", user["sub"], fields)
    except (httpx.HTTPError, SupabaseError):
        raise HTTPException(503, "Couldn't save that. Please check your internet and try again.")
    return fields


app.include_router(protected)
app.include_router(products.router)
app.include_router(reels.router)
app.include_router(doctor.router)
app.include_router(preorders.router)
app.include_router(discover.router)
app.include_router(public.router)
