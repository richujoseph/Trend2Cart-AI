import httpx
from fastapi import APIRouter, Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from core.auth import AuthError, verify_supabase_jwt
from core.config import get_settings
from core.supabase import rest_get

app = FastAPI(title="Trend2Cart API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in get_settings().cors_origins.split(",")],
    allow_methods=["*"],
    allow_headers=["*"],
)

bearer = HTTPBearer(auto_error=False)


def current_user(
    request: Request, creds: HTTPAuthorizationCredentials | None = Depends(bearer)
) -> dict:
    if creds is None:
        raise HTTPException(401, "Please sign in to continue.")
    try:
        claims = verify_supabase_jwt(creds.credentials)
    except AuthError as e:
        raise HTTPException(401, str(e))
    request.state.token = creds.credentials
    return claims


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
    return {"email": user.get("email"), "phone": user.get("phone"), "profile": rows[0]}


app.include_router(protected)
