from functools import lru_cache

import jwt

from core.config import get_settings


class AuthError(Exception):
    """Raised when a token is missing, expired or invalid. Message is safe to show to sellers."""


@lru_cache
def _jwks_client() -> jwt.PyJWKClient:
    url = get_settings().supabase_url.rstrip("/")
    return jwt.PyJWKClient(f"{url}/auth/v1/.well-known/jwks.json", cache_keys=True)


def verify_supabase_jwt(token: str) -> dict:
    """Verify a Supabase access token and return its claims (sub = user id)."""
    settings = get_settings()
    issuer = f"{settings.supabase_url.rstrip('/')}/auth/v1"
    try:
        alg = jwt.get_unverified_header(token).get("alg")
        if alg == "HS256":
            if not settings.supabase_jwt_secret:
                raise AuthError("Sign-in could not be checked. Please sign in again.")
            key = settings.supabase_jwt_secret
        else:
            key = _jwks_client().get_signing_key_from_jwt(token).key
        return jwt.decode(
            token,
            key,
            algorithms=["HS256", "ES256", "RS256"],
            audience="authenticated",
            issuer=issuer,
        )
    except jwt.ExpiredSignatureError:
        raise AuthError("Your session has expired. Please sign in again.")
    except (jwt.InvalidTokenError, jwt.PyJWKClientError):
        raise AuthError("We couldn't confirm it's you. Please sign in again.")
