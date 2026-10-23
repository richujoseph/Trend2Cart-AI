-- Trend2Cart AI: initial schema.
-- All money is stored as integer paise (bigint). Display as ₹ in the UI.

-- ---------- Enums ----------
create type public.product_category as enum ('home_gadgets', 'beauty', 'phone_accessories', 'fitness');
create type public.plan_type        as enum ('free', 'pro', 'founding');
create type public.language_code    as enum ('ml', 'hi', 'en');
create type public.reel_status      as enum ('queued', 'processing', 'done', 'failed');
create type public.preorder_status  as enum ('created', 'paid', 'failed');

-- ---------- Catalog (readable by every signed-in user, written only by admins / service role) ----------
create table public.products (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null,
  category              public.product_category not null,
  image_urls            text[] not null default '{}',
  supplier              text,
  supplier_price_paise  bigint not null check (supplier_price_paise >= 0),
  shipping_paise        bigint not null default 0 check (shipping_paise >= 0),
  fees_paise            bigint not null default 0 check (fees_paise >= 0),
  selling_price_paise   bigint not null check (selling_price_paise >= 0),
  trend_score           smallint not null default 50 check (trend_score between 0 and 100),
  competition_score     smallint not null default 50 check (competition_score between 0 and 100),
  supplier_reliability  smallint not null default 50 check (supplier_reliability between 0 and 100),
  created_at            timestamptz not null default now()
);
create index products_category_idx on public.products (category);

create table public.category_assumptions (
  category                 public.product_category primary key,
  rto_rate                 numeric(5,4) not null check (rto_rate between 0 and 1),  -- 0.2500 = 25%
  ad_cost_per_order_paise  bigint not null check (ad_cost_per_order_paise >= 0),
  source                   text,
  created_at               timestamptz not null default now()
);

-- ---------- Per-user data ----------
create table public.profiles (
  id                     uuid primary key references auth.users (id) on delete cascade,
  plan                   public.plan_type not null default 'free',
  language               public.language_code not null default 'en',
  region                 text,
  reels_used_this_month  integer not null default 0 check (reels_used_this_month >= 0),
  -- When reels_used_this_month is next reset to 0 (start of next calendar month).
  month_reset_at         timestamptz not null default (date_trunc('month', now()) + interval '1 month'),
  created_at             timestamptz not null default now()
);

create table public.saved_products (
  user_id     uuid not null references auth.users (id) on delete cascade,
  product_id  uuid not null references public.products (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, product_id)
);

create table public.reels (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  product_id  uuid not null references public.products (id) on delete restrict,
  audience    text,
  language    public.language_code not null,
  script      jsonb,
  video_url   text,
  caption     text,
  hashtags    text[] not null default '{}',
  status      public.reel_status not null default 'queued',
  error       text,
  created_at  timestamptz not null default now()
);
create index reels_user_id_idx on public.reels (user_id, created_at desc);
create index reels_queued_idx on public.reels (created_at) where status = 'queued';

create table public.campaign_results (
  id          uuid primary key default gen_random_uuid(),
  -- Nullable: a seller may diagnose a Reel they made outside the app.
  reel_id     uuid references public.reels (id) on delete set null,
  user_id     uuid not null references auth.users (id) on delete cascade,
  views       integer not null default 0 check (views >= 0),
  clicks      integer not null default 0 check (clicks >= 0),
  orders      integer not null default 0 check (orders >= 0),
  returns     integer not null default 0 check (returns >= 0),
  entered_at  timestamptz not null default now(),
  created_at  timestamptz not null default now()
);
create index campaign_results_user_id_idx on public.campaign_results (user_id, entered_at desc);

create table public.diagnoses (
  id           uuid primary key default gen_random_uuid(),
  result_id    uuid not null references public.campaign_results (id) on delete cascade,
  stage        text not null,  -- weak funnel stage; values fixed when the Doctor rules are written
  explanation  text not null,
  new_hooks    jsonb not null default '[]',
  created_at   timestamptz not null default now()
);
create index diagnoses_result_id_idx on public.diagnoses (result_id);

create table public.preorders (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users (id) on delete cascade,
  razorpay_payment_id  text unique,
  amount_paise         bigint not null check (amount_paise > 0),
  status               public.preorder_status not null default 'created',
  created_at           timestamptz not null default now()
);
create index preorders_user_id_idx on public.preorders (user_id);

-- ---------- Auto-create a profile for every new auth user ----------
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Row Level Security ----------
-- Writes not covered by a policy below (reels, diagnoses, preorders, plan/quota changes)
-- are done by the API/worker with the service-role key, which bypasses RLS.
alter table public.products             enable row level security;
alter table public.category_assumptions enable row level security;
alter table public.profiles             enable row level security;
alter table public.saved_products       enable row level security;
alter table public.reels                enable row level security;
alter table public.campaign_results     enable row level security;
alter table public.diagnoses            enable row level security;
alter table public.preorders            enable row level security;

-- Catalog: read-only for signed-in users.
create policy "products readable by signed-in users"
  on public.products for select to authenticated using (true);
create policy "category_assumptions readable by signed-in users"
  on public.category_assumptions for select to authenticated using (true);

-- Profiles: read own; update only language and region (plan and quota are server-controlled).
create policy "read own profile"
  on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "update own profile"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
revoke update on public.profiles from authenticated, anon;
grant update (language, region) on public.profiles to authenticated;

-- Saved products: full control of own rows.
create policy "read own saved products"
  on public.saved_products for select to authenticated using ((select auth.uid()) = user_id);
create policy "save products for self"
  on public.saved_products for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "unsave own products"
  on public.saved_products for delete to authenticated using ((select auth.uid()) = user_id);

-- Reels: read own (created and updated by API/worker).
create policy "read own reels"
  on public.reels for select to authenticated using ((select auth.uid()) = user_id);

-- Campaign results: seller enters their own numbers; linked reel must also be theirs.
create policy "read own campaign results"
  on public.campaign_results for select to authenticated using ((select auth.uid()) = user_id);
create policy "add own campaign results"
  on public.campaign_results for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and (reel_id is null or exists (
      select 1 from public.reels r where r.id = reel_id and r.user_id = (select auth.uid())
    ))
  );
create policy "update own campaign results"
  on public.campaign_results for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and (reel_id is null or exists (
      select 1 from public.reels r where r.id = reel_id and r.user_id = (select auth.uid())
    ))
  );
create policy "delete own campaign results"
  on public.campaign_results for delete to authenticated using ((select auth.uid()) = user_id);

-- Diagnoses: readable when the parent campaign result is yours (written by API).
create policy "read own diagnoses"
  on public.diagnoses for select to authenticated
  using (exists (
    select 1 from public.campaign_results c
    where c.id = result_id and c.user_id = (select auth.uid())
  ));

-- Preorders: read own (created/updated by API after Razorpay verification).
create policy "read own preorders"
  on public.preorders for select to authenticated using ((select auth.uid()) = user_id);
