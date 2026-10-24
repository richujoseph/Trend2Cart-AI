# Trend2Cart AI

**Find products that really make money, sell them with Reels in your own language, and fix what isn't selling.**

Trend2Cart is a web app for first-time Instagram and WhatsApp sellers in Kerala and Tamil Nadu. It shows the real
profit per order after cash-on-delivery (COD) costs and returns. It turns a product into a ready-to-post Reel in
Malayalam, Hindi or English in about a minute. After the Reel is posted, it tells the seller where buyers are
dropping off and what to change.

![Trend2Cart Products page: real profit per order for every product](web/public/landing/app-products.webp)

## Contents

- [The problem](#the-problem)
- [The idea](#the-idea)
- [Features](#features)
- [How the Real Profit Score works](#how-the-real-profit-score-works)
- [Architecture](#architecture)
- [Tech stack and tools](#tech-stack-and-tools)
- [Data: real and sourced](#data-real-and-sourced)
- [Project structure](#project-structure)
- [What we deliberately don't build](#what-we-deliberately-dont-build)
- [Setup and running](#setup-and-running)

## The problem

Small social sellers in India pick products by gut feel and copy what's trending. Then the hidden costs hit:

- **COD and returns eat the margin.** Most orders are cash on delivery. When a parcel is refused (RTO, "return to
  origin"), the seller still pays shipping both ways. A product with a healthy-looking price gap can still lose money on every order.
- **Video content is hard to make in a local language.** Reels sell, but writing a script, recording a voice-over
  and adding captions in Malayalam or Hindi takes time and skill most new sellers don't have.
- **Nobody tells them why a post didn't sell.** A Reel gets 6,000 views and 12 orders. Is that good? Was the
  problem the hook, the price, or the returns? Sellers can't tell, so they repeat the same mistakes.

## The idea

One app that follows a seller's whole loop: **Find → Create → Grow.**

| Step | Question it answers | Feature |
|---|---|---|
| **Find** | "What should I sell?" | **Real Profit Score**: ranks products by the money left per order after supplier cost, shipping, COD fees, GST, returns and ad cost |
| **Create** | "How do I sell it?" | **Vernacular Reels**: a 15–30 s vertical video with AI script, AI voice and word-by-word captions in Malayalam, Hindi or English |
| **Grow** | "Why isn't it selling?" | **Conversion Doctor**: compares the seller's numbers with usual rates, finds the weakest step and writes the fix and new hooks in their language |

The principle behind all three: **show real numbers and label every estimate.** Prices come from real supplier
and marketplace listings, every assumption (return rate, ad cost) is marked "estimate" and can be edited by the
seller, and anything we don't have real data for is hidden rather than guessed.

## Features

**Find: products that actually pay**
- Catalog of 21 real products with supplier quotes from IndiaMART, market prices from Google Shopping India and
  demand from Google Trends.
- Real profit per order with a line-by-line breakdown that always adds up exactly.
- **Loss traps** flagged: products that look popular but lose money after COD and returns.
- A what-if simulator: change the selling price, return rate or ad cost and see profit update.
- Live product search and an India-wide trending list (via SerpApi, cached for 7 days).
- "My shop": add a searched product with your own supplier price and score it the same way.

**Create: Reels in your language**
- A 3-step wizard: product → audience → language and template.
- The language defaults by region (Kerala → Malayalam), and every step can be changed.
- Pipeline: LLM script → text-to-speech voice → karaoke captions → FFmpeg render → MP4 at 1080×1920.
- 3 templates (Bold Night, Pop Card, Fresh Split) with a hook, price badge, progress bar and end-card call to action.
- Use your own product photos (up to 4) or the market photo.
- Friendly progress stages while rendering, then Download, Copy caption and hashtags, or Share to WhatsApp.
- History of all Reels, and a one-tap Retry when something fails. Failed Reels don't count against the quota.

**Grow: a doctor for every Reel**
- Enter views, DMs/clicks, orders and returns for a Reel.
- See what the Reel really earned after returns and ads, and where buyers drop off compared with usual rates.
- The AI explains the weak spot in plain language and gives 3 fixes, 3 new hooks and a ready-to-send WhatsApp message.

**Built for the seller**
- The whole app works in Malayalam, Hindi and English, and one language setting drives both the screens and the Reels.
- Mobile-first (designed at 375 px), with a full desktop layout.
- Google sign-in, plus phone OTP.
- Editable account details.
- Free plan: 3 Reels a month. ₹99 founding-member pre-order for unlimited Reels (Razorpay, test mode).
- Error messages in plain words a non-technical seller understands.

## How the Real Profit Score works

Expected profit for every order placed (all money in integer paise, never floats):

```
profit = (1 − r) × (P − C − S − F)  −  r × 2 × S  −  A
```

| Symbol | Meaning | Source |
|---|---|---|
| P | Selling price | Median of comparable Google Shopping India listings (capped at 8× supplier cost to drop branded outliers) |
| C | Supplier cost, incl. GST | IndiaMART supplier quote |
| S | One-way shipping, 500 g | Shiprocket rate card + 18% GST (₹53.10) |
| F | COD fee | ₹27 + 1.5% of price, minimum ₹37, + 18% GST |
| r | Return-to-origin (RTO) rate | Category estimate, editable by the seller |
| A | Ad cost per order | Estimate, editable by the seller |

A refused COD parcel earns nothing and costs shipping twice; that's the `r × 2 × S` term. The score (0–100) then
combines:

```
score = 50% profit margin (30% margin = full marks) + 25% demand (Google Trends)
      + 15% low competition (number of sellers) + 10% supplier reliability
```

Products with a profit of ₹0 or less are flagged as loss traps. Pure functions with tests live in `api/core/profit.py`.

## Architecture

```
            ┌─────────────────────────────┐
 Seller ──▶ │  Web: Next.js 16 (React 19) │  mobile-first UI, ml / hi / en
            └──────────────┬──────────────┘
                           │ JWT (Supabase Auth)
            ┌──────────────▼──────────────┐       ┌───────────────────────────┐
            │  API: FastAPI (Python)      │──────▶│ SerpApi: Google Shopping, │
            │  profit · discover · reels  │       │ Google Trends             │
            │  doctor · preorders         │──────▶│ Gemini (LLM)              │
            └──────┬───────────────▲──────┘       └───────────────────────────┘
                   │ queue job     │ status
            ┌──────▼───────────────┴──────┐       ┌───────────────────────────┐
            │  Supabase                   │◀─────▶│ Reel worker (Docker)      │
            │  Postgres + RLS · Auth ·    │       │ script → Sarvam TTS →     │
            │  Storage (Reels, photos)    │       │ captions → FFmpeg render  │
            └─────────────────────────────┘       └───────────────────────────┘
```

- The API and the worker share one Python package (`api/core`), so the profit maths and the Reel pipeline have a
  single source of truth.
- Reels are a job queue in Postgres: the API inserts a job, the worker picks it up every 2 seconds, renders the
  MP4 and uploads it to Supabase Storage, and the web app polls for progress.
- Row Level Security means each seller can only read and write their own Reels, check-ups, photos and products.
- A typical Reel renders in about 10 seconds, and the voice costs less than ₹1 (logged per Reel, in paise).

## Tech stack and tools

| Layer | Technology | Why |
|---|---|---|
| Frontend | **Next.js 16** (App Router), **React 19**, **TypeScript** | Server-rendered, fast on low-end phones |
| Styling | **Tailwind CSS v4**, next/font (Plus Jakarta Sans, Fraunces, Noto Sans Malayalam/Devanagari), lucide-react icons | Design tokens in one place; proper Indic text rendering |
| Backend | **FastAPI**, Pydantic, httpx, PyJWT, uv | Typed, quick to build, async calls to outside services |
| Database, auth, storage | **Supabase**: Postgres with Row Level Security, Auth (Google + phone OTP), Storage | One free service for all three |
| AI script and advice | **Google Gemini** through an OpenAI-compatible wrapper (`api/core/llm.py`) | Free tier; provider can be swapped through env vars only |
| Voice | **Sarvam AI** text-to-speech (`bulbul:v3`), Google Cloud TTS as fallback | Natural Indian-language voices |
| Video | **FFmpeg** with libass (ASS karaoke captions), Pillow, in **Docker** | Reliable, free, template-based rendering |
| Market data | **SerpApi** (Google Shopping India, Google Trends) | Real prices, seller counts and demand |
| Supplier data | **IndiaMART** listings (sourced per row in `data/products.csv`) | Real wholesale costs |
| Shipping costs | **Shiprocket** published rate card | Real courier and COD charges |
| Payments | **Razorpay** (test mode) with server-side signature check | Standard for Indian payments |
| Testing | pytest (API and worker), Playwright end-to-end run at 375 px | Every flow checked on a phone-sized screen |
| Tooling | Docker Desktop, ESLint, `./start-local.sh` one-command demo | Whole stack runs locally with one command |

Everything runs on free tiers; total cost to build and demo is ₹0.

## Data: real and sourced

- `data/products.csv` is the source of truth: every row has a `source_url` and `source_notes`.
- Prices and scores are never typed in by hand. Products without real market data are hidden from sellers.
- Every assumption (return rate, ad cost, usual conversion rates) is labelled "estimate" in the UI, cited in code
  and editable by the seller.
- Generative AI video was considered and rejected: there's no free API, and invented product footage would mislead
  COD buyers. Reels use the real product photo.

## Project structure

```
web/                  Next.js (App Router, TS, Tailwind): mobile-first UI, landing page, i18n (ml/hi/en)
api/                  FastAPI: app/ (HTTP routes) + core/ (profit, discover, doctor, reels; shared with worker)
worker/               Python worker for Reel rendering; imports api/core
supabase/migrations/  Postgres schema + Row Level Security
data/products.csv     Sourced product catalog
start-local.sh        One-command local demo
```

## What we deliberately don't build

To keep the MVP focused: no auto-posting to Instagram, no A/B testing, no autonomous AI agents, no trend
prediction, no mobile app, no agency/multi-seller accounts, and no languages beyond Malayalam, Hindi and English.

---

# Setup and running

## Demo in one command

Needs: [uv](https://docs.astral.sh/uv/), Node 20+, Docker Desktop (running), and filled-in `api/.env` + `web/.env`
(copy the `.env.example` files; ask a teammate for the keys).

```bash
./start-local.sh          # API :8000, web :3000 (production build), Reel maker in Docker
```

Open http://localhost:3000 (Chrome → Cmd+Option+I → phone icon for the mobile view). Ctrl+C stops everything.
Ports are configurable: `WEB_PORT=3100 API_PORT=8100 ./start-local.sh`.
Phone sign-in works with the Supabase **test phone numbers** (section 1); Google sign-in works for anyone.
Reels made while the Reel maker is off wait in the queue and start as soon as it's running.

## 1. Supabase setup (once per project)

1. Create a project at supabase.com.
2. Run **every** file in `supabase/migrations` in filename order (oldest first): paste each into **SQL Editor** and run it
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

## 7. Free deployment (optional, later)

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
