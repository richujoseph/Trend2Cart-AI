# Prompt: 6-slide pitch deck for Trend2Cart AI

Copy everything below the line into your slide tool (Gamma, Claude, ChatGPT, Canva Magic Design, or PowerPoint
Copilot). Upload the images named under "Visual" so the slides show the real product: they are in
`web/public/landing/` and `docs/images/`.

---

You are a senior pitch-deck designer. Create a **6-slide, 16:9 presentation** for **Trend2Cart AI**, a web app
for India's Instagram and WhatsApp sellers. The audience is **judges and investors**: technical and business people
who spend about 1 minute per slide and look for a clear product, real results, technical depth and impact. The deck
should feel like a premium product launch: confident, visual and minimal.

## Rules

- Use **only the facts and numbers given here**. Do not invent statistics, market sizes, user counts, testimonials,
  customer logos or awards. If a slide feels empty, use whitespace, not made-up content.
- **One idea per slide.** At most about 40 words of body text per slide, apart from speaker notes. Use short
  phrases, not paragraphs.
- Every slide gets **speaker notes** (60–90 words, plain spoken English) that the presenter can read aloud.
- Money is written in Indian rupees with the ₹ sign (for example ₹680, ₹53.10).
- Write "estimate" next to any figure that is an assumption, as shown below.

## Visual design

- **Background:** warm off-white `#EEEBE3`. Slide 4 uses a charcoal `#171E19` background with white text for contrast.
- **Text:** charcoal `#171E19`; secondary text `#5F6B66`.
- **Accent:** red `#CA0013`, used **only** for the single most important number or call to action on a slide.
  Profit figures in green `#1F7A46`. Borders and dividers in sage `#B7C6C2`.
- **Fonts:** headings in **Fraunces** (soft serif, semibold); body in **Plus Jakarta Sans**. If they aren't
  available, use Georgia for headings and Inter for body.
- **Cards:** white, large rounded corners (24–40 px), very soft shadow. Plenty of whitespace.
- **Images:** phone screenshots and Reel stills sit inside a dark rounded phone frame; desktop screenshots sit in
  a simple browser frame.
- **Not allowed:** stock photos, clip-art, emoji, gradients behind text, more than 3 colours per slide, bullet
  lists longer than 4 items.
- Small footer on every slide: "Trend2Cart AI" on the left, slide number on the right.

## Slides

### Slide 1: Title

- **Headline:** Sell Without Guesswork
- **Subhead:** Find products that really make money after COD returns, make Reels in Malayalam, Hindi or English,
  and fix what isn't selling.
- **Visual:** a phone frame on the right showing `brush-1_2.webp`, a real Malayalam Reel the app made. Beside it, a
  floating white card: "Real profit per order" with **₹680** in green, and "Electric Hair Straightener Brush" below it.
- **Speaker notes:** Open with the one-line idea. Trend2Cart helps first-time Instagram and WhatsApp
  sellers in Kerala and Tamil Nadu pick products that actually make money, sell them with Reels in their own
  language, and learn why a post didn't sell. Everything you'll see is real data and real output from the app.

### Slide 2: One loop, three tools

- **Headline:** Find → Create → Grow
- Three columns, numbered 01 / 02 / 03:
  1. **Find: Real Profit Score.** Ranks products by money left per order after supplier cost, shipping, COD fees,
     GST, returns and ad cost. Flags loss traps.
  2. **Create: Vernacular Reels.** A 15–30 s vertical Reel with AI script, AI voice and word-by-word captions in
     Malayalam, Hindi or English, made in about a minute.
  3. **Grow: Conversion Doctor.** Enter views, DMs, orders and returns; see what the Reel really earned, where buyers
     drop off, and get 3 fixes and 3 new hooks in your language.
- **Visual:** under each column, one large number in Fraunces: **₹680** best profit per order (Find), **~10 s**
  to render a Reel (Create), **3 + 3** fixes and new hooks (Grow). On the right edge, `app-product-mobile.webp` in a
  phone frame.
- **Speaker notes:** One app follows the seller's whole loop. Find tells them what to sell, Create gives them the
  Reel to sell it, and Grow tells them what to change next week. The whole app, not just the Reels, works in
  Malayalam, Hindi and English, and every estimate is labelled and editable by the seller.

### Slide 3: Real numbers, not guesses (charcoal background)

- **Headline:** Real numbers, not guesses
- **Formula** in a white card, monospace font:
  `profit = (1 − r) × (P − C − S − F) − r × 2 × S − A`
  Short legend under it: P selling price · C supplier cost · S shipping · F COD fee · r return rate (estimate) ·
  A ad cost (estimate)
- **Four big stat tiles** (white numbers, the last one in red):
  **21** products checked · **19** profitable · **2** loss traps caught · **₹680** best profit per order
- **Data sources strip:** IndiaMART (supplier prices) · Google Shopping India (market prices) · Google Trends
  (demand) · Shiprocket rate card (₹53.10 shipping, COD from ₹43.66, GST included)
- **Speaker notes:** Every price comes from a real listing. The cost is IndiaMART's supplier quote; the market price
  is the median of comparable Google Shopping listings; shipping and COD come from Shiprocket's published rate card.
  Return rate and ad cost are estimates the seller can edit. The r × 2 × S term is the key insight: returns cost
  shipping twice. Out of 21 real products, 2 look attractive but lose money.

### Slide 4: See it working

- **Headline:** Real output, in the seller's language
- **Layout:** a row of three phone frames on the left two-thirds, one wide card on the right third.
  - Phone 1: `reel-malayalam.gif` (or `brush-1_2.webp` if animation isn't supported). Caption: "Pop Card · Malayalam"
  - Phone 2: `rope-7.webp`. Caption: "Bold Night · Malayalam"
  - Phone 3: `brush-15.webp`. Caption: "Price end card"
  - Right card: `app-report.webp` (the Conversion Doctor report). Caption: "What this Reel earned · where buyers drop off"
- **Three short facts under the phones:** AI script and voice · word-by-word captions · 1080×1920 MP4 in about 10 seconds
- **Speaker notes:** These are real Reels the app made, not mock-ups. The seller picks a product, an audience and a
  language; the app writes the script, records the voice in Malayalam, Hindi or English, and renders a vertical
  video with captions that highlight word by word. After posting, the Conversion Doctor shows what the Reel really
  earned after returns and ads, and which step lost the buyers.

### Slide 5: How it's built

- **Headline:** Built to run for ₹0
- **Left: simple architecture diagram** (boxes and arrows, sage lines):
  Next.js web app → FastAPI → Supabase (Postgres + Row Level Security, Auth, Storage) ↔ Reel worker in Docker
  (Gemini script → Sarvam AI voice → captions → FFmpeg render). FastAPI also calls SerpApi (Google Shopping,
  Trends) and Gemini.
- **Right: three proof points:**
  - **About 10 s** to render a Reel; **under ₹1** of voice cost per Reel (measured)
  - **255 automated checks:** 170 API tests, 5 worker tests and an 80-step end-to-end run on a 375 px phone screen
  - **₹0 to build and run:** free tiers only, one command (`./start-local.sh`) starts the whole demo
- **Bottom strip of tool names (text, not logos):** Next.js 16 · React 19 · TypeScript · Tailwind v4 · FastAPI ·
  Supabase · Gemini · Sarvam AI · FFmpeg · SerpApi · Razorpay · Docker · Playwright
- **Speaker notes:** The API and the worker share one Python core, so the profit maths has one source of truth.
  Reels run as a job queue: the API queues a job, the worker renders it and uploads the MP4, and the app shows
  friendly progress. Row Level Security keeps each seller's data private. Money is stored as whole paise, never
  floating point. We chose template video over generative AI video because invented footage would mislead COD buyers.

### Slide 6: Impact and next steps

- **Headline:** From guesswork to first profitable sale
- **Left: pricing as two small cards:**
  **Free:** ₹0 · 3 Reels a month, profit scores, market search, Doctor
  **Founding member:** ₹99 one time · unlimited Reels during beta (Razorpay)
- **Right: Next steps** (3 items):
  1. Pilot with sellers in Kerala and Tamil Nadu
  2. Grow the sourced catalog beyond 21 products
  3. Turn on live payments and public hosting
- **Closing line, large, in red:** "Sell without guesswork."
- **Visual:** `app-home-mobile.webp` in a tilted phone frame at the bottom right.
- **Footer call to action:** "Live demo: next"
- **Speaker notes:** A seller can start free. The ₹99 founding pre-order tests whether sellers will pay. Our next
  steps are a pilot with real sellers, a larger catalog, and live payments. Then hand over to the live demo: open
  a product, see the real profit, make a Malayalam Reel, and run a Doctor check-up.

## Output

Return the finished 6-slide deck. If you can't produce files, return each slide as: title, body text, visual
description (layout, positions, colours) and speaker notes, in that order.
