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
      update public.komi_anicoin_wallets set
        balance = balance + earned_seconds / 1200,
        watch_seconds = earned_seconds % 1200,
        last_pulse_at = stamp,
        player_session = p_session
      where user_id = actor returning * into wallet;
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
    'owned', coalesce((select jsonb_agg(item_id order by item_id) from public.komi_anicoin_purchases where user_id = actor), '[]'::jsonb)
  );
end;
$$;
