-- Real data only: no made-up defaults.
-- selling price, trend and competition come from SerpApi (api/scripts/enrich.py) and stay NULL
-- until fetched; the API hides products that are missing them.
-- fees_paise is computed from the courier COD rate card by api/scripts/seed.py.
alter table public.products
  add column search_keyword text,
  add column market_data_updated_at timestamptz,
  alter column selling_price_paise drop not null,
  alter column fees_paise drop not null,
  alter column fees_paise drop default,
  alter column shipping_paise drop default,
  alter column trend_score drop not null,
  alter column trend_score drop default,
  alter column competition_score drop not null,
  alter column competition_score drop default,
  alter column supplier_reliability drop default;
