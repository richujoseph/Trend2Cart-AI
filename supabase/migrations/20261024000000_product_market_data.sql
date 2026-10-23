-- Real data only: no made-up defaults. Safe to run more than once.
-- trend_score and competition_score stay NULL until SerpApi data is fetched (api/scripts/enrich.py);
-- the app shows them as "not checked yet" instead of guessing.
-- selling_price_source says where the market price came from (shown to sellers).
-- fees_paise is computed from the courier COD rate card by api/scripts/seed.py.
alter table public.products
  add column if not exists search_keyword text,
  add column if not exists market_data_updated_at timestamptz,
  add column if not exists selling_price_source text,
  alter column selling_price_paise drop not null,
  alter column fees_paise drop not null,
  alter column fees_paise drop default,
  alter column shipping_paise drop default,
  alter column trend_score drop not null,
  alter column trend_score drop default,
  alter column competition_score drop not null,
  alter column competition_score drop default,
  alter column supplier_reliability drop default;
