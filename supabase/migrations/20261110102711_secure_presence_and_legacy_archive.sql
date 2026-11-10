-- Phase 1A / EXPAND ONLY.
-- Install the compatible private presence RPC BEFORE deploying a new client.
-- Do NOT change the exposed legacy table privileges here; the currently running
-- production frontend still uses public.online_users until rollout.
-- Phase 1B is in supabase/manual-release/phase1-restrict.sql and MUST be applied
-- only after the verified client release. Preserve all old records.
begin;

create schema if not exists komi_private;
revoke all on schema komi_private from public, anon, authenticated;

-- Keep an immutable reference copy of the original legacy rows.
create table if not exists komi_private.legacy_animes_snapshot_20261110
  as table public.animes;
revoke all on komi_private.legacy_animes_snapshot_20261110 from public, anon, authenticated;
alter table komi_private.legacy_animes_snapshot_20261110 enable row level security;

create table if not exists komi_private.site_presence (
  session_id uuid primary key,
  user_id uuid references auth.users(id) on delete cascade,
  last_seen timestamptz not null default now()
);
alter table komi_private.site_presence enable row level security;
revoke all on komi_private.site_presence from public, anon, authenticated;
create index if not exists site_presence_last_seen_idx
  on komi_private.site_presence(last_seen);

-- The only public API is an aggregate count. Never expose the sessions table.
create or replace function public.komi_site_presence(p_session uuid)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare active_count bigint;
begin
  if p_session is null then
    raise exception 'Session required' using errcode = '22023';
  end if;

  insert into komi_private.site_presence(session_id,user_id,last_seen)
    values(p_session,auth.uid(),now())
    on conflict(session_id) do update
      set last_seen = now(),user_id = auth.uid()
    where komi_private.site_presence.user_id is null
       or komi_private.site_presence.user_id = auth.uid();

  -- Limit routine cleanup work: expiration is enforced by the count query.
  if random() < 0.01 then
    delete from komi_private.site_presence
    where last_seen < now() - interval '1 day';
  end if;

  select count(distinct coalesce(user_id::text,session_id::text))
    into active_count
    from komi_private.site_presence
    where last_seen > now() - interval '30 seconds';
  return active_count;
end;
$$;
revoke all on function public.komi_site_presence(uuid) from public;
grant execute on function public.komi_site_presence(uuid) to anon, authenticated;
comment on function public.komi_site_presence(uuid) is
'Aggregate online count only. Identities and timestamps remain in a private schema.';

commit;
