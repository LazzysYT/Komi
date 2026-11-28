-- Extend the roster while preserving older draw pools and completed rewards.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

lock table komi_collection_private.unlocks, komi_collection_private.series_unlocks
  in share row exclusive mode;

alter table komi_collection_private.pack_rarity
  add column catalog_version smallint not null default 1 check (catalog_version in (1,2));
alter table komi_collection_private.pack_offers
  add column catalog_version smallint not null default 1 check (catalog_version in (1,2));

create table komi_collection_private.world_art_previous_completion (
  user_id uuid not null references auth.users(id) on delete cascade,
  series_id text not null,
  primary key (user_id,series_id)
);
alter table komi_collection_private.world_art_previous_completion enable row level security;
revoke all on komi_collection_private.world_art_previous_completion from public,anon,authenticated,service_role;

insert into komi_collection_private.world_art_previous_completion (user_id,series_id)
select u.user_id,u.series_id
from (
  select user_id,'ghoul'::text as series_id,character_id from komi_collection_private.unlocks
  union all
  select user_id,series_id,character_id from komi_collection_private.series_unlocks
) u join komi_collection_private.pack_rarity r using(series_id,character_id)
group by u.user_id,u.series_id
having count(*)=(select count(*) from komi_collection_private.pack_rarity r where r.series_id=u.series_id);

insert into komi_collection_private.pack_rarity (series_id,character_id,rarity,catalog_version) values
  ('ghoul','kanou','rare',2),
  ('ghoul','shinohara','epic',2),
  ('jujutsu','hakari','epic',2),
  ('jujutsu','takaba','rare',2),
  ('frieren','kraft','epic',2),
  ('frieren','genau','rare',2),
  ('alchemist','trisha','rare',2),
  ('alchemist','sigcurtis','rare',2),
  ('demon','yahaba','rare',2),
  ('demon','susamaru','rare',2),
  ('aot','pyxis','epic',2),
  ('aot','marco','rare',2),
  ('naruto','shino','rare',2),
  ('naruto','kiba','rare',2),
  ('bleach','unohana','legendary',2),
  ('bleach','ikkaku','epic',2),
  ('onepiece','perona','epic',2),
  ('onepiece','kuzan','legendary',2),
  ('chainsaw','sawatari','epic',2),
  ('chainsaw','tendo','rare',2),
  ('hunter','alluka','epic',2),
  ('hunter','kalluto','rare',2);

insert into komi_collection_private.ghoul_roster (character_id)
select character_id from komi_collection_private.pack_rarity where series_id='ghoul' and catalog_version=2;
insert into komi_collection_private.series_roster (series_id,character_id)
select series_id,character_id from komi_collection_private.pack_rarity where series_id<>'ghoul' and catalog_version=2;

-- Older clients only draw from their published roster. Existing receipts are read first.

create or replace function komi_collection_private.buy_ghoul_edition(p_request_id uuid, p_catalog_edition integer)
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
    where (p_catalog_edition >= 3 and exists (
      select 1 from komi_collection_private.pack_rarity r
      where r.series_id='ghoul' and r.character_id=x.character_id and r.catalog_version=1
    ) or (p_catalog_edition = 2 and exists (
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

create or replace function komi_collection_private.series_action_edition(p_series_id text, p_request_id uuid, p_buy boolean, p_catalog_edition integer)
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
        where r.series_id = p_series_id and (p_catalog_edition >= 3 and exists (
          select 1 from komi_collection_private.pack_rarity v
          where v.series_id=r.series_id and v.character_id=r.character_id and v.catalog_version=1
        ) or (p_catalog_edition = 2 and exists (
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
    or (
      exists(select 1 from komi_collection_private.world_art_previous_completion e
             where e.user_id=p_user_id and e.series_id=p_series_id)
      and not exists (
        select 1 from komi_collection_private.pack_rarity r
        where r.series_id=p_series_id and r.catalog_version=1
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

create function komi_collection_private.pick_pack_for_catalog(p_series_id text, p_offer_id uuid, p_slot integer, p_catalog_version integer)
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
  if p_catalog_version is null or p_catalog_version not in (1,2) then
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
  if not exists(select 1 from komi_collection_private.pack_rarity where series_id=v_series) then
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

create or replace function komi_collection_private.pick_pack(p_series_id text, p_offer_id uuid, p_slot integer)
returns jsonb language sql volatile security definer set search_path = ''
as $$ select komi_collection_private.pick_pack_for_catalog(p_series_id,p_offer_id,p_slot,1) $$;

create function public.komi_collection_pack_open_v2(p_series_id text,p_offer_id uuid default null)
returns jsonb language sql volatile security invoker set search_path = ''
as $$ select komi_collection_private.pick_pack_for_catalog(p_series_id,p_offer_id,null,2) $$;

create function public.komi_collection_pack_claim_v2(p_offer_id uuid,p_slot integer)
returns jsonb language sql volatile security invoker set search_path = ''
as $$ select komi_collection_private.pick_pack_for_catalog(null,p_offer_id,p_slot,2) $$;

revoke all on function komi_collection_private.pick_pack_for_catalog(text,uuid,integer,integer),
  public.komi_collection_pack_open_v2(text,uuid),public.komi_collection_pack_claim_v2(uuid,integer)
  from public,anon,authenticated,service_role;
grant execute on function komi_collection_private.pick_pack_for_catalog(text,uuid,integer,integer),
  public.komi_collection_pack_open_v2(text,uuid),public.komi_collection_pack_claim_v2(uuid,integer)
  to authenticated;

commit;
