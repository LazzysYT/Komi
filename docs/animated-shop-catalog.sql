-- CANDIDATE ONLY. Do not execute on production without staging verification.
-- Generate a tracked migration with the Supabase CLI before release.
-- Existing prices, purchase records, retired-item rules and RLS remain unchanged.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
do $extend$
declare r record; previous_check text; previous_valid boolean; already_extended boolean;
begin
  if public.komi_shop_living_revision() is distinct from '20261126-living-profile' then
    raise exception 'Living profile catalog revision required';
  end if;
  for r in select * from (values
    ('komi_private.premium_store_purchases'::regclass,'premium_store_purchases_item_id_check','item_id',array['frame_black_flame','frame_sakura_drift','frame_kakugan','frame_cursed_energy','frame_solar_eclipse','frame_ghost_butterflies','frame_eternal_winter','frame_dragon_spirit','frame_fractured_reality','frame_abyss','frame_shadow_monarch','frame_water_breath','banner_blood_moon','name_glitch_motion','name_crimson_reflection','name_infinity_light','name_shadow_glow','name_wave_glimmer','title_one_eyed_king','title_shadow_sovereign']),
    ('public.komi_premium_cosmetic_equips'::regclass,'komi_premium_cosmetic_equips_frame_id_check','frame_id',array['frame_black_flame','frame_sakura_drift','frame_kakugan','frame_cursed_energy','frame_solar_eclipse','frame_ghost_butterflies','frame_eternal_winter','frame_dragon_spirit','frame_fractured_reality','frame_abyss','frame_shadow_monarch','frame_water_breath']),
    ('public.komi_premium_cosmetic_equips'::regclass,'komi_premium_cosmetic_equips_name_id_check','name_id',array['name_glitch_motion','name_crimson_reflection','name_infinity_light','name_shadow_glow','name_wave_glimmer']),
    ('public.komi_premium_cosmetic_equips'::regclass,'komi_premium_cosmetic_equips_banner_id_check','banner_id',array['banner_blood_moon']),
    ('public.komi_premium_cosmetic_equips'::regclass,'komi_premium_cosmetic_equips_title_id_check','title_id',array['title_one_eyed_king','title_shadow_sovereign'])
  ) as slots(rel,check_name,field,new_ids) loop
    execute format('lock table %s in access exclusive mode',r.rel);
    select pg_get_expr(c.conbin,c.conrelid),c.convalidated
      into previous_check,previous_valid
      from pg_constraint c where c.conrelid=r.rel and c.conname=r.check_name and c.contype='c';
    if previous_check is null or previous_valid is not true then
      raise exception 'Missing or invalid constraint: %',r.check_name;
    end if;
    select bool_and(strpos(previous_check,quote_literal(item))>0) into already_extended from unnest(r.new_ids) as ids(item);
    if not already_extended then
      execute format('alter table %s drop constraint %I, add constraint %I check ((%s) or %I = any (%L::text[]))',
        r.rel,r.check_name,r.check_name,previous_check,r.field,r.new_ids);
    end if;
  end loop;
end;
$extend$;
insert into komi_private.shop_item_prices(item_id,cost,giftable) values
  ('frame_black_flame',35,false),
  ('frame_sakura_drift',20,false),
  ('frame_kakugan',40,false),
  ('frame_cursed_energy',35,false),
  ('frame_solar_eclipse',30,false),
  ('frame_ghost_butterflies',25,false),
  ('frame_eternal_winter',25,false),
  ('frame_dragon_spirit',75,false),
  ('frame_fractured_reality',45,false),
  ('frame_abyss',55,false),
  ('frame_shadow_monarch',40,false),
  ('frame_water_breath',30,false),
  ('banner_blood_moon',35,false),
  ('name_glitch_motion',15,false),
  ('name_crimson_reflection',15,false),
  ('name_infinity_light',15,false),
  ('name_shadow_glow',15,false),
  ('name_wave_glimmer',15,false),
  ('title_one_eyed_king',15,false),
  ('title_shadow_sovereign',20,false)
on conflict(item_id) do nothing;
do $verify$
begin
  if exists(select 1 from (values
  ('frame_black_flame',35,false),
  ('frame_sakura_drift',20,false),
  ('frame_kakugan',40,false),
  ('frame_cursed_energy',35,false),
  ('frame_solar_eclipse',30,false),
  ('frame_ghost_butterflies',25,false),
  ('frame_eternal_winter',25,false),
  ('frame_dragon_spirit',75,false),
  ('frame_fractured_reality',45,false),
  ('frame_abyss',55,false),
  ('frame_shadow_monarch',40,false),
  ('frame_water_breath',30,false),
  ('banner_blood_moon',35,false),
  ('name_glitch_motion',15,false),
  ('name_crimson_reflection',15,false),
  ('name_infinity_light',15,false),
  ('name_shadow_glow',15,false),
  ('name_wave_glimmer',15,false),
  ('title_one_eyed_king',15,false),
  ('title_shadow_sovereign',20,false)
  ) expected(item_id,cost,giftable) left join komi_private.shop_item_prices actual using(item_id)
  where actual.cost is distinct from expected.cost or actual.giftable is distinct from expected.giftable) then
    raise exception 'Animated cosmetic price or gift-policy mismatch';
  end if;
end;
$verify$;
create or replace function public.komi_shop_animated_revision()
returns text language sql immutable security invoker set search_path=''
as $revision$ select '20261127-animated-shop'::text $revision$;
revoke all on function public.komi_shop_animated_revision() from public,anon,authenticated;
grant execute on function public.komi_shop_animated_revision() to authenticated;
commit;
