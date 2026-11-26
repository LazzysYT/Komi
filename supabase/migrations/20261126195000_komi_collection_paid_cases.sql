-- Paid Tokyo Ghoul case: fixed 50 earned AniCoin, guaranteed new character.
-- Existing free daily openings and wallet history are retained.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
alter table komi_collection_private.unlocks add column if not exists paid_request_id uuid;
alter table komi_collection_private.unlocks add column if not exists paid_cost integer not null default 0;
alter table komi_collection_private.unlocks add constraint collection_paid_cost_check
  check ((paid_request_id is null and paid_cost=0) or (paid_request_id is not null and paid_cost=50));
alter table komi_collection_private.unlocks drop constraint if exists unlocks_user_id_opened_on_key;
create unique index if not exists collection_free_daily_uidx on komi_collection_private.unlocks(user_id,opened_on) where paid_request_id is null;
create unique index if not exists collection_paid_request_uidx on komi_collection_private.unlocks(user_id,paid_request_id) where paid_request_id is not null;
create or replace function komi_collection_private.action(p_action text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_day date := (now() at time zone 'UTC')::date;
  v_ids constant text[] := array['kaneki', 'touka', 'juuzou', 'uta', 'tsukiyama', 'hide', 'rize', 'arima', 'eto', 'ayato', 'hinami', 'amon', 'nishiki', 'yomo', 'yoshimura', 'akira', 'furuta', 'takizawa'];
  v_owned text[];
  v_result text;
  v_used boolean;
begin
  if v_user is null or coalesce(auth.jwt()->>'is_anonymous','false') = 'true' then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_action is null or p_action not in ('read','open') then
    raise exception 'Invalid collection action' using errcode = '22023';
  end if;
  if p_action = 'open' then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('komi_collection:' || v_user::text, 0));
    if not exists (select 1 from komi_collection_private.unlocks where user_id=v_user and opened_on=v_day and paid_request_id is null) then
      select x.id into v_result from pg_catalog.unnest(v_ids) as x(id)
      where not exists (select 1 from komi_collection_private.unlocks u where u.user_id=v_user and u.character_id=x.id)
      order by pg_catalog.random() limit 1;
      if v_result is not null then
        insert into komi_collection_private.unlocks(user_id,character_id,opened_on) values(v_user,v_result,v_day);
      end if;
    end if;
  end if;
  select coalesce(pg_catalog.array_agg(character_id order by created_at,character_id),array[]::text[])
    into v_owned from komi_collection_private.unlocks where user_id=v_user;
  select exists (select 1 from komi_collection_private.unlocks where user_id=v_user and opened_on=v_day and paid_request_id is null) into v_used;
  return pg_catalog.jsonb_build_object(
    'owned',pg_catalog.to_jsonb(v_owned),
    'can_open',not v_used and pg_catalog.cardinality(v_owned)<pg_catalog.cardinality(v_ids),
    'next_at',case when v_used and pg_catalog.cardinality(v_owned)<pg_catalog.cardinality(v_ids)
      then (v_day+1)::timestamp at time zone 'UTC' else null end,
    'result',v_result,
    'balance',coalesce((select w.balance from public.komi_anicoin_wallets w where w.user_id=v_user),0),
    'price',50
  );
end;
$$;

create or replace function komi_collection_private.buy(p_request_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  v_user uuid:=auth.uid();
  v_day date:=(now() at time zone 'UTC')::date;
  v_ids constant text[]:=array['kaneki','touka','juuzou','uta','tsukiyama','hide','rize','arima','eto','ayato','hinami','amon','nishiki','yomo','yoshimura','akira','furuta','takizawa'];
  v_result text;
  v_balance bigint;
  v_status text:='ok';
begin
  if v_user is null or coalesce(auth.jwt()->>'is_anonymous','false')='true'
     or not exists(select 1 from auth.users where id=v_user and is_anonymous is not true) then
    raise exception 'Authentication required' using errcode='42501';
  end if;
  if p_request_id is null then raise exception 'Request ID required' using errcode='22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('komi_collection:'||v_user::text,0));
  -- Idempotent retry must return the original reward even when collection is complete.
  select character_id into v_result from komi_collection_private.unlocks where user_id=v_user and paid_request_id=p_request_id;
  if v_result is not null then
    return komi_collection_private.action('read')||pg_catalog.jsonb_build_object('result',v_result,'purchase_status','ok');
  end if;
  select x.id into v_result from pg_catalog.unnest(v_ids) x(id)
    where not exists(select 1 from komi_collection_private.unlocks u where u.user_id=v_user and u.character_id=x.id)
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
revoke all on function komi_collection_private.buy(uuid) from public,anon,authenticated;
grant execute on function komi_collection_private.buy(uuid) to authenticated;
create or replace function public.komi_collection_buy(p_request_id uuid)
returns jsonb language sql security invoker set search_path=''
as $$ select komi_collection_private.buy(p_request_id) $$;
revoke all on function public.komi_collection_buy(uuid) from public,anon,authenticated;
grant execute on function public.komi_collection_buy(uuid) to authenticated;
commit;
