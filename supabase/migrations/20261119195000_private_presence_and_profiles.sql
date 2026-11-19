-- Private profile/online controls; no change to account data or subscriptions.
create table if not exists komi_private.user_privacy (
 user_id uuid primary key references auth.users(id) on delete cascade,
 invisible boolean not null default false,
 hide_profile boolean not null default false,
 updated_at timestamptz not null default now()
);
alter table komi_private.user_privacy enable row level security;
revoke all on komi_private.user_privacy from public,anon,authenticated;

create or replace function public.komi_privacy(
 p_action text default 'read',
 p_invisible boolean default null,
 p_hide_profile boolean default null
) returns jsonb language plpgsql security definer set search_path=''
as $fn$
declare actor uuid:=auth.uid(); result komi_private.user_privacy%rowtype;
begin
 if actor is null or not exists (
   select 1 from auth.users u
   where u.id=actor and u.deleted_at is null and u.is_anonymous is not true
 ) then raise exception 'Verified account required' using errcode='42501'; end if;
 if p_action not in ('read','update') or p_action is null then
   raise exception 'Unsupported action' using errcode='22023';
 end if;
 if p_action='update' then
   if p_invisible is null and p_hide_profile is null then
     raise exception 'No privacy change provided' using errcode='22023'; end if;
   insert into komi_private.user_privacy(user_id,invisible,hide_profile)
    values(actor,coalesce(p_invisible,false),coalesce(p_hide_profile,false))
   on conflict(user_id) do update set
    invisible=coalesce(p_invisible,komi_private.user_privacy.invisible),
    hide_profile=coalesce(p_hide_profile,komi_private.user_privacy.hide_profile),
    updated_at=now();
 end if;
 select * into result from komi_private.user_privacy where user_id=actor;
 return jsonb_build_object('invisible',coalesce(result.invisible,false),
                           'hide_profile',coalesce(result.hide_profile,false));
end $fn$;
revoke all on function public.komi_privacy(text,boolean,boolean) from public,anon,authenticated;
grant execute on function public.komi_privacy(text,boolean,boolean) to authenticated;

create or replace function public.komi_is_profile_visible(p_user uuid)
returns boolean language sql stable security definer set search_path=''
as $fn$
 select not exists(select 1 from komi_private.user_privacy p
                   where p.user_id=p_user and p.hide_profile)
$fn$;
revoke all on function public.komi_is_profile_visible(uuid) from public,anon,authenticated;
grant execute on function public.komi_is_profile_visible(uuid) to authenticated;

-- Maintain owner reads, but withhold private public profile records from other accounts.
drop policy if exists "komi profiles read" on public.komi_profiles;
create policy "komi profiles read" on public.komi_profiles
 for select to authenticated
 using(user_id=(select auth.uid()) or (select public.komi_is_profile_visible(user_id)));

-- Preserve existing 6-second heartbeat protection and verified-person counting.
create or replace function public.komi_site_presence(p_session uuid)
returns bigint language plpgsql security definer set search_path=''
as $fn$
declare
 actor uuid:=auth.uid();
 observed_at timestamptz:=clock_timestamp();
 active_count bigint;
begin
 if p_session is null then raise exception 'Session required' using errcode='22023'; end if;
 if actor is not null and exists(
   select 1 from auth.users u where u.id=actor and u.deleted_at is null
    and u.is_anonymous is not true
    and (u.email_confirmed_at is not null or u.phone_confirmed_at is not null)
 ) then
   if exists(select 1 from komi_private.user_privacy x
             where x.user_id=actor and x.invisible) then
     delete from komi_private.site_presence where session_id=actor and user_id=actor;
   elsif not exists(
     select 1 from komi_private.site_presence p
     where p.session_id=actor and p.user_id=actor
       and p.last_seen>observed_at-interval '6 seconds'
   ) then
     insert into komi_private.site_presence as p(session_id,user_id,last_seen)
      values(actor,actor,observed_at)
     on conflict(session_id) do update
      set user_id=excluded.user_id,last_seen=excluded.last_seen
     where p.user_id is distinct from actor
       or p.last_seen<=observed_at-interval '6 seconds';
   end if;
 end if;
 select count(*) into active_count
 from komi_private.site_presence p
 where p.session_id=p.user_id and p.last_seen>observed_at-interval '30 seconds'
   and not exists(select 1 from komi_private.user_privacy x
                  where x.user_id=p.user_id and x.invisible);
 return active_count;
end $fn$;
-- The existing function's EXECUTE grants are intentionally preserved by CREATE OR REPLACE.
