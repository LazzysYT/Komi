-- Retire four arrival cosmetics, preserving existing purchases and balances.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
lock table komi_private.premium_store_purchases in access exclusive mode;
do $$ begin
 if exists(select 1 from komi_private.premium_store_purchases where item_id in ('entry_moonrise','entry_neon_gate','party_comet','party_portal')) then
  raise exception 'Retirement refused: a purchase exists; refund review required';
 end if;
end $$;
-- A check prevents in-flight calls that already cached a price from inserting a purchase.
alter table komi_private.premium_store_purchases add constraint premium_store_purchases_no_arrival_fx check(item_id not in ('entry_moonrise','entry_neon_gate','party_comet','party_portal'));
delete from komi_private.shop_item_prices where item_id in ('entry_moonrise','entry_neon_gate','party_comet','party_portal');
-- No equipment should be present without a purchase. Clear any stale cosmetic pointers.
update public.komi_premium_cosmetic_equips set entry_id=null,party_id=null where entry_id is not null or party_id is not null;
commit;
