from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from core.auth import AuthError, verify_supabase_jwt

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
