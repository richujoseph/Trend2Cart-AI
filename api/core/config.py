from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    supabase_url: str
    supabase_anon_key: str
    # Only needed by server-side writes (reels, payments). Never expose to the browser.
    supabase_service_role_key: str = ""
    # Only for older Supabase projects that still sign tokens with HS256.
    # Newer projects use signing keys published at /auth/v1/.well-known/jwks.json.
    supabase_jwt_secret: str = ""
    cors_origins: str = "http://localhost:3000"


@lru_cache
def get_settings() -> Settings:
    return Settings()
