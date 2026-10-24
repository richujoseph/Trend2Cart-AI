-- Seller details editable in Account. Safe to run more than once.
alter table public.profiles
  add column if not exists display_name text check (char_length(display_name) between 1 and 60),
  add column if not exists business_name text check (char_length(business_name) between 1 and 80),
  add column if not exists whatsapp text check (whatsapp ~ '^[6-9][0-9]{9}$'),
  add column if not exists city text check (char_length(city) between 1 and 60);
