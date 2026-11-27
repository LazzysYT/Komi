-- CANDIDATE: apply only after disposable database verification and review.
-- Preserve all old equipment and purchase records, including retired banners.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
do $extend$
declare r record; previous_check text; previous_valid boolean; already_extended boolean;
begin
  if public.komi_shop_animated_revision() is distinct from '20261127-animated-shop' then raise exception 'Animated catalog prerequisite missing'; end if;
  for r in select * from (values
    ('komi_private.premium_store_purchases'::regclass,'premium_store_purchases_item_id_check','item_id',array['frame_silver_bloom','frame_crimson_sakura','frame_neon_rift','frame_lunar_crescent','frame_obsidian_crown','frame_spirit_kitsune']),
    ('public.komi_premium_cosmetic_equips'::regclass,'komi_premium_cosmetic_equips_frame_id_check','frame_id',array['frame_silver_bloom','frame_crimson_sakura','frame_neon_rift','frame_lunar_crescent','frame_obsidian_crown','frame_spirit_kitsune'])
  ) as slots(rel,check_name,field,new_ids) loop
    execute format('lock table %s in access exclusive mode',r.rel);
    select pg_get_expr(c.conbin,c.conrelid),c.convalidated into previous_check,previous_valid
      from pg_constraint c where c.conrelid=r.rel and c.conname=r.check_name and c.contype='c';
    if previous_check is null or previous_valid is not true then raise exception 'Missing or invalid constraint: %',r.check_name; end if;
    select bool_and(strpos(previous_check,quote_literal(item))>0) into already_extended from unnest(r.new_ids) as ids(item);
    if not already_extended then
      execute format('alter table %s drop constraint %I, add constraint %I check ((%s) or %I = any (%L::text[]))',r.rel,r.check_name,r.check_name,previous_check,r.field,r.new_ids);
    end if;
  end loop;
end;
$extend$;
insert into komi_private.shop_item_prices(item_id,cost,giftable) values
  ('frame_silver_bloom',25,false),
  ('frame_crimson_sakura',30,false),
  ('frame_neon_rift',35,false),
  ('frame_lunar_crescent',40,false),
  ('frame_obsidian_crown',55,false),
  ('frame_spirit_kitsune',45,false)
on conflict(item_id) do nothing;
do $$ begin
 if exists (select 1 from (values ('frame_silver_bloom',25,false),('frame_crimson_sakura',30,false),('frame_neon_rift',35,false),('frame_lunar_crescent',40,false),('frame_obsidian_crown',55,false),('frame_spirit_kitsune',45,false)) expected(item_id,cost,giftable)
  left join komi_private.shop_item_prices actual using(item_id)
  where actual.cost is distinct from expected.cost or actual.giftable is distinct from expected.giftable) then
  raise exception 'Frame Atelier price mismatch'; end if;
end $$;
-- A before-insert guard also rejects stale carts and direct gift/buy RPCs.
create or replace function komi_private.block_retired_banner_purchase()
returns trigger language plpgsql set search_path='' as $$
begin
 if not exists(select 1 from komi_private.premium_store_purchases p where p.user_id=new.user_id and p.item_id=new.item_id) then
  raise exception 'This profile cover is no longer for sale' using errcode='22023';
 end if;
 return new;
end $$;
revoke all on function komi_private.block_retired_banner_purchase() from public,anon,authenticated;
drop trigger if exists block_retired_banner_purchase on komi_private.premium_store_purchases;
create trigger block_retired_banner_purchase before insert on komi_private.premium_store_purchases
for each row when (split_part(new.item_id,'_',1)='banner') execute function komi_private.block_retired_banner_purchase();
-- Retain historical price rows (also referenced by gift receipts), but prohibit new gifts.
update komi_private.shop_item_prices set giftable=false where split_part(item_id,'_',1)='banner' and giftable;
create or replace function public.komi_shop_frame_atelier_revision() returns text
language sql immutable set search_path='' as $$ select '20261127-frame-atelier-v2'::text $$;
revoke all on function public.komi_shop_frame_atelier_revision() from public,anon,authenticated;
grant execute on function public.komi_shop_frame_atelier_revision() to anon,authenticated;
commit;
