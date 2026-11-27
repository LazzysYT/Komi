-- Opt-in profile wallpaper for a complete owned series. No wallet or profile changes.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create table komi_collection_private.profile_wallpaper (
  user_id uuid primary key references auth.users(id) on delete cascade,
  series_id text not null check (series_id in ('ghoul','jujutsu','frieren','alchemist'))
);
alter table komi_collection_private.profile_wallpaper enable row level security;
revoke all on komi_collection_private.profile_wallpaper from public, anon, authenticated, service_role;
grant select(user_id, series_id) on komi_collection_private.profile_wallpaper to authenticated;

create function komi_collection_private.wallpaper_completed(p_user_id uuid, p_series_id text)
returns boolean language sql stable security invoker set search_path = ''
as $$
  select case
    when p_series_id = 'ghoul' then not exists (
      -- The legacy unpaid/paid Tokyo Ghoul RPCs share this fixed 18-card roster.
      select 1 from pg_catalog.unnest(array[
        'kaneki','touka','juuzou','uta','tsukiyama','hide','rize','arima','eto',
        'ayato','hinami','amon','nishiki','yomo','yoshimura','akira','furuta','takizawa'
      ]::text[]) as r(character_id)
      where not exists (
        select 1 from komi_collection_private.unlocks u
        where u.user_id = p_user_id and u.character_id = r.character_id
      )
    )
    when p_series_id in ('jujutsu','frieren','alchemist') then
      exists (select 1 from komi_collection_private.series_roster r where r.series_id = p_series_id)
      and not exists (
        select 1 from komi_collection_private.series_roster r
        where r.series_id = p_series_id
          and not exists (
            select 1 from komi_collection_private.series_unlocks u
            where u.user_id = p_user_id and u.series_id = r.series_id and u.character_id = r.character_id
          )
      )
    else false
  end
$$;
-- The raw completion query is never callable by a client role.
revoke all on function komi_collection_private.wallpaper_completed(uuid,text)
  from public, anon, authenticated, service_role;

create function komi_collection_private.wallpaper_valid_selection(p_user_id uuid, p_series_id text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select case when komi_collection_private.showcase_verified_actor()
      and (p_user_id = (select auth.uid()) or public.komi_is_profile_visible(p_user_id))
      and exists (
        select 1 from komi_collection_private.profile_wallpaper w
        where w.user_id = p_user_id and w.series_id = p_series_id
      )
    then komi_collection_private.wallpaper_completed(p_user_id, p_series_id)
    else false
  end
$$;
-- The RLS helper can only confirm a key already explicitly selected for a visible profile or self.
-- The schema is not exposed to PostgREST; arbitrary completion queries remain owner-only.
revoke all on function komi_collection_private.wallpaper_valid_selection(uuid,text)
  from public, anon, authenticated, service_role;
grant execute on function komi_collection_private.wallpaper_valid_selection(uuid,text) to authenticated;

create policy "Collector wallpaper follows profile visibility"
on komi_collection_private.profile_wallpaper for select to authenticated
using (
  (user_id = (select auth.uid()) or exists (
    select 1 from public.komi_profiles p where p.user_id = profile_wallpaper.user_id
  ))
  and komi_collection_private.wallpaper_valid_selection(user_id, series_id)
);

create function komi_collection_private.wallpaper_owner_state()
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_unlocked text[];
  v_selected text;
begin
  if not komi_collection_private.showcase_verified_actor() then
    raise exception 'Verified account required' using errcode = '42501';
  end if;
  select coalesce(pg_catalog.array_agg(r.series_id order by r.position), array[]::text[])
  into v_unlocked
  from (values ('ghoul',1),('jujutsu',2),('frieren',3),('alchemist',4)) r(series_id,position)
  where komi_collection_private.wallpaper_completed(v_actor, r.series_id);
  select w.series_id into v_selected from komi_collection_private.profile_wallpaper w
  where w.user_id = v_actor and w.series_id = any(v_unlocked);
  return pg_catalog.jsonb_build_object('series_id', v_selected, 'unlocked', v_unlocked);
end
$$;
revoke all on function komi_collection_private.wallpaper_owner_state()
  from public, anon, authenticated, service_role;
grant execute on function komi_collection_private.wallpaper_owner_state() to authenticated;

create function komi_collection_private.wallpaper_set(p_series_id text)
returns jsonb language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
begin
  if not komi_collection_private.showcase_verified_actor() then
    raise exception 'Verified account required' using errcode = '42501';
  end if;
  if p_series_id is not null and p_series_id not in ('ghoul','jujutsu','frieren','alchemist') then
    raise exception 'Unknown collection series' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('komi_collection:' || v_actor::text, 0));
  if p_series_id is null then
    delete from komi_collection_private.profile_wallpaper w where w.user_id = v_actor;
  else
    if not komi_collection_private.wallpaper_completed(v_actor, p_series_id) then
      raise exception 'Complete this series to unlock its wallpaper' using errcode = '22023';
    end if;
    insert into komi_collection_private.profile_wallpaper(user_id,series_id) values(v_actor,p_series_id)
    on conflict(user_id) do update set series_id = excluded.series_id;
  end if;
  return komi_collection_private.wallpaper_owner_state();
end
$$;
revoke all on function komi_collection_private.wallpaper_set(text)
  from public, anon, authenticated, service_role;
grant execute on function komi_collection_private.wallpaper_set(text) to authenticated;

create function public.komi_collection_wallpaper_read()
returns jsonb language sql stable security invoker set search_path = ''
as $$ select komi_collection_private.wallpaper_owner_state() $$;

create function public.komi_collection_wallpaper_read_handle(p_username text)
returns jsonb language sql stable security invoker set search_path = ''
as $$
  select pg_catalog.jsonb_build_object('series_id', (
    select w.series_id
    from public.komi_profiles p join komi_collection_private.profile_wallpaper w using(user_id)
    where p_username ~ '^[A-Za-z0-9_]{3,48}$' and p.username = p_username
      and public.komi_is_profile_visible(p.user_id)
  ))
$$;

create function public.komi_collection_wallpaper_set(p_series_id text)
returns jsonb language sql volatile security invoker set search_path = ''
as $$ select komi_collection_private.wallpaper_set(p_series_id) $$;

revoke all on function public.komi_collection_wallpaper_read(),
  public.komi_collection_wallpaper_read_handle(text), public.komi_collection_wallpaper_set(text)
  from public, anon, authenticated, service_role;
grant execute on function public.komi_collection_wallpaper_read(),
  public.komi_collection_wallpaper_read_handle(text), public.komi_collection_wallpaper_set(text)
  to authenticated;
commit;
