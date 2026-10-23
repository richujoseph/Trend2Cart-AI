-- Reels: which step the worker is on, so the progress screen shows real progress. Safe to run more than once.
alter table public.reels
  add column if not exists stage text check (stage in ('script', 'voice', 'video'));
