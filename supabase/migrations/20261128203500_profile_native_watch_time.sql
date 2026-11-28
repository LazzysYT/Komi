-- Private, idempotent native-player time. Intentionally not a wallet, XP or reward input.
create table public.komi_profile_watch_sessions (
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null,
  watched_milliseconds integer not null check (watched_milliseconds between 1 and 604800000),
  primary key (user_id,session_id)
);
alter table public.komi_profile_watch_sessions enable row level security;
revoke all on public.komi_profile_watch_sessions from public, anon, authenticated;
grant select(user_id,session_id,watched_milliseconds), insert(user_id,session_id,watched_milliseconds)
  on public.komi_profile_watch_sessions to authenticated;
grant update(watched_milliseconds) on public.komi_profile_watch_sessions to authenticated;
create policy "Read own profile watch sessions" on public.komi_profile_watch_sessions
  for select to authenticated using (user_id=(select auth.uid()));
create policy "Insert own profile watch sessions" on public.komi_profile_watch_sessions
  for insert to authenticated with check (user_id=(select auth.uid()));
create policy "Update own profile watch sessions" on public.komi_profile_watch_sessions
  for update to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));

-- Preserve the previously displayed verified AniCoin time once, without double counting later rewards.
create table public.komi_profile_watch_baseline (
  user_id uuid primary key references auth.users(id) on delete cascade,
  watched_seconds bigint not null check (watched_seconds >= 0)
);
insert into public.komi_profile_watch_baseline(user_id,watched_seconds)
select coalesce(w.user_id,l.user_id),coalesce(w.watch_seconds,0)+coalesce(l.rewards,0)*1200
  from public.komi_anicoin_wallets w full join (
    select user_id,count(*) as rewards
    from public.komi_anicoin_ledger where reason='watch' and delta=1 group by user_id
  ) l on w.user_id=l.user_id
  where coalesce(w.watch_seconds,0)>0 or coalesce(l.rewards,0)>0;
alter table public.komi_profile_watch_baseline enable row level security;
revoke all on public.komi_profile_watch_baseline from public,anon,authenticated;
grant select(user_id,watched_seconds) on public.komi_profile_watch_baseline to authenticated;
create policy "Read own watch baseline" on public.komi_profile_watch_baseline
  for select to authenticated using (user_id=(select auth.uid()));

create function public.komi_save_watch_session(p_owner uuid,p_session uuid,p_milliseconds integer)
returns boolean language plpgsql security invoker set search_path=''
as $fn$
begin
  if p_owner is null or p_owner is distinct from auth.uid() then
    raise exception 'Watch owner unavailable' using errcode='42501';
  end if;
  if p_session is null or p_milliseconds is null or p_milliseconds not between 1 and 604800000 then
    raise exception 'Invalid watch time' using errcode='22023';
  end if;
  insert into public.komi_profile_watch_sessions as existing(user_id,session_id,watched_milliseconds)
  values(p_owner,p_session,p_milliseconds)
  on conflict(user_id,session_id) do update set watched_milliseconds=excluded.watched_milliseconds
  where existing.watched_milliseconds<excluded.watched_milliseconds;
  return true;
end;
$fn$;

create function public.komi_read_profile_watch_seconds(p_owner uuid)
returns bigint language sql stable security invoker set search_path=''
as $fn$
  select case when p_owner is not null and p_owner=auth.uid() then coalesce(sum(s.watched_milliseconds),0)/1000 + coalesce((
    select b.watched_seconds from public.komi_profile_watch_baseline b where b.user_id=p_owner
  ),0) end
  from public.komi_profile_watch_sessions s where s.user_id=p_owner;
$fn$;
revoke all on function public.komi_save_watch_session(uuid,uuid,integer),
  public.komi_read_profile_watch_seconds(uuid) from public, anon, authenticated;
grant execute on function public.komi_save_watch_session(uuid,uuid,integer),
  public.komi_read_profile_watch_seconds(uuid) to authenticated;
