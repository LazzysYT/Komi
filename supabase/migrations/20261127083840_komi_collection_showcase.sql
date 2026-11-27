-- Optional collector showcase. Readers can see only explicitly selected cards.
-- Legacy and new ownership ledgers and all wallet records remain untouched.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create table komi_collection_private.profile_showcase (
  user_id uuid not null references auth.users(id) on delete cascade,
  position smallint not null check (position between 1 and 3),
  series_id text not null check (series_id in ('ghoul','jujutsu','frieren','alchemist')),
  character_id text not null,
  ghoul_character_id text generated always as (
    case when series_id = 'ghoul' then character_id else null end
  ) stored,
  expansion_series_id text generated always as (
    case when series_id <> 'ghoul' then series_id else null end
  ) stored,
  expansion_character_id text generated always as (
    case when series_id <> 'ghoul' then character_id else null end
  ) stored,
  primary key (user_id, position),
  unique (user_id, series_id, character_id),
  foreign key (user_id, ghoul_character_id)
    references komi_collection_private.unlocks(user_id, character_id) on delete cascade,
  foreign key (user_id, expansion_series_id, expansion_character_id)
    references komi_collection_private.series_unlocks(user_id, series_id, character_id) on delete cascade
);
alter table komi_collection_private.profile_showcase enable row level security;
revoke all on komi_collection_private.profile_showcase from public, anon, authenticated, service_role;
-- Only these public opt-in fields are readable. No client table writes.
grant select(user_id, position, series_id, character_id)
  on komi_collection_private.profile_showcase to authenticated;

create function komi_collection_private.showcase_verified_actor()
returns boolean language sql stable security definer set search_path = ''
as $$
  select coalesce(auth.jwt()->>'is_anonymous', 'false') <> 'true'
    and exists (
      select 1 from auth.users u where u.id = (select auth.uid())
        and u.deleted_at is null and u.is_anonymous is not true
    )
$$;
revoke all on function komi_collection_private.showcase_verified_actor()
  from public, anon, authenticated, service_role;
grant execute on function komi_collection_private.showcase_verified_actor() to authenticated;

create policy "Collector showcase follows profile visibility"
on komi_collection_private.profile_showcase for select to authenticated
using (
  (select komi_collection_private.showcase_verified_actor())
  and (
    user_id = (select auth.uid())
    or exists (
      -- Deliberately read as invoker so current/future profile RLS applies.
      select 1 from public.komi_profiles p where p.user_id = profile_showcase.user_id
    )
  )
);

create function public.komi_collection_showcase_read(p_profile_id uuid)
returns jsonb language sql stable security invoker set search_path = ''
as $$
  select coalesce(pg_catalog.jsonb_agg(
    pg_catalog.jsonb_build_object('series_id', s.series_id, 'character_id', s.character_id)
    order by s.position
  ), '[]'::jsonb)
  from komi_collection_private.profile_showcase s
  where s.user_id = p_profile_id and p_profile_id = (select auth.uid())
$$;

create function public.komi_collection_showcase_read_handle(p_username text)
returns jsonb language sql stable security invoker set search_path = ''
as $$
  select coalesce(pg_catalog.jsonb_agg(
    pg_catalog.jsonb_build_object('series_id', s.series_id, 'character_id', s.character_id)
    order by s.position
  ), '[]'::jsonb)
  from public.komi_profiles p
  join komi_collection_private.profile_showcase s using(user_id)
  where p_username ~ '^[A-Za-z0-9_]{3,48}$' and p.username = p_username
    -- Treat this route as a public-profile preview even for the profile owner.
    and public.komi_is_profile_visible(p.user_id)
$$;

create function komi_collection_private.showcase_set(p_cards jsonb)
returns jsonb language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_card jsonb;
  v_position smallint := 0;
  v_series text;
  v_character text;
  v_seen text[] := array[]::text[];
begin
  if not komi_collection_private.showcase_verified_actor() then
    raise exception 'Verified account required' using errcode = '42501';
  end if;
  if pg_catalog.jsonb_typeof(p_cards) is distinct from 'array' then
    raise exception 'Expected an array of showcase cards' using errcode = '22023';
  end if;
  if pg_catalog.jsonb_array_length(p_cards) > 3 then
    raise exception 'Only three showcase cards are allowed' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('komi_collection_showcase:' || v_actor::text, 0));
  for v_card in select value from pg_catalog.jsonb_array_elements(p_cards) loop
    if pg_catalog.jsonb_typeof(v_card) is distinct from 'object' then
      raise exception 'Invalid showcase card' using errcode = '22023';
    end if;
    if pg_catalog.jsonb_typeof(v_card->'series_id') is distinct from 'string'
       or pg_catalog.jsonb_typeof(v_card->'character_id') is distinct from 'string'
       or v_card - 'series_id' - 'character_id' <> '{}'::jsonb then
      raise exception 'Invalid showcase card' using errcode = '22023';
    end if;
    v_series := v_card->>'series_id';
    v_character := v_card->>'character_id';
    if v_series not in ('ghoul','jujutsu','frieren','alchemist') or v_character !~ '^[a-z]{2,32}$' then
      raise exception 'Invalid showcase card' using errcode = '22023';
    end if;
    if (v_series || ':' || v_character) = any(v_seen) then
      raise exception 'Duplicate showcase card' using errcode = '22023';
    end if;
    v_seen := pg_catalog.array_append(v_seen, v_series || ':' || v_character);

    if (v_series = 'ghoul' and not exists (
      select 1 from komi_collection_private.unlocks u
      where u.user_id = v_actor and u.character_id = v_character
    )) or (v_series <> 'ghoul' and not exists (
      select 1 from komi_collection_private.series_unlocks u
      where u.user_id = v_actor and u.series_id = v_series and u.character_id = v_character
    )) then
      raise exception 'Card is not in your collection' using errcode = '22023';
    end if;
  end loop;

  -- This order represents explicit selection. An empty array is a full opt-out.
  delete from komi_collection_private.profile_showcase s where s.user_id = v_actor;
  for v_card in select value from pg_catalog.jsonb_array_elements(p_cards) loop
    v_position := v_position + 1;
    insert into komi_collection_private.profile_showcase (user_id, position, series_id, character_id)
      values (v_actor, v_position, v_card->>'series_id', v_card->>'character_id');
  end loop;
  return p_cards;
end;
$$;
revoke all on function komi_collection_private.showcase_set(jsonb)
  from public, anon, authenticated, service_role;
grant execute on function komi_collection_private.showcase_set(jsonb) to authenticated;

create function public.komi_collection_showcase_set(p_cards jsonb)
returns jsonb language sql volatile security invoker set search_path = ''
as $$ select komi_collection_private.showcase_set(p_cards) $$;

revoke all on function public.komi_collection_showcase_read(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.komi_collection_showcase_read_handle(text)
  from public, anon, authenticated, service_role;
revoke all on function public.komi_collection_showcase_set(jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.komi_collection_showcase_read(uuid) to authenticated;
grant execute on function public.komi_collection_showcase_read_handle(text) to authenticated;
grant execute on function public.komi_collection_showcase_set(jsonb) to authenticated;
commit;
