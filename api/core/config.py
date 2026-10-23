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
    # Flash-Lite first: on the free tier gemini-3.8-flash was overloaded (503 or hung) on every test call,
    # while Flash-Lite answered in ~5 s with good Malayalam/Hindi.
    llm_model: str = "gemini-3.5-flash-lite"
    # Tried in order when the main model is overloaded (free tiers often return 503/429).
    llm_fallback_models: str = "gemini-3.8-flash"
    # Per-model wait. Overloaded free-tier models sometimes hang instead of returning 503; give up and fall back.
    llm_timeout_seconds: float = 20

    # TTS: "sarvam" (free credits, no card) or "google" (free monthly quota, needs billing card).
    tts_provider: str = "sarvam"
    sarvam_api_key: str = ""
    google_tts_api_key: str = ""

    # Cost logging per Reel (integer paise). Gemini free tier = 0; set these if you switch to a paid LLM.
    llm_input_cost_paise_per_1m_tokens: int = 0
    llm_output_cost_paise_per_1m_tokens: int = 0
    # Sarvam bulbul:v3 = ₹30 per 10,000 characters (sarvam.ai/api-pricing). Google Standard voices: 0 within free quota.
    tts_cost_paise_per_10k_chars: int = 3000

    # Reels
    ffmpeg_path: str = "ffmpeg"
    ffprobe_path: str = "ffprobe"
    # Folder with fonts/ and music/ (defaults to worker/assets next to this repo's api/ folder).
    reel_assets_dir: str = ""
    # Monthly Reel limits per plan; plans not listed are unlimited.
    free_reels_per_month: int = 3

    # Razorpay (use test-mode keys for the MVP: dashboard.razorpay.com → Test Mode → API Keys)
    razorpay_key_id: str = ""
    razorpay_key_secret: str = ""
    founding_price_paise: int = 9900


@lru_cache
def get_settings() -> Settings:
    return Settings()
