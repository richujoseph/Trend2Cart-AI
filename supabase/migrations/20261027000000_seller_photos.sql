-- Sellers can upload their own product photos for a Reel (sharper and more honest than thumbnails).
-- Safe to run more than once.

alter table public.reels
  add column if not exists photo_paths text[] not null default '{}';  -- paths in the seller-photos bucket

-- Private bucket: only the owner (folder = their user id) can upload or read; the worker uses the service key.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('seller-photos', 'seller-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "sellers upload own photos" on storage.objects;
create policy "sellers upload own photos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'seller-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "sellers read own photos" on storage.objects;
create policy "sellers read own photos"
  on storage.objects for select to authenticated
  using (bucket_id = 'seller-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "sellers delete own photos" on storage.objects;
create policy "sellers delete own photos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'seller-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
