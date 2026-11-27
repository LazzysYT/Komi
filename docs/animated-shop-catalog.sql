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
    ('komi_private.premium_store_purchases'::regclass,'premium_store_purchases_item_id_check','item_id',array['frame_black_flame','frame_sakura_drift','frame_kakugan','frame_cursed_energy','frame_solar_eclipse','frame_ghost_butterflies','frame_eternal_winter','frame_dragon_spirit','frame_fractured_reality','frame_abyss','frame_shadow_monarch','frame_water_breath','banner_blood_moon','name_glitch_motion','name_crimson_reflection','name_infinity_light','name_shadow_glow','name_wave_glimmer','title_one_eyed_king','title_shadow_sovereign','entry_moonrise','entry_neon_gate','aura_crimson','aura_starlight','commentfx_hype','commentfx_heart','party_comet','party_portal']),
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
  ('title_shadow_sovereign',20,false),
  ('entry_moonrise',20,false),
  ('entry_neon_gate',30,false),
  ('aura_crimson',25,false),
  ('aura_starlight',35,false),
  ('commentfx_hype',15,false),
  ('commentfx_heart',15,false),
  ('party_comet',20,false),
  ('party_portal',30,false)
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
  ('title_shadow_sovereign',20,false),
  ('entry_moonrise',20,false),
  ('entry_neon_gate',30,false),
  ('aura_crimson',25,false),
  ('aura_starlight',35,false),
  ('commentfx_hype',15,false),
  ('commentfx_heart',15,false),
  ('party_comet',20,false),
  ('party_portal',30,false)
  ) expected(item_id,cost,giftable) left join komi_private.shop_item_prices actual using(item_id)
  where actual.cost is distinct from expected.cost or actual.giftable is distinct from expected.giftable) then
    raise exception 'Animated cosmetic price or gift-policy mismatch';
  end if;
end;
$verify$;
-- New independent equipment slots; existing RLS is unchanged.
alter table public.komi_premium_cosmetic_equips add column if not exists entry_id text check (entry_id is null or entry_id=any(array['entry_moonrise','entry_neon_gate']));
alter table public.komi_premium_cosmetic_equips add column if not exists aura_id text check (aura_id is null or aura_id=any(array['aura_crimson','aura_starlight']));
alter table public.komi_premium_cosmetic_equips add column if not exists commentfx_id text check (commentfx_id is null or commentfx_id=any(array['commentfx_hype','commentfx_heart']));
alter table public.komi_premium_cosmetic_equips add column if not exists party_id text check (party_id is null or party_id=any(array['party_comet','party_portal']));
grant select(entry_id,aura_id,commentfx_id,party_id) on public.komi_premium_cosmetic_equips to anon,authenticated;
CREATE OR REPLACE FUNCTION public.komi_premium_store(p_action text DEFAULT 'read'::text, p_item text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 actor uuid:=auth.uid();
 cost integer;
 kind text;
 wallet public.komi_anicoin_wallets%rowtype;
 owned jsonb;
 equip public.komi_premium_cosmetic_equips%rowtype;
begin
 if actor is null or not exists(select 1 from auth.users u
  where u.id=actor and u.deleted_at is null and u.is_anonymous is not true)
 then raise exception 'Verified account required' using errcode='42501'; end if;
 if p_action is null or p_action not in ('read','buy','buy_equip','equip','unequip')
 then raise exception 'Unsupported store action' using errcode='22023'; end if;
 select p.cost into cost from komi_private.shop_item_prices p where p.item_id=p_item;
 if p_action<>'read' and cost is null
 then raise exception 'Unknown AniCoin item' using errcode='22023'; end if;
 kind:=split_part(coalesce(p_item,''),'_',1);
 insert into public.komi_anicoin_wallets(user_id) values(actor) on conflict do nothing;
 select * into wallet from public.komi_anicoin_wallets where user_id=actor for update;
 if p_action in ('buy','buy_equip') then
   if exists(select 1 from komi_private.premium_store_purchases p where p.user_id=actor and p.item_id=p_item)
   then raise exception 'Item already purchased' using errcode='22023'; end if;
   if wallet.balance<cost then raise exception 'Not enough AniCoin' using errcode='22023'; end if;
   insert into komi_private.premium_store_purchases(user_id,item_id,price) values(actor,p_item,cost);
   update public.komi_anicoin_wallets set balance=balance-cost where user_id=actor returning * into wallet;
 end if;
 if p_action='equip' then
   if not exists(select 1 from komi_private.premium_store_purchases p where p.user_id=actor and p.item_id=p_item)
   then raise exception 'Purchase required before equipping' using errcode='42501'; end if;
 end if;
 if p_action in ('equip','buy_equip') then
   insert into public.komi_premium_cosmetic_equips(user_id) values(actor) on conflict do nothing;
   if kind='frame' then update public.komi_premium_cosmetic_equips set frame_id=p_item,updated_at=now() where user_id=actor;
   elsif kind='title' then update public.komi_premium_cosmetic_equips set title_id=p_item,updated_at=now() where user_id=actor;
   elsif kind='banner' then update public.komi_premium_cosmetic_equips set banner_id=p_item,updated_at=now() where user_id=actor;
   elsif kind='overlay' then update public.komi_premium_cosmetic_equips set overlay_id=p_item,updated_at=now() where user_id=actor;
   elsif kind='showcase' then update public.komi_premium_cosmetic_equips set showcase_id=p_item,updated_at=now() where user_id=actor;
   elsif kind='card' then update public.komi_premium_cosmetic_equips set card_id=p_item,updated_at=now() where user_id=actor;
   elsif kind='icon' then update public.komi_premium_cosmetic_equips set icon_id=p_item,updated_at=now() where user_id=actor;
   elsif kind='shape' then update public.komi_premium_cosmetic_equips set shape_id=p_item,updated_at=now() where user_id=actor;
   elsif kind='plate' then update public.komi_premium_cosmetic_equips set plate_id=p_item,updated_at=now() where user_id=actor;
   elsif kind='mascot' then update public.komi_premium_cosmetic_equips set mascot_id=p_item,updated_at=now() where user_id=actor;
   elsif kind='xp' then update public.komi_premium_cosmetic_equips set xp_id=p_item,updated_at=now() where user_id=actor;
   elsif kind='name' then update public.komi_premium_cosmetic_equips set name_id=p_item,updated_at=now() where user_id=actor;
   elsif kind='entry' then update public.komi_premium_cosmetic_equips set entry_id=p_item,updated_at=now() where user_id=actor;
   elsif kind='aura' then update public.komi_premium_cosmetic_equips set aura_id=p_item,updated_at=now() where user_id=actor;
   elsif kind='commentfx' then update public.komi_premium_cosmetic_equips set commentfx_id=p_item,updated_at=now() where user_id=actor;
   elsif kind='party' then update public.komi_premium_cosmetic_equips set party_id=p_item,updated_at=now() where user_id=actor;
   else raise exception 'Unknown item category' using errcode='22023'; end if;
 elsif p_action='unequip' then
   if kind='frame' then update public.komi_premium_cosmetic_equips set frame_id=null,updated_at=now() where user_id=actor and frame_id=p_item;
   elsif kind='title' then update public.komi_premium_cosmetic_equips set title_id=null,updated_at=now() where user_id=actor and title_id=p_item;
   elsif kind='banner' then update public.komi_premium_cosmetic_equips set banner_id=null,updated_at=now() where user_id=actor and banner_id=p_item;
   elsif kind='overlay' then update public.komi_premium_cosmetic_equips set overlay_id=null,updated_at=now() where user_id=actor and overlay_id=p_item;
   elsif kind='showcase' then update public.komi_premium_cosmetic_equips set showcase_id=null,updated_at=now() where user_id=actor and showcase_id=p_item;
   elsif kind='card' then update public.komi_premium_cosmetic_equips set card_id=null,updated_at=now() where user_id=actor and card_id=p_item;
   elsif kind='icon' then update public.komi_premium_cosmetic_equips set icon_id=null,updated_at=now() where user_id=actor and icon_id=p_item;
   elsif kind='shape' then update public.komi_premium_cosmetic_equips set shape_id=null,updated_at=now() where user_id=actor and shape_id=p_item;
   elsif kind='plate' then update public.komi_premium_cosmetic_equips set plate_id=null,updated_at=now() where user_id=actor and plate_id=p_item;
   elsif kind='mascot' then update public.komi_premium_cosmetic_equips set mascot_id=null,updated_at=now() where user_id=actor and mascot_id=p_item;
   elsif kind='xp' then update public.komi_premium_cosmetic_equips set xp_id=null,updated_at=now() where user_id=actor and xp_id=p_item;
   elsif kind='name' then update public.komi_premium_cosmetic_equips set name_id=null,updated_at=now() where user_id=actor and name_id=p_item;
   elsif kind='entry' then update public.komi_premium_cosmetic_equips set entry_id=null,updated_at=now() where user_id=actor and entry_id=p_item;
   elsif kind='aura' then update public.komi_premium_cosmetic_equips set aura_id=null,updated_at=now() where user_id=actor and aura_id=p_item;
   elsif kind='commentfx' then update public.komi_premium_cosmetic_equips set commentfx_id=null,updated_at=now() where user_id=actor and commentfx_id=p_item;
   elsif kind='party' then update public.komi_premium_cosmetic_equips set party_id=null,updated_at=now() where user_id=actor and party_id=p_item;
   else raise exception 'Unknown item category' using errcode='22023'; end if;
 end if;
 select coalesce(jsonb_agg(p.item_id order by p.item_id),'[]'::jsonb) into owned
 from komi_private.premium_store_purchases p where p.user_id=actor;
 select * into equip from public.komi_premium_cosmetic_equips where user_id=actor;
 return jsonb_build_object('balance',wallet.balance,'owned',coalesce(owned,'[]'::jsonb),
  'frame_id',equip.frame_id,'title_id',equip.title_id,'banner_id',equip.banner_id,
  'overlay_id',equip.overlay_id,'showcase_id',equip.showcase_id,
  'card_id',equip.card_id,'icon_id',equip.icon_id,'shape_id',equip.shape_id,'plate_id',equip.plate_id,'mascot_id',equip.mascot_id,'xp_id',equip.xp_id,'name_id',equip.name_id,'entry_id',equip.entry_id,'aura_id',equip.aura_id,'commentfx_id',equip.commentfx_id,'party_id',equip.party_id);
end $function$;
CREATE OR REPLACE FUNCTION public.komi_shop_cart_buy_equip(p_items text[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 v_user uuid:=auth.uid();
 v_id text;
 v_kind text;
 v_kinds text[]:=array[]::text[];
 v_price integer;
 v_total integer:=0;
 v_spent integer:=0;
 v_inserted integer:=0;
 v_item_count integer:=coalesce(cardinality(p_items),0);
 v_owned boolean;
 v_wallet public.komi_anicoin_wallets%rowtype;
 v_equips public.komi_premium_cosmetic_equips%rowtype;
 v_inventory jsonb;
begin
 if v_user is null or not exists(
   select 1 from auth.users u where u.id=v_user
   and u.deleted_at is null and u.is_anonymous is not true
 ) then raise exception 'Verified account required' using errcode='42501'; end if;
 if v_item_count<1 or v_item_count>12 then
   raise exception 'Choose between 1 and 12 cosmetic items' using errcode='22023';
 end if;
 insert into public.komi_anicoin_wallets(user_id) values(v_user) on conflict do nothing;
 select * into v_wallet from public.komi_anicoin_wallets
   where user_id=v_user for update;
 -- Validate the full cart before spending or equipping anything.
 foreach v_id in array p_items loop
   if v_id is null then raise exception 'Invalid item' using errcode='22023'; end if;
   v_kind:=split_part(v_id,'_',1);
   if v_kind not in ('frame','title','banner','overlay','showcase','card',
                     'icon','shape','plate','mascot','xp','name','entry','aura','commentfx','party')
      or v_kind=any(v_kinds)
   then raise exception 'Only one cosmetic from each category is allowed' using errcode='22023'; end if;
   v_kinds:=array_append(v_kinds,v_kind);
   select cost into v_price from komi_private.shop_item_prices where item_id=v_id;
   if v_price is null then raise exception 'Unknown catalog item' using errcode='22023'; end if;
   select exists(select 1 from komi_private.premium_store_purchases
       where user_id=v_user and item_id=v_id) into v_owned;
   if not v_owned then v_total:=v_total+v_price; end if;
 end loop;
 if v_wallet.balance<v_total then
   raise exception 'Not enough AniCoin' using errcode='22023';
 end if;
 insert into public.komi_premium_cosmetic_equips(user_id) values(v_user) on conflict do nothing;
 foreach v_id in array p_items loop
   v_kind:=split_part(v_id,'_',1);
   select cost into v_price from komi_private.shop_item_prices where item_id=v_id;
   insert into komi_private.premium_store_purchases(user_id,item_id,price)
      values(v_user,v_id,v_price) on conflict(user_id,item_id) do nothing;
   get diagnostics v_inserted = row_count;
   if v_inserted=1 then v_spent:=v_spent+v_price; end if;
   if v_kind='frame' then update public.komi_premium_cosmetic_equips set frame_id=v_id,updated_at=now() where user_id=v_user;
   elsif v_kind='title' then update public.komi_premium_cosmetic_equips set title_id=v_id,updated_at=now() where user_id=v_user;
   elsif v_kind='banner' then update public.komi_premium_cosmetic_equips set banner_id=v_id,updated_at=now() where user_id=v_user;
   elsif v_kind='overlay' then update public.komi_premium_cosmetic_equips set overlay_id=v_id,updated_at=now() where user_id=v_user;
   elsif v_kind='showcase' then update public.komi_premium_cosmetic_equips set showcase_id=v_id,updated_at=now() where user_id=v_user;
   elsif v_kind='card' then update public.komi_premium_cosmetic_equips set card_id=v_id,updated_at=now() where user_id=v_user;
   elsif v_kind='icon' then update public.komi_premium_cosmetic_equips set icon_id=v_id,updated_at=now() where user_id=v_user;
   elsif v_kind='shape' then update public.komi_premium_cosmetic_equips set shape_id=v_id,updated_at=now() where user_id=v_user;
   elsif v_kind='plate' then update public.komi_premium_cosmetic_equips set plate_id=v_id,updated_at=now() where user_id=v_user;
   elsif v_kind='mascot' then update public.komi_premium_cosmetic_equips set mascot_id=v_id,updated_at=now() where user_id=v_user;
   elsif v_kind='xp' then update public.komi_premium_cosmetic_equips set xp_id=v_id,updated_at=now() where user_id=v_user;
   elsif v_kind='name' then update public.komi_premium_cosmetic_equips set name_id=v_id,updated_at=now() where user_id=v_user;
   elsif v_kind='entry' then update public.komi_premium_cosmetic_equips set entry_id=v_id,updated_at=now() where user_id=v_user;
   elsif v_kind='aura' then update public.komi_premium_cosmetic_equips set aura_id=v_id,updated_at=now() where user_id=v_user;
   elsif v_kind='commentfx' then update public.komi_premium_cosmetic_equips set commentfx_id=v_id,updated_at=now() where user_id=v_user;
   elsif v_kind='party' then update public.komi_premium_cosmetic_equips set party_id=v_id,updated_at=now() where user_id=v_user;
   end if;
 end loop;
 update public.komi_anicoin_wallets set balance=balance-v_spent
    where user_id=v_user returning * into v_wallet;
 select * into v_equips from public.komi_premium_cosmetic_equips where user_id=v_user;
 select coalesce(jsonb_agg(item_id order by item_id),'[]'::jsonb) into v_inventory
    from komi_private.premium_store_purchases where user_id=v_user;
 return jsonb_build_object('balance',v_wallet.balance,'spent',v_spent,
    'owned',v_inventory,
    'frame_id',v_equips.frame_id,'title_id',v_equips.title_id,'banner_id',v_equips.banner_id,
    'overlay_id',v_equips.overlay_id,'showcase_id',v_equips.showcase_id,
    'card_id',v_equips.card_id,'icon_id',v_equips.icon_id,
    'shape_id',v_equips.shape_id,'plate_id',v_equips.plate_id,
    'mascot_id',v_equips.mascot_id,'xp_id',v_equips.xp_id,'name_id',v_equips.name_id,'entry_id',v_equips.entry_id,'aura_id',v_equips.aura_id,'commentfx_id',v_equips.commentfx_id,'party_id',v_equips.party_id);
end $function$;
revoke all on function public.komi_premium_store(text,text) from public,anon,authenticated;
grant execute on function public.komi_premium_store(text,text) to authenticated;
revoke all on function public.komi_shop_cart_buy_equip(text[]) from public,anon,authenticated;
grant execute on function public.komi_shop_cart_buy_equip(text[]) to authenticated;
create table if not exists public.komi_comment_animated_reactions (
 comment_id bigint not null references public.komi_comments(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 effect_id text not null check (effect_id in ('commentfx_hype','commentfx_heart')),
 primary key(comment_id,user_id)
);
create index if not exists komi_comment_animated_reactions_user_idx on public.komi_comment_animated_reactions(user_id);
alter table public.komi_comment_animated_reactions enable row level security;
revoke all on public.komi_comment_animated_reactions from public,anon,authenticated;
grant select on public.komi_comment_animated_reactions to anon,authenticated;
grant insert(comment_id,user_id,effect_id),update(effect_id),delete on public.komi_comment_animated_reactions to authenticated;
create policy animated_reactions_read on public.komi_comment_animated_reactions for select to anon,authenticated using (true);
create policy animated_reactions_insert on public.komi_comment_animated_reactions for insert to authenticated with check ((select auth.uid())=user_id and exists(select 1 from public.komi_premium_cosmetic_equips e where e.user_id=(select auth.uid()) and e.commentfx_id=effect_id));
create policy animated_reactions_update on public.komi_comment_animated_reactions for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id and exists(select 1 from public.komi_premium_cosmetic_equips e where e.user_id=(select auth.uid()) and e.commentfx_id=effect_id));
create policy animated_reactions_delete on public.komi_comment_animated_reactions for delete to authenticated using ((select auth.uid())=user_id);
create or replace function public.komi_shop_animated_revision()
returns text language sql immutable security invoker set search_path=''
as $revision$ select '20261127-animated-shop'::text $revision$;
revoke all on function public.komi_shop_animated_revision() from public,anon,authenticated;
grant execute on function public.komi_shop_animated_revision() to anon,authenticated;
commit;
