-- Three paid booster series. The existing Tokyo Ghoul schema and RPCs stay untouched.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create table komi_collection_private.series_roster (
  series_id text not null check (series_id in ('jujutsu','frieren','alchemist')),
  character_id text not null,
  primary key (series_id, character_id)
);
alter table komi_collection_private.series_roster enable row level security;
revoke all on komi_collection_private.series_roster from public, anon, authenticated, service_role;
insert into komi_collection_private.series_roster (series_id, character_id) values
  ('jujutsu','itadori'), ('jujutsu','fushiguro'), ('jujutsu','kugisaki'), ('jujutsu','gojo'), ('jujutsu','sukuna'),
  ('frieren','frieren'), ('frieren','fern'), ('frieren','stark'), ('frieren','himmel'), ('frieren','heiter'),
  ('alchemist','edward'), ('alchemist','alphonse'), ('alchemist','winry'), ('alchemist','roy'), ('alchemist','riza'),
  ('jujutsu','maki'), ('jujutsu','toge'), ('jujutsu','panda'), ('jujutsu','nanami'), ('jujutsu','yuta'),
  ('frieren','eisen'), ('frieren','flamme'), ('frieren','serie'), ('frieren','denken'), ('frieren','ubel'),
  ('alchemist','alex'), ('alchemist','maes'), ('alchemist','scar'), ('alchemist','olivier'), ('alchemist','lanfan');

create table komi_collection_private.series_unlocks (
  user_id uuid not null references auth.users(id) on delete cascade,
  series_id text not null,
  character_id text not null,
  paid_request_id uuid not null,
  paid_cost integer not null default 50 check (paid_cost = 50),
  created_at timestamptz not null default pg_catalog.now(),
  primary key (user_id, series_id, character_id),
  unique (user_id, paid_request_id),
  foreign key (series_id, character_id) references komi_collection_private.series_roster(series_id, character_id)
);
alter table komi_collection_private.series_unlocks enable row level security;
revoke all on komi_collection_private.series_unlocks from public, anon, authenticated, service_role;

-- The wallet and unlock tables are private. Public wrappers run as INVOKER;
-- only this helper runs with elevated rights, in the existing non-exposed schema.
create function komi_collection_private.series_action(p_series_id text, p_request_id uuid, p_buy boolean)
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
     or not exists(select 1 from auth.users u where u.id = v_user and u.is_anonymous is not true) then
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
      -- Each still-missing entry has an equal chance. Rarity is presentation only.
      select r.character_id into v_candidate from komi_collection_private.series_roster r
        where r.series_id = p_series_id and not exists (
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
revoke all on function komi_collection_private.series_action(text, uuid, boolean) from public, anon, authenticated, service_role;
grant execute on function komi_collection_private.series_action(text, uuid, boolean) to authenticated;

create function public.komi_collection_series_read(p_series_id text)
returns jsonb language sql security invoker set search_path = ''
as $$ select komi_collection_private.series_action(p_series_id, null, false) $$;

create function public.komi_collection_series_buy(p_series_id text, p_request_id uuid)
returns jsonb language sql security invoker set search_path = ''
as $$ select komi_collection_private.series_action(p_series_id, p_request_id, true) $$;

revoke all on function public.komi_collection_series_read(text) from public, anon, authenticated, service_role;
revoke all on function public.komi_collection_series_buy(text, uuid) from public, anon, authenticated, service_role;
grant execute on function public.komi_collection_series_read(text) to authenticated;
grant execute on function public.komi_collection_series_buy(text, uuid) to authenticated;
commit;
