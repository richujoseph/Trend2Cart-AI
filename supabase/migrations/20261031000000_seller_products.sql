-- Sellers can add a product they found in search to their own shop. Safe to run more than once.

-- owner_id null = our curated catalog; otherwise only that seller sees it.
alter table public.products
  add column if not exists owner_id uuid references auth.users (id) on delete cascade;
create index if not exists products_owner_idx on public.products (owner_id);

-- A seller's own supplier has no rating we can check: leave it empty instead of guessing.
alter table public.products alter column supplier_reliability drop not null;
alter table public.products alter column supplier_reliability drop default;

drop policy if exists "products readable by signed-in users" on public.products;
drop policy if exists "catalog and own products readable" on public.products;
create policy "catalog and own products readable"
  on public.products for select to authenticated
  using (owner_id is null or owner_id = (select auth.uid()));

-- Doctor's daily limit counts campaign_results rows; sellers must not be able to delete or edit them
-- to reset it. The app never edits or deletes results.
drop policy if exists "delete own campaign results" on public.campaign_results;
drop policy if exists "update own campaign results" on public.campaign_results;
