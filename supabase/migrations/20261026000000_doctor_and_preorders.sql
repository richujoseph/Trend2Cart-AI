-- Conversion Doctor + ₹99 founding pre-order. Safe to run more than once.

-- Doctor: results can be for a Reel made in the app (reel_id) or elsewhere (product_id only).
alter table public.campaign_results
  add column if not exists product_id uuid references public.products (id) on delete set null,
  add column if not exists language public.language_code;

alter table public.diagnoses
  add column if not exists fixes jsonb not null default '[]',
  add column if not exists rates jsonb;  -- seller's stage rates and the benchmarks they were compared with

-- Pre-orders: Razorpay order created by the API before checkout, verified by signature after payment.
alter table public.preorders
  add column if not exists razorpay_order_id text unique;
