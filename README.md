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

# Reel worker (needs FFmpeg with libass, see section 4)
cd worker && cp .env.example .env && uv sync && uv run python main.py
```

Tests: `cd api && uv run pytest` and `cd worker && uv run --with pytest pytest -q test_main.py`

## 3. Product data

- `data/products.csv` is the source of truth. Edit it, then load it: `cd api && uv run python scripts/seed.py`
- Real market data (Google Shopping India price + sellers, Google Trends for Kerala/Tamil Nadu, falling back to
  all of India when local searches are too sparse; set `trend_keyword` to what buyers type) via SerpApi:
  add `SERPAPI_API_KEY` to `api/.env`, then `uv run python scripts/enrich.py` (2 searches per product;
  free plan = 250/month). It updates the CSV and re-seeds. Commit the CSV so the team shares the data.
- Supplier price (incl. GST), shipping and supplier rating come from real supplier listings, with `source_url`
  and `source_notes` for every row. COD fees are computed from the courier rate card in `api/core/profit.py`.
- Never type guessed prices or scores into the CSV. Products without market data are hidden from sellers.

## 4. Reels (script → voice → captions → render)

- `POST /reels` `{product_id, audience, language: ml|hi|en, template_id: 1|2|3}` checks the plan limit
  (free = 3/month, resets on the 1st, India time), queues a job and returns its id. `GET /reels/{id}` returns
  `queued | processing | done | failed`, plus `video_url`, `caption`, `hashtags` or a plain-language `error`.
- The worker (`worker/main.py`) polls every 2 s, runs `api/core/reels/pipeline.py`, uploads the MP4 to the
  public `reels` Storage bucket and logs seconds per stage and LLM/TTS cost in paise. Failed jobs are refunded.
- Rendering needs FFmpeg **with libass**. Homebrew's ffmpeg doesn't have it, so run the worker in Docker locally:
  ```bash
  docker build -t t2c-api .
  docker run --rm --env-file api/.env t2c-api python /app/worker/main.py
  ```
  (or `brew tap homebrew-ffmpeg/ffmpeg && brew install homebrew-ffmpeg/ffmpeg/ffmpeg`, then `cd worker && uv run python main.py`).
- Photos: sellers can upload up to 4 of their own photos in the New Reel form (private `seller-photos` bucket,
  each seller can only read/write their own folder). Without them, the product's market photo is used.
  Each photo is shown whole on a card over a blurred backdrop, so small store thumbnails don't get stretched.
- Captions highlight word by word as they're spoken (ASS karaoke), with a bigger hook, a bouncing price badge,
  a progress bar and an end-card button. Generative AI video was evaluated and rejected: no free API exists
  (Veo has no free tier; free web tools are watermarked, non-commercial and have no API), and invented product
  footage would mislead COD buyers.
- Try the stages without the database: `worker/experiments/render_sample.py` (usage in its docstring).
- Fonts (OFL, in `worker/assets/fonts`): Noto Sans Malayalam, Mukta (Hindi + Latin), Noto Sans (English, ₹).
  Optional music: see `worker/assets/music/README.md`.
- If uploads from Docker fail locally with `SSL: BAD_RECORD_MAC`, that's Docker Desktop's network on your Mac
  (uploads from the host work). Run the worker on the host instead with a libass FFmpeg (Homebrew tap above).

## 5. Conversion Doctor

`POST /doctor` `{reel_id | product_id, views, clicks, orders, returns}` compares three stages with benchmarks
(views→DMs/clicks ≈4.5%, DMs→orders ≈10%, returns vs the category's RTO estimate; all labeled estimates with
sources in `api/core/doctor.py`), picks the weakest, and the LLM writes an explanation, 3 fixes and 3 new hooks
in the seller's language. `GET /doctor` returns past check-ups.

## 6. ₹99 founding pre-order (Razorpay test mode)

Add `RAZORPAY_KEY_ID` (`rzp_test_…`) and `RAZORPAY_KEY_SECRET` to `api/.env`
(dashboard.razorpay.com → Test Mode → API Keys). `POST /preorders` creates the order; the pricing page opens
Razorpay Checkout; `POST /preorders/verify` checks the HMAC signature server-side and upgrades the plan to
`founding` (unlimited Reels). Without keys the pricing page says payments aren't switched on yet.
Test card: see Razorpay's test-mode docs (e.g. UPI `success@razorpay`).

## 7. Free deployment (₹0)

| Part | Service (free plan) |
|---|---|
| Web | Vercel Hobby: import repo, **Root Directory = `web`**, add the 3 `NEXT_PUBLIC_*` env vars |
| API + Reel worker | Render free web service from `render.yaml` (Docker; worker runs inside the API container, auto-restarts) |
| DB / Auth / Storage | Supabase Free |
| LLM | Gemini free tier via the OpenAI-compatible wrapper `api/core/llm.py` |
| TTS | Sarvam AI free credits via `api/core/tts.py` (or Google Cloud TTS with `TTS_PROVIDER=google`) |

Render: Dashboard → New → Blueprint → this repo, then fill the secret env vars. After the first deploy,
set `CORS_ORIGINS` to your Vercel URL and set `NEXT_PUBLIC_API_URL` in Vercel to the Render URL.
In Supabase → Authentication → URL Configuration, add the Vercel URL and `<vercel-url>/auth/callback`.

Free-tier gotchas:
- Render sleeps after 15 min idle (~1 min cold start). Open the API URL before a demo.
- Supabase pauses after 7 days without activity; restore it from the dashboard.
- Phone OTP needs a paid SMS provider: use Supabase test phone numbers for demos, Google sign-in for real users.
- Switch LLM provider by changing `LLM_BASE_URL`, `LLM_MODEL`, `LLM_API_KEY` only.
