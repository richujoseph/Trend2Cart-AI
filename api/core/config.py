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
    # Market data for scripts/enrich.py (serpapi.com). Free plan: 250 searches/month = 125 products.
    serpapi_api_key: str = ""

    # LLM: any OpenAI-compatible chat API. Default is Gemini's free tier.
    # Switch provider by changing these three values only, e.g.
    #   Groq:   https://api.groq.com/openai/v1           llama-3.3-70b-versatile
    #   OpenAI: https://api.openai.com/v1                 (an OpenAI model id)
    #   Claude: https://api.anthropic.com/v1              (a Claude model id)
    llm_base_url: str = "https://generativelanguage.googleapis.com/v1beta/openai"
    llm_api_key: str = ""
    llm_model: str = "gemini-3.8-flash"

    # TTS: "sarvam" (free credits, no card) or "google" (free monthly quota, needs billing card).
    tts_provider: str = "sarvam"
    sarvam_api_key: str = ""
    google_tts_api_key: str = ""


@lru_cache
def get_settings() -> Settings:
    return Settings()
