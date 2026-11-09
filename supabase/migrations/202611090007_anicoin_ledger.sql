-- New rewards ledger; existing balances are unchanged, historical rewards cannot be reconstructed.
create table if not exists public.komi_anicoin_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  delta integer not null check(delta > 0),
  reason text not null check(reason = 'watch'),
  created_at timestamptz not null default now()
);
create index if not exists komi_anicoin_ledger_user on public.komi_anicoin_ledger(user_id,created_at desc);
alter table public.komi_anicoin_ledger enable row level security;
revoke all on public.komi_anicoin_ledger from public, anon, authenticated;
grant select on public.komi_anicoin_ledger to authenticated;
create policy "Users read own AniCoin history" on public.komi_anicoin_ledger
  for select to authenticated using (user_id = (select auth.uid()));

create or replace function public.komi_anicoin(p_action text, p_session uuid default null, p_seconds integer default 0, p_item text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  wallet public.komi_anicoin_wallets;
  stamp timestamptz := clock_timestamp();
  elapsed integer;
  earned_seconds integer;
  cost integer;
  coins_added integer;
begin
  if actor is null then raise exception 'Войдите в Komi'; end if;
  insert into public.komi_anicoin_wallets(user_id) values(actor) on conflict do nothing;
  select * into wallet from public.komi_anicoin_wallets where user_id = actor for update;
  if p_action = 'watch' then
    if p_session is null or p_seconds is null or p_seconds not between 0 and 20 then
      raise exception 'Некорректный интервал просмотра';
    end if;
    elapsed := floor(extract(epoch from stamp - wallet.last_pulse_at));
    if wallet.last_pulse_at is null or elapsed >= 10 then
      earned_seconds := case when wallet.player_session = p_session and elapsed between 10 and 30
        then least(elapsed, p_seconds) else 0 end;
      earned_seconds := wallet.watch_seconds + earned_seconds;
      coins_added := earned_seconds / 1200;
      update public.komi_anicoin_wallets set
        balance = balance + coins_added,
        watch_seconds = earned_seconds % 1200,
        last_pulse_at = stamp,
        player_session = p_session
      where user_id = actor returning * into wallet;
      if coins_added > 0 then
        insert into public.komi_anicoin_ledger(user_id,delta,reason)
        values(actor,coins_added,'watch');
      end if;
    end if;
  elsif p_action = 'buy' then
    raise exception 'В магазине пока нет товаров';
  elsif p_action = 'equip' then
    cost := case p_item when 'viewer' then 1 when 'explorer' then 3 when 'collector' then 5 end;
    if cost is null then raise exception 'Товар недоступен'; end if;
    if not exists (select 1 from public.komi_anicoin_purchases where user_id = actor and item_id = p_item) then
      raise exception 'Значок отсутствует в коллекции';
    end if;
    update public.komi_anicoin_wallets set equipped = p_item where user_id = actor returning * into wallet;
  elsif p_action is distinct from 'read' then
    raise exception 'Действие недоступно';
  end if;
  return jsonb_build_object(
    'balance', wallet.balance,
    'seconds', wallet.watch_seconds,
    'equipped', wallet.equipped,
    'owned', coalesce((select jsonb_agg(item_id order by item_id) from public.komi_anicoin_purchases where user_id = actor), '[]'::jsonb),
    'history', coalesce((select jsonb_agg(jsonb_build_object('delta',h.delta,'at',h.created_at) order by h.created_at desc)
        from (select delta, created_at from public.komi_anicoin_ledger where user_id = actor order by created_at desc limit 30) h), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.komi_anicoin(text,uuid,integer,text) from public, anon;
grant execute on function public.komi_anicoin(text,uuid,integer,text) to authenticated;
