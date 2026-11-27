-- Append-only album expansion. V2 clients only see prizes from their original draw pool.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create table komi_collection_private.v2_roster (
 series_id text not null,
 character_id text not null,
 primary key (series_id, character_id)
);
alter table komi_collection_private.v2_roster enable row level security;
revoke all on komi_collection_private.v2_roster from public, anon, authenticated, service_role;
insert into komi_collection_private.v2_roster
select 'ghoul', character_id from komi_collection_private.ghoul_roster
union all select series_id, character_id from komi_collection_private.series_roster;

-- Preserve original wallpaper entitlements and grandfather owners of the full 20-card albums.
alter table komi_collection_private.legacy_wallpaper_entitlements drop constraint legacy_wallpaper_entitlements_series_id_check;
alter table komi_collection_private.legacy_wallpaper_entitlements add constraint legacy_wallpaper_entitlements_series_id_check
 check (series_id in ('ghoul','jujutsu','frieren','alchemist','demon','aot'));
insert into komi_collection_private.legacy_wallpaper_entitlements(user_id,series_id)
select u.user_id,u.series_id
from (
 select user_id,'ghoul'::text as series_id,character_id from komi_collection_private.unlocks
 union all select user_id,series_id,character_id from komi_collection_private.series_unlocks
) u
join komi_collection_private.v2_roster r using(series_id,character_id)
group by u.user_id,u.series_id
having count(*)=20
on conflict do nothing;

alter table komi_collection_private.series_roster drop constraint series_roster_series_id_check;
alter table komi_collection_private.series_roster add constraint series_roster_series_id_check check (series_id in ('jujutsu','frieren','alchemist','demon','aot','naruto','bleach'));

alter table komi_collection_private.profile_showcase drop constraint profile_showcase_series_id_check;
alter table komi_collection_private.profile_showcase add constraint profile_showcase_series_id_check check (series_id in ('ghoul','jujutsu','frieren','alchemist','demon','aot','naruto','bleach'));

alter table komi_collection_private.profile_wallpaper drop constraint profile_wallpaper_series_id_check;
alter table komi_collection_private.profile_wallpaper add constraint profile_wallpaper_series_id_check check (series_id in ('ghoul','jujutsu','frieren','alchemist','demon','aot','naruto','bleach'));

insert into komi_collection_private.ghoul_roster (character_id) values
 ('yamori'),
 ('naki'),
 ('koma'),
 ('tatara');

insert into komi_collection_private.series_roster (series_id,character_id) values
 ('jujutsu','jogo'),
 ('jujutsu','hanami'),
 ('jujutsu','dagon'),
 ('jujutsu','higuruma'),
 ('frieren','sein'),
 ('frieren','aura'),
 ('frieren','lugner'),
 ('frieren','linie'),
 ('alchemist','pinako'),
 ('alchemist','havoc'),
 ('alchemist','kimblee'),
 ('alchemist','buccaneer'),
 ('demon','sabito'),
 ('demon','makomo'),
 ('demon','tamayo'),
 ('demon','yushiro'),
 ('aot','hannes'),
 ('aot','kenny'),
 ('aot','petra'),
 ('aot','yelena'),
 ('naruto','naruto'),
 ('naruto','sasuke'),
 ('naruto','sakura'),
 ('naruto','kakashi'),
 ('naruto','shikamaru'),
 ('naruto','hinata'),
 ('naruto','gaara'),
 ('naruto','lee'),
 ('naruto','neji'),
 ('naruto','temari'),
 ('naruto','itachi'),
 ('naruto','pain'),
 ('naruto','konan'),
 ('naruto','deidara'),
 ('naruto','kisame'),
 ('naruto','jiraiya'),
 ('naruto','tsunade'),
 ('naruto','orochimaru'),
 ('naruto','minato'),
 ('naruto','madara'),
 ('bleach','ichigo'),
 ('bleach','rukia'),
 ('bleach','renji'),
 ('bleach','byakuya'),
 ('bleach','toshiro'),
 ('bleach','orihime'),
 ('bleach','uryu'),
 ('bleach','chad'),
 ('bleach','urahara'),
 ('bleach','yoruichi'),
 ('bleach','kenpachi'),
 ('bleach','rangiku'),
 ('bleach','soifon'),
 ('bleach','shunsui'),
 ('bleach','yamamoto'),
 ('bleach','aizen'),
 ('bleach','gin'),
 ('bleach','ulquiorra'),
 ('bleach','grimmjow'),
 ('bleach','nelliel');

create function komi_collection_private.buy_ghoul_edition(p_request_id uuid, p_catalog_edition integer)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  v_user uuid:=auth.uid();
  v_day date:=(now() at time zone 'UTC')::date;
  v_result text;
  v_balance bigint;
begin
  if v_user is null or coalesce(auth.jwt()->>'is_anonymous','false')='true'
     or not exists(select 1 from auth.users where id=v_user and deleted_at is null and is_anonymous is not true) then
    raise exception 'Authentication required' using errcode='42501';
  end if;
  if p_request_id is null then raise exception 'Request ID required' using errcode='22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('komi_collection:'||v_user::text,0));
  -- Idempotent retry must return the original reward even when collection is complete.
  select character_id into v_result from komi_collection_private.unlocks where user_id=v_user and paid_request_id=p_request_id;
  if v_result is not null then
    return komi_collection_private.action('read')||pg_catalog.jsonb_build_object('result',v_result,'purchase_status','ok');
  end if;
  if exists(select 1 from komi_collection_private.series_unlocks u where u.user_id=v_user and u.paid_request_id=p_request_id) then
    raise exception 'Request ID belongs to another series' using errcode='22023';
  end if;
  select x.character_id into v_result from komi_collection_private.ghoul_roster x
    where (p_catalog_edition >= 3 or (p_catalog_edition = 2 and exists (
      select 1 from komi_collection_private.v2_roster r where r.series_id='ghoul' and r.character_id=x.character_id
    )) or (p_catalog_edition = 1 and exists (
      select 1 from komi_collection_private.legacy_wallpaper_pool l
      where l.series_id='ghoul' and l.character_id=x.character_id
    )))
    and not exists(select 1 from komi_collection_private.unlocks u where u.user_id=v_user and u.character_id=x.character_id)
    order by pg_catalog.random() limit 1;
  if v_result is null then
    return komi_collection_private.action('read')||pg_catalog.jsonb_build_object('purchase_status','complete');
  end if;
  -- Same wallet row lock as the existing shop; no balance can go negative.
  select balance into v_balance from public.komi_anicoin_wallets where user_id=v_user for update;
  if coalesce(v_balance,0)<50 then
    return komi_collection_private.action('read')||pg_catalog.jsonb_build_object('purchase_status','insufficient');
  end if;
  update public.komi_anicoin_wallets set balance=balance-50 where user_id=v_user;
  insert into komi_collection_private.unlocks(user_id,character_id,opened_on,paid_request_id,paid_cost)
    values(v_user,v_result,v_day,p_request_id,50);
  return komi_collection_private.action('read')||pg_catalog.jsonb_build_object('result',v_result,'purchase_status','ok');
end;
$$;

revoke all on function komi_collection_private.buy_ghoul_edition(uuid, integer) from public, anon, authenticated, service_role;
grant execute on function komi_collection_private.buy_ghoul_edition(uuid, integer) to authenticated;
create or replace function komi_collection_private.buy_ghoul_pool(p_request_id uuid, p_full_pool boolean)
returns jsonb language sql security invoker set search_path=''
as $$ select komi_collection_private.buy_ghoul_edition(p_request_id, case when p_full_pool is true then 2 else 1 end) $$;
create function public.komi_collection_ghoul_buy_v3(p_request_id uuid)
returns jsonb language sql security invoker set search_path=''
as $$ select komi_collection_private.buy_ghoul_edition(p_request_id, 3) $$;
revoke all on function public.komi_collection_ghoul_buy_v3(uuid) from public, anon, authenticated, service_role;
grant execute on function public.komi_collection_ghoul_buy_v3(uuid) to authenticated;

create function komi_collection_private.series_action_edition(p_series_id text, p_request_id uuid, p_buy boolean, p_catalog_edition integer)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_price constant integer := 50;
  v_existing_series text;
  v_candidate text;
  v_result text;
  v_status text;
  v_balance bigint;
begin
  if v_user is null or coalesce(auth.jwt()->>'is_anonymous', 'false') = 'true'
     or not exists(select 1 from auth.users u where u.id = v_user and u.deleted_at is null and u.is_anonymous is not true) then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_series_id is null or not exists(
    select 1 from komi_collection_private.series_roster r where r.series_id = p_series_id
  ) then
    raise exception 'Unknown collection series' using errcode = '22023';
  end if;

  if p_buy is true then
    if p_request_id is null then
      raise exception 'Request ID required' using errcode = '22023';
    end if;
    -- Same actor lock and lock order as the original Tokyo Ghoul purchase.
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('komi_collection:' || v_user::text, 0));
    select u.series_id, u.character_id into v_existing_series, v_result
      from komi_collection_private.series_unlocks u
      where u.user_id = v_user and u.paid_request_id = p_request_id;
    if found then
      if v_existing_series is distinct from p_series_id then
        raise exception 'Request ID belongs to another series' using errcode = '22023';
      end if;
      v_status := 'ok';
    else
      if exists(select 1 from komi_collection_private.unlocks u where u.user_id=v_user and u.paid_request_id=p_request_id) then
        raise exception 'Request ID belongs to another series' using errcode='22023';
      end if;
      if p_catalog_edition = 1 and p_series_id not in ('jujutsu','frieren','alchemist') then
        raise exception 'New series requires the current purchase API' using errcode='22023';
      end if;
      -- Each still-missing entry has an equal chance. Rarity is presentation only.
      select r.character_id into v_candidate from komi_collection_private.series_roster r
        where r.series_id = p_series_id and (p_catalog_edition >= 3 or (p_catalog_edition = 2 and exists (
          select 1 from komi_collection_private.v2_roster v where v.series_id=r.series_id and v.character_id=r.character_id
        )) or (p_catalog_edition = 1 and exists (
          select 1 from komi_collection_private.legacy_wallpaper_pool l
          where l.series_id=r.series_id and l.character_id=r.character_id
        ))) and not exists (
          select 1 from komi_collection_private.series_unlocks u
          where u.user_id = v_user and u.series_id = p_series_id and u.character_id = r.character_id
        )
        order by pg_catalog.random() limit 1;
      if v_candidate is null then
        v_status := 'complete';
      else
        -- Same wallet row lock as the shop. Both changes commit or roll back together.
        select w.balance into v_balance from public.komi_anicoin_wallets w
          where w.user_id = v_user for update;
        if coalesce(v_balance, 0) < v_price then
          v_status := 'insufficient';
        else
          update public.komi_anicoin_wallets w set balance = w.balance - v_price where w.user_id = v_user;
          insert into komi_collection_private.series_unlocks (user_id, series_id, character_id, paid_request_id, paid_cost)
            values (v_user, p_series_id, v_candidate, p_request_id, v_price);
          v_result := v_candidate;
          v_status := 'ok';
        end if;
      end if;
    end if;
  end if;

  return pg_catalog.jsonb_build_object(
    'owned', coalesce((
      select pg_catalog.jsonb_agg(u.character_id order by u.created_at, u.character_id)
        from komi_collection_private.series_unlocks u where u.user_id = v_user and u.series_id = p_series_id
    ), '[]'::jsonb),
    'can_open', false,
    'next_at', null,
    'result', v_result,
    'balance', coalesce((select w.balance from public.komi_anicoin_wallets w where w.user_id = v_user), 0),
    'price', v_price,
    'purchase_status', v_status
  );
end;
$$;

revoke all on function komi_collection_private.series_action_edition(text, uuid, boolean, integer) from public, anon, authenticated, service_role;
grant execute on function komi_collection_private.series_action_edition(text, uuid, boolean, integer) to authenticated;
create or replace function komi_collection_private.series_action_pool(p_series_id text, p_request_id uuid, p_buy boolean, p_full_pool boolean)
returns jsonb language sql security invoker set search_path=''
as $$ select komi_collection_private.series_action_edition(p_series_id, p_request_id, p_buy, case when p_full_pool is true then 2 else 1 end) $$;
create function public.komi_collection_series_buy_v3(p_series_id text, p_request_id uuid)
returns jsonb language sql security invoker set search_path=''
as $$ select komi_collection_private.series_action_edition(p_series_id, p_request_id, true, 3) $$;
revoke all on function public.komi_collection_series_buy_v3(text, uuid) from public, anon, authenticated, service_role;
grant execute on function public.komi_collection_series_buy_v3(text, uuid) to authenticated;

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
    if v_series not in ('ghoul','jujutsu','frieren','alchemist','demon','aot','naruto','bleach') or v_character !~ '^[a-z]{2,32}$' then
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
  if p_series_id is null or p_series_id not in ('ghoul','jujutsu','frieren','alchemist','demon','aot','naruto','bleach') then
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
  select case when p_series_id is null or p_series_id not in ('ghoul','jujutsu','frieren','alchemist','demon','aot','naruto','bleach') then false else
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
  from (values ('ghoul',1),('jujutsu',2),('frieren',3),('alchemist',4),('demon',5),('aot',6),('naruto',7),('bleach',8)) r(series_id,position)
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
  if p_series_id is not null and p_series_id not in ('ghoul','jujutsu','frieren','alchemist','demon','aot','naruto','bleach') then
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
