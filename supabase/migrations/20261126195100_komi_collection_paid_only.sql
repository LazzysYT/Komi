begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
-- Stop free grants while retaining all historical characters and purchases.
create or replace function komi_collection_private.action(p_action text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  v_user uuid:=auth.uid();
  v_owned text[];
begin
  if v_user is null or coalesce(auth.jwt()->>'is_anonymous','false')='true'
     or not exists(select 1 from auth.users where id=v_user and is_anonymous is not true) then
    raise exception 'Authentication required' using errcode='42501';
  end if;
  if p_action is distinct from 'read' then
    raise exception 'Cases are available only for 50 AniCoin' using errcode='22023';
  end if;
  select coalesce(pg_catalog.array_agg(character_id order by created_at,character_id),array[]::text[])
    into v_owned from komi_collection_private.unlocks where user_id=v_user;
  return pg_catalog.jsonb_build_object(
    'owned',pg_catalog.to_jsonb(v_owned),'can_open',false,'next_at',null,'result',null,
    'balance',coalesce((select w.balance from public.komi_anicoin_wallets w where w.user_id=v_user),0),
    'price',50);
end;
$$;
revoke all on function komi_collection_private.action(text) from public,anon,authenticated;
grant execute on function komi_collection_private.action(text) to authenticated;
revoke all on function public.komi_collection_action(text) from public,anon,authenticated;
grant execute on function public.komi_collection_action(text) to authenticated;
commit;
