-- Three additive series, no changes to existing draw pools, wallets or ownership.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';

alter table komi_collection_private.series_roster drop constraint series_roster_series_id_check;
alter table komi_collection_private.series_roster add constraint series_roster_series_id_check check (series_id in ('jujutsu','frieren','alchemist','demon','aot','naruto','bleach','onepiece','chainsaw','hunter'));

alter table komi_collection_private.profile_showcase drop constraint profile_showcase_series_id_check;
alter table komi_collection_private.profile_showcase add constraint profile_showcase_series_id_check check (series_id in ('ghoul','jujutsu','frieren','alchemist','demon','aot','naruto','bleach','onepiece','chainsaw','hunter'));

alter table komi_collection_private.profile_wallpaper drop constraint profile_wallpaper_series_id_check;
alter table komi_collection_private.profile_wallpaper add constraint profile_wallpaper_series_id_check check (series_id in ('ghoul','jujutsu','frieren','alchemist','demon','aot','naruto','bleach','onepiece','chainsaw','hunter'));

insert into komi_collection_private.series_roster (series_id,character_id) values
 ('onepiece','luffy'),
 ('onepiece','zoro'),
 ('onepiece','nami'),
 ('onepiece','usopp'),
 ('onepiece','sanji'),
 ('onepiece','chopper'),
 ('onepiece','robin'),
 ('onepiece','franky'),
 ('onepiece','brook'),
 ('onepiece','jinbe'),
 ('onepiece','ace'),
 ('onepiece','sabo'),
 ('onepiece','shanks'),
 ('onepiece','law'),
 ('onepiece','hancock'),
 ('onepiece','mihawk'),
 ('onepiece','buggy'),
 ('onepiece','smoker'),
 ('onepiece','vivi'),
 ('onepiece','crocodile'),
 ('chainsaw','denji'),
 ('chainsaw','power'),
 ('chainsaw','aki'),
 ('chainsaw','makima'),
 ('chainsaw','pochita'),
 ('chainsaw','kishibe'),
 ('chainsaw','himeno'),
 ('chainsaw','kobeni'),
 ('chainsaw','reze'),
 ('chainsaw','quanxi'),
 ('chainsaw','angel'),
 ('chainsaw','beam'),
 ('chainsaw','galgali'),
 ('chainsaw','princi'),
 ('chainsaw','yoshida'),
 ('chainsaw','katana'),
 ('chainsaw','asa'),
 ('chainsaw','yoru'),
 ('chainsaw','nayuta'),
 ('chainsaw','fumiko'),
 ('hunter','gon'),
 ('hunter','killua'),
 ('hunter','kurapika'),
 ('hunter','leorio'),
 ('hunter','hisoka'),
 ('hunter','chrollo'),
 ('hunter','illumi'),
 ('hunter','netero'),
 ('hunter','bisky'),
 ('hunter','kite'),
 ('hunter','meruem'),
 ('hunter','pitou'),
 ('hunter','komugi'),
 ('hunter','knuckle'),
 ('hunter','shoot'),
 ('hunter','morel'),
 ('hunter','palm'),
 ('hunter','feitan'),
 ('hunter','machi'),
 ('hunter','shizuku');

create or replace function komi_collection_private.showcase_set(p_cards jsonb)
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
    if v_series not in ('ghoul','jujutsu','frieren','alchemist','demon','aot','naruto','bleach','onepiece','chainsaw','hunter') or v_character !~ '^[a-z]{2,32}$' then
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

create or replace function komi_collection_private.journal_read(p_series_id text)
returns jsonb language plpgsql stable security definer set search_path = '' set timezone = 'UTC'
as $$
declare
  v_actor uuid := auth.uid();
  v_rows jsonb;
begin
  if v_actor is null or coalesce(auth.jwt()->>'is_anonymous', 'false') = 'true'
     or not exists (
       select 1 from auth.users u
       where u.id = v_actor and u.deleted_at is null and u.is_anonymous is not true
     ) then
    raise exception 'Verified account required' using errcode = '42501';
  end if;
  if p_series_id is null or p_series_id not in ('ghoul','jujutsu','frieren','alchemist','demon','aot','naruto','bleach','onepiece','chainsaw','hunter') then
    raise exception 'Unknown collection series' using errcode = '22023';
  end if;

  if p_series_id = 'ghoul' then
    -- The exact server timestamp is created_at, not the UTC-day opened_on key.
    select pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object('character_id', x.character_id, 'opened_at', x.created_at)
      order by x.created_at desc, x.character_id
    ) into v_rows
    from (
      select u.character_id, u.created_at
      from komi_collection_private.unlocks u where u.user_id = v_actor
      order by u.created_at desc, u.character_id limit 24
    ) x;
  else
    select pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object('character_id', x.character_id, 'opened_at', x.created_at)
      order by x.created_at desc, x.character_id
    ) into v_rows
    from (
      select u.character_id, u.created_at
      from komi_collection_private.series_unlocks u where u.user_id = v_actor and u.series_id = p_series_id
      order by u.created_at desc, u.character_id limit 24
    ) x;
  end if;
  return coalesce(v_rows, '[]'::jsonb);
end;
$$;

create or replace function komi_collection_private.wallpaper_completed(p_user_id uuid, p_series_id text)
returns boolean language sql stable security invoker set search_path = ''
as $$
  select case when p_series_id is null or p_series_id not in ('ghoul','jujutsu','frieren','alchemist','demon','aot','naruto','bleach','onepiece','chainsaw','hunter') then false else
    (
      exists (select 1 from komi_collection_private.legacy_wallpaper_entitlements e
              where e.user_id = p_user_id and e.series_id = p_series_id)
      and exists (select 1 from komi_collection_private.legacy_wallpaper_pool r where r.series_id=p_series_id)
      and not exists (
        select 1 from komi_collection_private.legacy_wallpaper_pool r where r.series_id = p_series_id
          and case when p_series_id = 'ghoul' then not exists (
            select 1 from komi_collection_private.unlocks u
            where u.user_id = p_user_id and u.character_id = r.character_id
          ) else not exists (
            select 1 from komi_collection_private.series_unlocks u
            where u.user_id = p_user_id and u.series_id = r.series_id and u.character_id = r.character_id
          ) end
      )
    )
    or (
      exists(select 1 from komi_collection_private.legacy_wallpaper_entitlements e
              where e.user_id=p_user_id and e.series_id=p_series_id)
      and exists(select 1 from komi_collection_private.v2_roster r where r.series_id=p_series_id)
      and not exists (
        select 1 from komi_collection_private.v2_roster r where r.series_id=p_series_id
        and case when p_series_id='ghoul' then not exists (
          select 1 from komi_collection_private.unlocks u where u.user_id=p_user_id and u.character_id=r.character_id
        ) else not exists (
          select 1 from komi_collection_private.series_unlocks u
          where u.user_id=p_user_id and u.series_id=r.series_id and u.character_id=r.character_id
        ) end
      )
    )
    or case when p_series_id = 'ghoul' then not exists (
      select 1 from komi_collection_private.ghoul_roster r
      where not exists (
        select 1 from komi_collection_private.unlocks u
        where u.user_id = p_user_id and u.character_id = r.character_id
      )
    ) else
      exists (select 1 from komi_collection_private.series_roster r where r.series_id = p_series_id)
      and not exists (
        select 1 from komi_collection_private.series_roster r
        where r.series_id = p_series_id and not exists (
          select 1 from komi_collection_private.series_unlocks u
          where u.user_id = p_user_id and u.series_id = r.series_id and u.character_id = r.character_id
        )
      )
    end
  end
$$;

create or replace function komi_collection_private.wallpaper_owner_state()
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
  from (values ('ghoul',1),('jujutsu',2),('frieren',3),('alchemist',4),('demon',5),('aot',6),('naruto',7),('bleach',8),('onepiece',9),('chainsaw',10),('hunter',11)) r(series_id,position)
  where komi_collection_private.wallpaper_completed(v_actor, r.series_id);
  select w.series_id into v_selected from komi_collection_private.profile_wallpaper w
  where w.user_id = v_actor and w.series_id = any(v_unlocked);
  return pg_catalog.jsonb_build_object('series_id', v_selected, 'unlocked', v_unlocked);
end
$$;

create or replace function komi_collection_private.wallpaper_set(p_series_id text)
returns jsonb language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
begin
  if not komi_collection_private.showcase_verified_actor() then
    raise exception 'Verified account required' using errcode = '42501';
  end if;
  if p_series_id is not null and p_series_id not in ('ghoul','jujutsu','frieren','alchemist','demon','aot','naruto','bleach','onepiece','chainsaw','hunter') then
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

commit;
