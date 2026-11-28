-- Extend confirmed albums and preserve the previous catalog's completion and open offers.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

lock table komi_collection_private.unlocks, komi_collection_private.series_unlocks
  in share row exclusive mode;

alter table komi_collection_private.series_roster
  drop constraint series_roster_series_id_check,
  add constraint series_roster_series_id_check check (series_id in ('jujutsu','frieren','alchemist','demon','aot','naruto','bleach','onepiece','chainsaw','hunter','deathnote','heroacademia','sololeveling'));
alter table komi_collection_private.profile_showcase
  drop constraint profile_showcase_series_id_check,
  add constraint profile_showcase_series_id_check check (series_id in ('ghoul','jujutsu','frieren','alchemist','demon','aot','naruto','bleach','onepiece','chainsaw','hunter','deathnote','heroacademia','sololeveling'));
alter table komi_collection_private.profile_wallpaper
  drop constraint profile_wallpaper_series_id_check,
  add constraint profile_wallpaper_series_id_check check (series_id in ('ghoul','jujutsu','frieren','alchemist','demon','aot','naruto','bleach','onepiece','chainsaw','hunter','deathnote','heroacademia','sololeveling'));

alter table komi_collection_private.pack_rarity
  drop constraint pack_rarity_catalog_version_check,
  add constraint pack_rarity_catalog_version_check check (catalog_version in (1,2,3));
alter table komi_collection_private.pack_offers
  drop constraint pack_offers_catalog_version_check,
  add constraint pack_offers_catalog_version_check check (catalog_version in (1,2,3));

alter table komi_collection_private.world_art_previous_completion
  add column catalog_version smallint not null default 1 check (catalog_version in (1,2));

insert into komi_collection_private.world_art_previous_completion as completion (user_id,series_id,catalog_version)
select u.user_id,u.series_id,2
from (
  select user_id,'ghoul'::text as series_id,character_id from komi_collection_private.unlocks
  union all
  select user_id,series_id,character_id from komi_collection_private.series_unlocks
) u join komi_collection_private.pack_rarity r using(series_id,character_id)
group by u.user_id,u.series_id
having count(*)=(select count(*) from komi_collection_private.pack_rarity r where r.series_id=u.series_id)
on conflict (user_id,series_id) do update
  set catalog_version=excluded.catalog_version
  where completion.catalog_version<excluded.catalog_version;

insert into komi_collection_private.pack_rarity (series_id,character_id,rarity,catalog_version) values
  ('ghoul','saiko','rare',3),
  ('jujutsu','uraume','epic',3),
  ('frieren','edel','rare',3),
  ('alchemist','barry','epic',3),
  ('demon','kaigaku','epic',3),
  ('aot','floch','rare',3),
  ('naruto','ino','rare',3),
  ('bleach','ukitake','epic',3),
  ('onepiece','yamato','legendary',3),
  ('chainsaw','barem','epic',3),
  ('hunter','melody','rare',3),
  ('hunter','ging','legendary',3),
  ('deathnote','light','legendary',3),
  ('deathnote','lawliet','legendary',3),
  ('deathnote','misa','epic',3),
  ('deathnote','ryuk','legendary',3),
  ('deathnote','rem','epic',3),
  ('deathnote','near','epic',3),
  ('deathnote','mello','epic',3),
  ('deathnote','matsuda','common',3),
  ('deathnote','soichiro','rare',3),
  ('deathnote','watari','rare',3),
  ('deathnote','mikami','rare',3),
  ('deathnote','naomi','rare',3),
  ('heroacademia','deku','legendary',3),
  ('heroacademia','bakugo','epic',3),
  ('heroacademia','todoroki','epic',3),
  ('heroacademia','uraraka','rare',3),
  ('heroacademia','allmight','legendary',3),
  ('heroacademia','aizawa','epic',3),
  ('heroacademia','endeavor','epic',3),
  ('heroacademia','hawks','epic',3),
  ('heroacademia','tsuyu','common',3),
  ('heroacademia','kirishima','rare',3),
  ('heroacademia','shigaraki','legendary',3),
  ('heroacademia','toga','epic',3),
  ('sololeveling','jinwoo','legendary',3),
  ('sololeveling','chae','epic',3),
  ('sololeveling','igris','legendary',3),
  ('sololeveling','jinho','rare',3),
  ('sololeveling','baek','epic',3),
  ('sololeveling','choi','epic',3),
  ('sololeveling','woo','rare',3),
  ('sololeveling','gunhee','epic',3),
  ('sololeveling','joohee','common',3),
  ('sololeveling','song','rare',3),
  ('sololeveling','kimchul','rare',3),
  ('sololeveling','esil','epic',3);

insert into komi_collection_private.ghoul_roster (character_id)
select character_id from komi_collection_private.pack_rarity where series_id='ghoul' and catalog_version=3;
insert into komi_collection_private.series_roster (series_id,character_id)
select series_id,character_id from komi_collection_private.pack_rarity where series_id<>'ghoul' and catalog_version=3;

create or replace function komi_collection_private.wallpaper_completed(p_user_id uuid, p_series_id text)
returns boolean language sql stable security invoker set search_path = ''
as $$
  select case when p_series_id is null or not exists (select 1 from komi_collection_private.pack_rarity r where r.series_id=p_series_id) then false else
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
    or exists (
      select 1 from komi_collection_private.world_art_previous_completion e
      where e.user_id=p_user_id and e.series_id=p_series_id
      and not exists (
        select 1 from komi_collection_private.pack_rarity r
        where r.series_id=e.series_id and r.catalog_version<=e.catalog_version
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
  from (values ('ghoul',1),('jujutsu',2),('frieren',3),('alchemist',4),('demon',5),('aot',6),('naruto',7),('bleach',8),('onepiece',9),('chainsaw',10),('hunter',11),('deathnote',12),('heroacademia',13),('sololeveling',14)) r(series_id,position)
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
  if p_series_id is not null and not exists (select 1 from komi_collection_private.pack_rarity r where r.series_id=p_series_id) then
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
    if not exists (select 1 from komi_collection_private.pack_rarity r where r.series_id=v_series) or v_character !~ '^[a-z]{2,32}$' then
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
  if p_series_id is null or not exists (select 1 from komi_collection_private.pack_rarity r where r.series_id=p_series_id) then
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

create or replace function komi_collection_private.pick_pack_for_catalog(p_series_id text, p_offer_id uuid, p_slot integer, p_catalog_version integer)
returns jsonb language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_series text;
  v_pack komi_collection_private.pack_offers%rowtype;
  v_owned text[];
  v_choices text[];
  v_visible jsonb;
  v_snapshot jsonb;
  v_result text;
  v_balance bigint;
  v_status text := 'ready';
  v_price constant integer := 50;
begin
  if v_user is null or coalesce(auth.jwt()->>'is_anonymous','false') = 'true'
     or not exists(select 1 from auth.users where id=v_user and deleted_at is null and is_anonymous is not true) then
    raise exception 'Authentication required' using errcode='42501';
  end if;
  if p_catalog_version is null or p_catalog_version not in (1,2,3) then
    raise exception 'Unsupported card catalog' using errcode='22023';
  end if;
  if (p_slot is not null and (p_offer_id is null or p_slot not between 1 and 5))
     or (p_slot is null and p_series_id is null) then
    raise exception 'Invalid pack request' using errcode='22023';
  end if;

  -- Same lock and lock order as legacy purchases, including wallet mutations.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('komi_collection:' || v_user::text, 0));

  if p_offer_id is not null then
    select o.* into v_pack from komi_collection_private.pack_offers o
      where o.id=p_offer_id and o.user_id=v_user;
    if not found or (p_series_id is not null and p_series_id is distinct from v_pack.series_id) then
      raise exception 'Pack unavailable' using errcode='22023';
    end if;
  end if;
  v_series := coalesce(p_series_id, v_pack.series_id);
  if not exists (
    select 1 from komi_collection_private.pack_rarity r
    where r.series_id=v_series and r.catalog_version<=p_catalog_version
  ) then
    raise exception 'Unknown collection series' using errcode='22023';
  end if;

  if v_series='ghoul' then
    v_snapshot := komi_collection_private.action('read');
  else
    v_snapshot := komi_collection_private.series_action_edition(v_series, null, false, 3);
  end if;
  v_owned := array(select pg_catalog.jsonb_array_elements_text(v_snapshot->'owned'));

  if v_pack.id is null then
    select o.* into v_pack from komi_collection_private.pack_offers o
      where o.user_id=v_user and o.series_id=v_series and o.claimed_slot is null and not o.obsolete;
  end if;

  if v_pack.catalog_version > p_catalog_version then
    raise exception 'Open the current collection to resume this pack' using errcode='22023';
  end if;

  if v_pack.id is not null and v_pack.claimed_slot is not null then
    -- Retries and concurrent picks always read back the first committed choice.
    v_status := 'claimed';
  elsif v_pack.id is not null and (v_pack.obsolete or v_pack.choices <@ v_owned) then
    update komi_collection_private.pack_offers set obsolete=true where id=v_pack.id;
    if p_offer_id is null then
      v_pack := null;
    else
      v_status := 'stale';
    end if;
  end if;

  if v_pack.id is null then
    select pg_catalog.array_agg(c.character_id order by c.draw) into v_choices
    from (
      select r.character_id, pg_catalog.random() as draw
        from komi_collection_private.pack_rarity r
        where r.series_id=v_series and r.catalog_version<=p_catalog_version and not (r.character_id=any(v_owned))
        order by draw limit 5
    ) c;
    if v_choices is null then
      return v_snapshot || pg_catalog.jsonb_build_object('pack_status','complete');
    end if;
    if coalesce((v_snapshot->>'balance')::bigint,0) < v_price then
      return v_snapshot || pg_catalog.jsonb_build_object('pack_status','insufficient');
    end if;
    insert into komi_collection_private.pack_offers (user_id, series_id, choices, catalog_version)
      values (v_user, v_series, v_choices, p_catalog_version) returning * into v_pack;
  elsif v_status='ready' and p_slot is not null then
    v_result := v_pack.choices[p_slot];
    if v_result is null then
      raise exception 'Invalid pack slot' using errcode='22023';
    end if;
    if v_result=any(v_owned) then
      v_status := 'stale';
    else
      select balance into v_balance from public.komi_anicoin_wallets
        where user_id=v_user for update;
      if coalesce(v_balance,0) < v_price then
        v_status := 'insufficient';
        v_snapshot := v_snapshot || pg_catalog.jsonb_build_object('balance',coalesce(v_balance,0));
      else
        update public.komi_anicoin_wallets set balance=balance-v_price where user_id=v_user;
        if v_series='ghoul' then
          insert into komi_collection_private.unlocks (user_id,character_id,opened_on,paid_request_id,paid_cost)
            values(v_user,v_result,(now() at time zone 'UTC')::date,v_pack.settlement_id,v_price);
        else
          insert into komi_collection_private.series_unlocks (user_id,series_id,character_id,paid_request_id,paid_cost)
            values(v_user,v_series,v_result,v_pack.settlement_id,v_price);
        end if;
        update komi_collection_private.pack_offers set claimed_slot=p_slot where id=v_pack.id returning * into v_pack;
        v_snapshot := v_snapshot || pg_catalog.jsonb_build_object(
          'owned', pg_catalog.to_jsonb(pg_catalog.array_append(v_owned,v_result)), 'balance', v_balance-v_price);
        v_status := 'claimed';
      end if;
    end if;
  end if;

  select pg_catalog.jsonb_agg(
    pg_catalog.jsonb_build_object('slot', c.slot,
      'available', v_status <> 'claimed' and not(c.character_id=any(v_owned)))
    || case
         when v_status='claimed' then pg_catalog.jsonb_build_object('id',c.character_id,'rarity',r.rarity)
         when p_catalog_version=1 then pg_catalog.jsonb_build_object('rarity',r.rarity)
         else '{}'::jsonb
       end
    order by c.slot
  ) into v_visible
  from pg_catalog.unnest(v_pack.choices) with ordinality c(character_id,slot)
  join komi_collection_private.pack_rarity r on r.series_id=v_series and r.character_id=c.character_id;

  return v_snapshot || pg_catalog.jsonb_build_object(
    'pack_status', v_status,
    'offer_id', v_pack.id,
    'choices', v_visible,
    'selected_slot', v_pack.claimed_slot,
    'result', v_pack.choices[v_pack.claimed_slot],
    'purchase_status', case when v_status='claimed' then 'ok' else null end
  );
end;
$$;

create function public.komi_collection_pack_open_v3(p_series_id text,p_offer_id uuid default null)
returns jsonb language sql volatile security invoker set search_path = ''
as $$ select komi_collection_private.pick_pack_for_catalog(p_series_id,p_offer_id,null,3) $$;

create function public.komi_collection_pack_claim_v3(p_offer_id uuid,p_slot integer)
returns jsonb language sql volatile security invoker set search_path = ''
as $$ select komi_collection_private.pick_pack_for_catalog(null,p_offer_id,p_slot,3) $$;

revoke all on function public.komi_collection_pack_open_v3(text,uuid),public.komi_collection_pack_claim_v3(uuid,integer)
  from public,anon,authenticated,service_role;
grant execute on function public.komi_collection_pack_open_v3(text,uuid),public.komi_collection_pack_claim_v3(uuid,integer)
  to authenticated;

commit;
