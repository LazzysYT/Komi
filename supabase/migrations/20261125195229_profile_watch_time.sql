-- Private, idempotent native-player time. Intentionally not a wallet, XP or reward input.
create table public.komi_profile_watch_sessions (
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null,
  watched_seconds integer not null check (watched_seconds between 1 and 604800),
  primary key (user_id,session_id)
);
alter table public.komi_profile_watch_sessions enable row level security;
revoke all on public.komi_profile_watch_sessions from public, anon, authenticated;
grant select(user_id,session_id,watched_seconds), insert(user_id,session_id,watched_seconds)
  on public.komi_profile_watch_sessions to authenticated;
grant update(watched_seconds) on public.komi_profile_watch_sessions to authenticated;
create policy "Read own profile watch sessions" on public.komi_profile_watch_sessions
  for select to authenticated using (user_id=(select auth.uid()));
create policy "Insert own profile watch sessions" on public.komi_profile_watch_sessions
  for insert to authenticated with check (user_id=(select auth.uid()));
create policy "Update own profile watch sessions" on public.komi_profile_watch_sessions
  for update to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));

create function public.komi_save_watch_session(p_owner uuid,p_session uuid,p_seconds integer)
returns boolean language plpgsql security invoker set search_path=''
as $fn$
begin
  if p_owner is null or p_owner is distinct from auth.uid() then
    raise exception 'Watch owner unavailable' using errcode='42501';
  end if;
  if p_session is null or p_seconds is null or p_seconds not between 1 and 604800 then
    raise exception 'Invalid watch time' using errcode='22023';
  end if;
  insert into public.komi_profile_watch_sessions as existing(user_id,session_id,watched_seconds)
  values(p_owner,p_session,p_seconds)
  on conflict(user_id,session_id) do update set watched_seconds=excluded.watched_seconds
  where existing.watched_seconds<excluded.watched_seconds;
  return true;
end;
$fn$;

create function public.komi_read_profile_watch_seconds(p_owner uuid)
returns bigint language sql stable security invoker set search_path=''
as $fn$
  select case when p_owner is not null and p_owner=auth.uid() then coalesce(sum(s.watched_seconds),0) end
  from public.komi_profile_watch_sessions s where s.user_id=p_owner;
$fn$;
revoke all on function public.komi_save_watch_session(uuid,uuid,integer),
  public.komi_read_profile_watch_seconds(uuid) from public, anon, authenticated;
grant execute on function public.komi_save_watch_session(uuid,uuid,integer),
  public.komi_read_profile_watch_seconds(uuid) to authenticated;
