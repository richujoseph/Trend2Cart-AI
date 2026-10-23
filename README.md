# Trend2Cart AI

```
web/                  Next.js (App Router, TS, Tailwind) — mobile-first UI
api/                  FastAPI — app/ (HTTP routes) + core/ (shared with worker)
worker/               Python worker for Reel rendering; imports api/core
supabase/migrations/  Postgres schema + Row Level Security
```

## 1. Supabase setup (once per project)

1. Create a project at supabase.com.
2. Run the migration: paste `supabase/migrations/20261023000000_init.sql` into **SQL Editor** and run it
   (or `supabase link` then `supabase db push` with the Supabase CLI).
3. **Authentication → URL Configuration**: Site URL `http://localhost:3000`; add `http://localhost:3000/auth/callback` to Redirect URLs (add the Vercel URL later).
4. **Authentication → Providers → Google**: enable it and paste a Google Cloud OAuth client ID/secret.
   In Google Cloud, set the authorized redirect URI to `https://YOUR-PROJECT.supabase.co/auth/v1/callback`.
5. **Authentication → Providers → Phone**: enable it and choose an SMS provider (Twilio, MessageBird, Vonage or Textlocal).
   Real SMS to Indian numbers needs DLT registration, so for development add **Test phone numbers**
   (e.g. `919999999999=123456`). They sign in with a fixed code and send no SMS.

## 2. Run locally

```bash
# API (http://localhost:8000)
cd api && cp .env.example .env    # fill in values
uv sync && uv run uvicorn app.main:app --reload

# Web (http://localhost:3000)
cd web && cp .env.example .env.local   # fill in values
npm install && npm run dev

# Worker (placeholder for now)
cd worker && cp .env.example .env && uv sync && uv run python main.py
```

Tests: `cd api && uv run pytest`
