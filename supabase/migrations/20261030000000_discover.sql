-- Product search + trending: cached SerpApi results and a per-seller lookup log. Safe to run more than once.

-- 'search:<query>' or 'trending:<region>'. Shared by all sellers; refreshed after 7 days.
create table if not exists public.market_lookups (
  key         text primary key,
  data        jsonb not null,
  fetched_at  timestamptz not null default now()
);

-- One row per new (uncached) lookup, to cap each seller's daily SerpApi use.
create table if not exists public.market_lookup_log (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  query       text not null,
  created_at  timestamptz not null default now()
);
create index if not exists market_lookup_log_user_idx on public.market_lookup_log (user_id, created_at desc);

-- No policies: only the API (service role) reads and writes these.
alter table public.market_lookups    enable row level security;
alter table public.market_lookup_log enable row level security;
