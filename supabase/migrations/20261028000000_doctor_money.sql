-- Conversion Doctor: what the Reel actually earned, plus a ready-to-send message. Safe to run more than once.

-- Price the seller actually sold at (defaults to the product's market price) and what they spent on ads.
alter table public.campaign_results
  add column if not exists selling_price_paise bigint check (selling_price_paise > 0),
  add column if not exists ad_spend_paise bigint not null default 0 check (ad_spend_paise >= 0);

alter table public.diagnoses
  add column if not exists message text,  -- WhatsApp/DM message the seller can copy for the weak stage
  add column if not exists money jsonb;   -- profit snapshot in paise, so later price changes don't rewrite history
