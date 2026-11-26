-- Free daily Tokyo Ghoul collection; never modifies wallet, premium or inventory.
-- Keep privileged implementation in a non-exposed schema; public RPC is INVOKER.
begin;
create schema if not exists komi_collection_private;
revoke all on schema komi_collection_private from public, anon, authenticated;
grant usage on schema komi_collection_private to authenticated;
create table if not exists komi_collection_private.unlocks (
  user_id uuid not null references auth.users(id) on delete cascade,
  character_id text not null,
  opened_on date not null,
  created_at timestamptz not null default now(),
  primary key (user_id, character_id),
  unique (user_id, opened_on),
  check (character_id in ('kaneki', 'touka', 'juuzou', 'uta', 'tsukiyama', 'hide', 'rize', 'arima', 'eto', 'ayato', 'hinami', 'amon', 'nishiki', 'yomo', 'yoshimura', 'akira', 'furuta', 'takizawa'))
);
alter table komi_collection_private.unlocks enable row level security;
revoke all on komi_collection_private.unlocks from public, anon, authenticated;

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
    if not exists (select 1 from komi_collection_private.unlocks where user_id=v_user and opened_on=v_day) then
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
  select exists (select 1 from komi_collection_private.unlocks where user_id=v_user and opened_on=v_day) into v_used;
  return pg_catalog.jsonb_build_object(
    'owned',pg_catalog.to_jsonb(v_owned),
    'can_open',not v_used and pg_catalog.cardinality(v_owned)<pg_catalog.cardinality(v_ids),
    'next_at',case when v_used and pg_catalog.cardinality(v_owned)<pg_catalog.cardinality(v_ids)
      then (v_day+1)::timestamp at time zone 'UTC' else null end,
    'result',v_result
  );
end;
$$;
revoke all on function komi_collection_private.action(text) from public, anon, authenticated;
grant execute on function komi_collection_private.action(text) to authenticated;
create or replace function public.komi_collection_action(p_action text)
returns jsonb language sql security invoker set search_path = ''
as $$ select komi_collection_private.action(p_action) $$;
revoke all on function public.komi_collection_action(text) from public, anon, authenticated;
grant execute on function public.komi_collection_action(text) to authenticated;
commit;
