-- Reel generation pipeline: template choice, per-job stats, job claiming, monthly quota, video storage.
-- Safe to run more than once.

alter table public.reels
  add column if not exists template_id smallint not null default 1,
  add column if not exists stats jsonb;  -- per-stage seconds and LLM/TTS cost (paise)

do $$ begin
  alter table public.reels add constraint reels_template_id_check check (template_id between 1 and 3);
exception when duplicate_object then null; end $$;

-- Worker: atomically take the oldest queued Reel (skip rows another worker holds).
create or replace function public.claim_next_reel()
returns setof public.reels
language sql
security definer
set search_path = ''
as $$
  update public.reels
     set status = 'processing'
   where id = (
     select id from public.reels
      where status = 'queued'
      order by created_at
      limit 1
      for update skip locked
   )
  returning *;
$$;

-- API: count one Reel against the monthly limit (p_limit null = unlimited).
-- Resets the counter at the start of each month, India time. Row lock prevents double-spending.
create or replace function public.use_reel_quota(p_user uuid, p_limit int)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  used int;
  resets timestamptz;
begin
  select reels_used_this_month, month_reset_at into used, resets
    from public.profiles where id = p_user for update;
  if not found then
    return jsonb_build_object('allowed', false, 'reason', 'no_profile');
  end if;
  if resets <= now() then
    used := 0;
    resets := (date_trunc('month', now() at time zone 'Asia/Kolkata') + interval '1 month') at time zone 'Asia/Kolkata';
  end if;
  if p_limit is not null and used >= p_limit then
    update public.profiles set reels_used_this_month = used, month_reset_at = resets where id = p_user;
    return jsonb_build_object('allowed', false, 'used', used, 'limit', p_limit, 'resets_at', resets);
  end if;
  update public.profiles set reels_used_this_month = used + 1, month_reset_at = resets where id = p_user;
  return jsonb_build_object('allowed', true, 'used', used + 1, 'limit', p_limit, 'resets_at', resets);
end;
$$;

-- Worker: give the Reel back when a job fails, so sellers aren't charged for our errors.
create or replace function public.refund_reel_quota(p_user uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.profiles
     set reels_used_this_month = greatest(reels_used_this_month - 1, 0)
   where id = p_user;
$$;

-- Only the server (service role) may call these.
revoke execute on function public.claim_next_reel() from public, anon, authenticated;
revoke execute on function public.use_reel_quota(uuid, int) from public, anon, authenticated;
revoke execute on function public.refund_reel_quota(uuid) from public, anon, authenticated;
grant execute on function public.claim_next_reel() to service_role;
grant execute on function public.use_reel_quota(uuid, int) to service_role;
grant execute on function public.refund_reel_quota(uuid) to service_role;

-- Public bucket for finished Reels (URLs are unguessable UUID paths; sellers share them anyway).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('reels', 'reels', true, 52428800, array['video/mp4'])
on conflict (id) do nothing;
