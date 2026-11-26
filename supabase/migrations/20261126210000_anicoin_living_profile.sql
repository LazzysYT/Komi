-- Four new directly purchasable cosmetic IDs. No prior item is restored or repriced.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $extend$
declare
  r record;
  previous_check text;
  previous_valid boolean;
  already_extended boolean;
begin
  if public.komi_shop_cast_revision() is distinct from '20261126-anime-cast' then
    raise exception 'Living profile shop requires character-title catalog';
  end if;

  -- Keep the complete installed predicate instead of rebuilding the ID lists.
  -- The separate no-retired-items constraint is never altered.
  for r in select * from (values
    ('komi_private.premium_store_purchases'::regclass, 'premium_store_purchases_item_id_check',
      'item_id', array['frame_ghoul_seal','name_mangaka_ink','xp_story_rhythm','showcase_personal_cinema']),
    ('public.komi_premium_cosmetic_equips'::regclass, 'komi_premium_cosmetic_equips_frame_id_check','frame_id',array['frame_ghoul_seal']),
    ('public.komi_premium_cosmetic_equips'::regclass, 'komi_premium_cosmetic_equips_name_id_check','name_id',array['name_mangaka_ink']),
    ('public.komi_premium_cosmetic_equips'::regclass, 'komi_premium_cosmetic_equips_xp_id_check','xp_id',array['xp_story_rhythm']),
    ('public.komi_premium_cosmetic_equips'::regclass, 'komi_premium_cosmetic_equips_showcase_id_check','showcase_id',array['showcase_personal_cinema'])
  ) as slots(rel,check_name,field,new_ids)
  loop
    execute format('lock table %s in access exclusive mode',r.rel);
    select pg_get_expr(c.conbin,c.conrelid),c.convalidated
    into previous_check,previous_valid
    from pg_constraint c
    where c.conrelid=r.rel and c.conname=r.check_name and c.contype='c';
    if previous_check is null or previous_valid is not true then
      raise exception 'Missing or invalid shop ID check: %',r.check_name;
    end if;
    select bool_and(strpos(previous_check,quote_literal(item)) > 0)
    into already_extended from unnest(r.new_ids) as ids(item);
    if not already_extended then
      execute format('alter table %s drop constraint %I, add constraint %I check ((%s) or %I = any (%L::text[]))',
        r.rel,r.check_name,r.check_name,previous_check,r.field,r.new_ids);
    end if;
  end loop;
end;
$extend$;

insert into komi_private.shop_item_prices (item_id,cost,giftable) values
  ('frame_ghoul_seal',30,false),
  ('name_mangaka_ink',25,false),
  ('xp_story_rhythm',25,false),
  ('showcase_personal_cinema',40,false)
on conflict (item_id) do nothing;

do $verify$
begin
  if exists (
    select 1 from (values
  ('frame_ghoul_seal',30,false),
  ('name_mangaka_ink',25,false),
  ('xp_story_rhythm',25,false),
  ('showcase_personal_cinema',40,false)
    ) expected(item_id,cost,giftable)
    left join komi_private.shop_item_prices actual using(item_id)
    where actual.cost is distinct from expected.cost or actual.giftable is distinct from expected.giftable
  ) then
    raise exception 'Living profile item price or gift policy mismatch';
  end if;
end;
$verify$;

create or replace function public.komi_shop_living_revision()
returns text language sql immutable security invoker set search_path=''
as $revision$ select '20261126-living-profile'::text $revision$;
revoke all on function public.komi_shop_living_revision() from public,anon,authenticated;
grant execute on function public.komi_shop_living_revision() to authenticated;
commit;
