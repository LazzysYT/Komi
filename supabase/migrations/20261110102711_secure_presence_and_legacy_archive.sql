-- Apply after the client has stopped writing shared legacy blobs.
-- Preserve all legacy records; do not infer ownership from a username.
begin;
create schema if not exists komi_private;
revoke all on schema komi_private from public, anon, authenticated;
create table komi_private.legacy_animes_snapshot_20261110 as table public.animes;
revoke all on komi_private.legacy_animes_snapshot_20261110 from public, anon, authenticated;
alter table komi_private.legacy_animes_snapshot_20261110 enable row level security;

alter table public.animes enable row level security;
revoke all on public.animes from public, anon, authenticated;
grant select on public.animes to anon, authenticated;
create policy "Legacy public comments and profiles archive" on public.animes
  for select to anon, authenticated using (id in (2,4));
alter table public.online_users enable row level security;
revoke all on public.online_users from public, anon, authenticated;
-- Existing rows remain archived. No browser may enumerate or delete other sessions.

create table komi_private.site_presence (
  session_id uuid primary key,
  user_id uuid references auth.users(id) on delete cascade,
  last_seen timestamptz not null default now()
);
alter table komi_private.site_presence enable row level security;
revoke all on komi_private.site_presence from public, anon, authenticated;
create index site_presence_last_seen_idx on komi_private.site_presence(last_seen);
create function public.komi_site_presence(p_session uuid)
returns bigint language plpgsql security definer set search_path = '' as $$
declare active_count bigint;
begin
  if p_session is null then raise exception 'Session required' using errcode='22023'; end if;
  -- UUID is an unguessable per-tab capability. Identity always comes from Auth.
  insert into komi_private.site_presence(session_id,user_id,last_seen)
    values(p_session,auth.uid(),now())
    on conflict(session_id) do update set last_seen=now(),user_id=auth.uid()
    where komi_private.site_presence.user_id is null
       or komi_private.site_presence.user_id=auth.uid();
  delete from komi_private.site_presence where last_seen < now()-interval '1 day';
  select count(distinct coalesce(user_id::text,session_id::text)) into active_count
    from komi_private.site_presence where last_seen > now()-interval '30 seconds';
  return active_count;
end;
$$;
revoke all on function public.komi_site_presence(uuid) from public;
grant execute on function public.komi_site_presence(uuid) to anon, authenticated;
comment on function public.komi_site_presence(uuid) is 'Public aggregate only. Guests use random session capabilities; identities and timestamps are server-owned. Visitor counts are approximate, not an anti-bot metric.';
-- Root-folder anonymous avatar upload was a legacy bypass of owner folders.
drop policy if exists "Komi public avatar uploads" on storage.objects;
commit;
