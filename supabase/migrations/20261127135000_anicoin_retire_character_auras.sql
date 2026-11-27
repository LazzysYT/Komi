-- Remove two collection auras from sale, preserving any prior ownership.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

lock table komi_private.premium_store_purchases in share row exclusive mode;

-- Backstop checkout requests that had already looked up an old price.
-- An existing owner's cart can still equip without charging or inserting.
create function komi_private.block_retired_aura_purchase()
returns trigger language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1 from komi_private.premium_store_purchases p
    where p.user_id = new.user_id and p.item_id = new.item_id
  ) then
    raise exception 'This AniCoin item is no longer for sale' using errcode = '22023';
  end if;
  return new;
end;
$$;
revoke all on function komi_private.block_retired_aura_purchase() from public, anon, authenticated;

create trigger block_retired_aura_purchase
before insert on komi_private.premium_store_purchases
for each row when (new.item_id in ('aura_crimson','aura_starlight'))
execute function komi_private.block_retired_aura_purchase();

-- Old equip RPCs expect a price record even if an owned item costs nothing to equip.
delete from komi_private.shop_item_prices s
where s.item_id in ('aura_crimson','aura_starlight')
  and not exists (select 1 from komi_private.premium_store_purchases p where p.item_id = s.item_id);
commit;
