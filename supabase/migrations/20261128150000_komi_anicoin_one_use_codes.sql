-- Global single-use AniCoin grants. Not usable in the Premium checkout.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- Do not grant access to the existing komi_private schema. Only the guarded
-- function implementations in this new, non-exposed schema are callable.
create schema komi_anicoin_code_private;
revoke all on schema komi_anicoin_code_private from public, anon, authenticated, service_role;
grant usage on schema komi_anicoin_code_private to authenticated;

create table komi_anicoin_code_private.codes (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  code_sha256 bytea not null unique check (pg_catalog.octet_length(code_sha256) = 32),
  hint text not null check (hint ~ '^…[0-9A-F]{4}$'),
  amount integer not null check (amount between 1 and 10000),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  redeemed_by uuid references auth.users(id) on delete set null,
  redeemed_at timestamptz,
  revoked_by uuid references auth.users(id) on delete set null,
  revoked_at timestamptz,
  check (redeemed_by is null or redeemed_at is not null),
  check (revoked_by is null or revoked_at is not null),
  check (redeemed_at is null or revoked_at is null)
);
alter table komi_anicoin_code_private.codes enable row level security;
revoke all on table komi_anicoin_code_private.codes from public, anon, authenticated, service_role;
create index on komi_anicoin_code_private.codes(created_at desc, id desc);
create index on komi_anicoin_code_private.codes(created_by) where created_by is not null;
create index on komi_anicoin_code_private.codes(redeemed_by) where redeemed_by is not null;
create index on komi_anicoin_code_private.codes(revoked_by) where revoked_by is not null;

-- Preserve the complete installed reason predicate, including prior shop
-- refunds that may have been deployed outside the historical checkout file.
do $ledger$
declare
  v_predicate text;
  v_valid boolean;
begin
  lock table public.komi_anicoin_ledger in access exclusive mode;
  select pg_catalog.pg_get_expr(c.conbin,c.conrelid), c.convalidated
    into v_predicate, v_valid
  from pg_catalog.pg_constraint c
  where c.conrelid = 'public.komi_anicoin_ledger'::regclass
    and c.conname = 'komi_anicoin_ledger_reason_check' and c.contype = 'c';
  if v_predicate is null or v_valid is null then
    raise exception 'Expected the installed AniCoin ledger reason check';
  end if;
  execute pg_catalog.format(
    'alter table public.komi_anicoin_ledger drop constraint komi_anicoin_ledger_reason_check, add constraint komi_anicoin_ledger_reason_check check ((%s) or reason = %L)%s',
    v_predicate, 'promo_anicoin_code', case when v_valid then '' else ' not valid' end
  );
end;
$ledger$;

create function komi_anicoin_code_private.verified_actor(p_admin_required boolean)
returns uuid language plpgsql stable security invoker set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null or coalesce(auth.jwt()->>'is_anonymous','false') = 'true'
      or not exists (
        select 1 from auth.users u
        where u.id = v_actor and u.deleted_at is null and u.is_anonymous is not true
      ) then
    raise exception 'Verified account required' using errcode = '42501';
  end if;
  if p_admin_required and public.komi_is_admin() is distinct from true then
    raise exception 'Admin required' using errcode = '42501';
  end if;
  return v_actor;
end;
$$;
revoke all on function komi_anicoin_code_private.verified_actor(boolean)
  from public, anon, authenticated, service_role;

create function komi_anicoin_code_private.code_create(p_amount integer)
returns jsonb language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_admin uuid := komi_anicoin_code_private.verified_actor(true);
  v_hex text;
  v_code text;
  v_id uuid;
begin
  if p_amount is null or p_amount not between 1 and 10000 then
    raise exception 'AniCoin amount must be between 1 and 10000' using errcode = '22023';
  end if;
  -- Two cryptographically random v4 UUIDs give 244 random input bits.
  -- Condense to 128 bits and format as four easy-to-copy groups.
  for i in 1..4 loop
    v_hex := pg_catalog.upper(pg_catalog.substr(pg_catalog.encode(pg_catalog.sha256(
      pg_catalog.convert_to(pg_catalog.gen_random_uuid()::text || pg_catalog.gen_random_uuid()::text,'UTF8')
    ),'hex'),1,32));
    v_code := 'KOMI-AC-' || pg_catalog.substr(v_hex,1,8) || '-' || pg_catalog.substr(v_hex,9,8)
      || '-' || pg_catalog.substr(v_hex,17,8) || '-' || pg_catalog.substr(v_hex,25,8);

    insert into komi_anicoin_code_private.codes(code_sha256,hint,amount,created_by)
      values(pg_catalog.sha256(pg_catalog.convert_to(v_code,'UTF8')),
             '…' || pg_catalog.right(v_code,4),p_amount,v_admin)
      on conflict(code_sha256) do nothing returning id into v_id;
    if found then
      -- The full value is returned once and never persisted or listed.
      return pg_catalog.jsonb_build_object('id',v_id,'code',v_code,'amount',p_amount,'status','active');
    end if;
  end loop;
  raise exception 'Could not issue a unique AniCoin code';
end;
$$;

create function komi_anicoin_code_private.code_list()
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
begin
  perform komi_anicoin_code_private.verified_actor(true);
  return coalesce((
    select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'id',c.id,'hint',c.hint,'amount',c.amount,
      'status',case when c.redeemed_at is not null then 'redeemed'
                    when c.revoked_at is not null then 'revoked' else 'active' end,
      'created_at',c.created_at,'redeemed_at',c.redeemed_at
    ) order by c.created_at desc, c.id desc)
    from komi_anicoin_code_private.codes c
  ),'[]'::jsonb);
end;
$$;

create function komi_anicoin_code_private.code_revoke(p_id uuid)
returns jsonb language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_admin uuid := komi_anicoin_code_private.verified_actor(true);
  v_row komi_anicoin_code_private.codes%rowtype;
begin
  select * into v_row from komi_anicoin_code_private.codes c
    where c.id = p_id for update;
  if not found then return '{"status":"unavailable"}'::jsonb; end if;
  if v_row.redeemed_at is not null then return '{"status":"redeemed"}'::jsonb; end if;
  if v_row.revoked_at is null then
    update komi_anicoin_code_private.codes set revoked_at=pg_catalog.clock_timestamp(),revoked_by=v_admin
      where id = v_row.id;
  end if;
  return '{"status":"revoked"}'::jsonb;
end;
$$;

create function komi_anicoin_code_private.code_redeem(p_code text)
returns jsonb language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_actor uuid := komi_anicoin_code_private.verified_actor(false);
  v_code text;
  v_row komi_anicoin_code_private.codes%rowtype;
  v_balance bigint;
  v_stamp timestamptz;
begin
  if p_code is null or pg_catalog.octet_length(p_code) > 80 then
    return '{"status":"invalid"}'::jsonb;
  end if;
  v_code := pg_catalog.upper(pg_catalog.btrim(p_code,E' \t\r\n') collate pg_catalog."C");
  if v_code !~ '^KOMI-AC-[0-9A-F]{8}-[0-9A-F]{8}-[0-9A-F]{8}-[0-9A-F]{8}$' then
    return '{"status":"invalid"}'::jsonb;
  end if;

  -- The code row is always locked before touching any wallet. A waiting
  -- redemption or revocation sees the winner's committed state, not a stale one.
  select * into v_row from komi_anicoin_code_private.codes c
    where c.code_sha256 = pg_catalog.sha256(pg_catalog.convert_to(v_code,'UTF8'))
    for update;
  if not found or v_row.revoked_at is not null
      or (v_row.redeemed_at is not null and v_row.redeemed_by is distinct from v_actor) then
    return '{"status":"unavailable"}'::jsonb;
  end if;
  if v_row.redeemed_at is not null then
    select w.balance into v_balance from public.komi_anicoin_wallets w where w.user_id = v_actor;
    return pg_catalog.jsonb_build_object('status','already_redeemed','amount',v_row.amount,
                                        'balance',coalesce(v_balance,0));
  end if;

  v_stamp := pg_catalog.clock_timestamp();
  update komi_anicoin_code_private.codes
    set redeemed_by=v_actor,redeemed_at=v_stamp where id=v_row.id;
  insert into public.komi_anicoin_wallets as w(user_id,balance) values(v_actor,v_row.amount)
    on conflict(user_id) do update set balance=w.balance + excluded.balance
    returning balance into v_balance;
  insert into public.komi_anicoin_ledger(user_id,delta,reason,created_at)
    values(v_actor,v_row.amount,'promo_anicoin_code',v_stamp);
  return pg_catalog.jsonb_build_object('status','redeemed','amount',v_row.amount,'balance',v_balance);
end;
$$;

revoke all on function komi_anicoin_code_private.code_create(integer),
  komi_anicoin_code_private.code_list(),komi_anicoin_code_private.code_revoke(uuid),
  komi_anicoin_code_private.code_redeem(text) from public, anon, authenticated, service_role;
grant execute on function komi_anicoin_code_private.code_create(integer),
  komi_anicoin_code_private.code_list(),komi_anicoin_code_private.code_revoke(uuid),
  komi_anicoin_code_private.code_redeem(text) to authenticated;

create function public.komi_admin_anicoin_code_create(p_amount integer)
returns jsonb language sql volatile security invoker set search_path=''
as $$ select komi_anicoin_code_private.code_create(p_amount) $$;

create function public.komi_admin_anicoin_code_list()
returns jsonb language sql stable security invoker set search_path=''
as $$ select komi_anicoin_code_private.code_list() $$;

create function public.komi_admin_anicoin_code_revoke(p_id uuid)
returns jsonb language sql volatile security invoker set search_path=''
as $$ select komi_anicoin_code_private.code_revoke(p_id) $$;

create function public.komi_redeem_anicoin_code(p_code text)
returns jsonb language sql volatile security invoker set search_path=''
as $$ select komi_anicoin_code_private.code_redeem(p_code) $$;

revoke all on function public.komi_admin_anicoin_code_create(integer),
  public.komi_admin_anicoin_code_list(),public.komi_admin_anicoin_code_revoke(uuid),
  public.komi_redeem_anicoin_code(text) from public, anon, authenticated, service_role;
grant execute on function public.komi_admin_anicoin_code_create(integer),
  public.komi_admin_anicoin_code_list(),public.komi_admin_anicoin_code_revoke(uuid),
  public.komi_redeem_anicoin_code(text) to authenticated;
commit;
