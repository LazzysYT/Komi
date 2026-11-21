-- AniCoin visual collections: deterministic permanent cosmetics, no paid random rewards.
begin;
-- Existing 54 purchases are preserved; all catalog prices stay privately server-owned.
insert into komi_private.shop_item_prices(item_id,cost,giftable) values
('frame_moon',30,true),
('frame_aurora',45,true),
('frame_noir',35,true),
('frame_silver',55,true),
('frame_frost',60,true),
('frame_neon',80,true),
('frame_orbit',95,true),
('frame_eclipse',110,true),
('frame_prism',125,true),
('frame_royal',160,true),
('frame_pixel',40,true),
('frame_halo',140,true),
('title_cinema',20,true),
('title_starlight',25,true),
('title_collector',35,true),
('title_otaku',40,true),
('title_explorer',50,true),
('title_nocturne',60,true),
('title_legend',100,true),
('title_archivist',65,true),
('title_marathon',75,true),
('title_curator',85,true),
('title_cosmic',110,true),
('title_veteran',140,true),
('banner_noir',40,true),
('banner_stars',50,true),
('banner_grid',55,true),
('banner_moon',65,true),
('banner_aurora',80,true),
('banner_frost',90,true),
('banner_glitch',100,true),
('banner_eclipse',130,true),
('overlay_sakura',65,true),
('overlay_rain',85,true),
('overlay_film',45,true),
('overlay_sparks',95,true),
('overlay_snow',70,true),
('overlay_dust',120,true),
('showcase_film',100,true),
('showcase_gloss',115,true),
('showcase_neon',150,true),
('card_graphite',80,true),
('card_frost',110,true),
('card_aurora',130,true),
('card_glass',140,true),
('icon_headphones',35,true),
('icon_ramen',40,true),
('icon_cassette',50,true),
('icon_crown',125,true),
('icon_katana',95,true),
('icon_comet',75,true),
('reaction_hype',70,true),
('reaction_soft',60,true),
('reaction_cinema',85,true),
('frame_sumi',95,true),
('frame_film35',90,true),
('frame_glitch',115,true),
('frame_glass',130,true),
('frame_sakura',140,true),
('frame_slash',105,true),
('frame_shogun',200,true),
('shape_cyber',60,true),
('shape_octagon',70,true),
('shape_diamond',75,true),
('shape_drop',80,true),
('plate_manga',65,true),
('plate_seigaiha',90,true),
('plate_rain',75,true),
('plate_gradient',120,true),
('mascot_cat',95,true),
('mascot_lantern',110,true),
('mascot_spirit',140,true),
('xp_silver',90,true),
('xp_hatch',55,true),
('xp_beam',120,true),
('xp_dots',60,true),
('name_silver',120,true),
('name_ghost',100,true),
('name_dawn',145,true),
('name_chrome',155,true),
('title_ongoing',70,true),
('title_nightmarathon',80,true),
('title_critic',95,true),
('title_spoiler',100,true),
('title_pioneer',150,true)
on conflict(item_id) do update set cost=excluded.cost;
alter table komi_private.premium_store_purchases drop constraint if exists premium_store_purchases_item_id_check;
alter table komi_private.premium_store_purchases add constraint premium_store_purchases_item_id_check
 check(item_id in ('frame_moon','frame_aurora','frame_noir','frame_silver','frame_frost','frame_neon','frame_orbit','frame_eclipse','frame_prism','frame_royal','frame_pixel','frame_halo','title_cinema','title_starlight','title_collector','title_otaku','title_explorer','title_nocturne','title_legend','title_archivist','title_marathon','title_curator','title_cosmic','title_veteran','banner_noir','banner_stars','banner_grid','banner_moon','banner_aurora','banner_frost','banner_glitch','banner_eclipse','overlay_sakura','overlay_rain','overlay_film','overlay_sparks','overlay_snow','overlay_dust','showcase_film','showcase_gloss','showcase_neon','card_graphite','card_frost','card_aurora','card_glass','icon_headphones','icon_ramen','icon_cassette','icon_crown','icon_katana','icon_comet','reaction_hype','reaction_soft','reaction_cinema','frame_sumi','frame_film35','frame_glitch','frame_glass','frame_sakura','frame_slash','frame_shogun','shape_cyber','shape_octagon','shape_diamond','shape_drop','plate_manga','plate_seigaiha','plate_rain','plate_gradient','mascot_cat','mascot_lantern','mascot_spirit','xp_silver','xp_hatch','xp_beam','xp_dots','name_silver','name_ghost','name_dawn','name_chrome','title_ongoing','title_nightmarathon','title_critic','title_spoiler','title_pioneer'));
alter table public.komi_premium_cosmetic_equips add column if not exists shape_id text;
alter table public.komi_premium_cosmetic_equips add constraint komi_premium_cosmetic_equips_shape_id_check
 check(shape_id is null or shape_id in ('shape_cyber','shape_octagon','shape_diamond','shape_drop'));
alter table public.komi_premium_cosmetic_equips add column if not exists plate_id text;
alter table public.komi_premium_cosmetic_equips add constraint komi_premium_cosmetic_equips_plate_id_check
 check(plate_id is null or plate_id in ('plate_manga','plate_seigaiha','plate_rain','plate_gradient'));
alter table public.komi_premium_cosmetic_equips add column if not exists mascot_id text;
alter table public.komi_premium_cosmetic_equips add constraint komi_premium_cosmetic_equips_mascot_id_check
 check(mascot_id is null or mascot_id in ('mascot_cat','mascot_lantern','mascot_spirit'));
alter table public.komi_premium_cosmetic_equips add column if not exists xp_id text;
alter table public.komi_premium_cosmetic_equips add constraint komi_premium_cosmetic_equips_xp_id_check
 check(xp_id is null or xp_id in ('xp_silver','xp_hatch','xp_beam','xp_dots'));
alter table public.komi_premium_cosmetic_equips add column if not exists name_id text;
alter table public.komi_premium_cosmetic_equips add constraint komi_premium_cosmetic_equips_name_id_check
 check(name_id is null or name_id in ('name_silver','name_ghost','name_dawn','name_chrome'));
-- Individual columns exposed read-only through existing owner/public display RLS policy.
grant select(user_id,frame_id,title_id,banner_id,overlay_id,showcase_id,card_id,icon_id,shape_id,plate_id,mascot_id,xp_id,name_id)
on public.komi_premium_cosmetic_equips to anon,authenticated;
-- Keep auth/ownership/atomic wallet locks of original server store, with prices sourced from the private allowlist.
create or replace function public.komi_premium_store(
 p_action text default 'read',p_item text default null
) returns jsonb language plpgsql security definer set search_path=''
as $fn$
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
   else raise exception 'Unknown item category' using errcode='22023'; end if;
 end if;
 select coalesce(jsonb_agg(p.item_id order by p.item_id),'[]'::jsonb) into owned
 from komi_private.premium_store_purchases p where p.user_id=actor;
 select * into equip from public.komi_premium_cosmetic_equips where user_id=actor;
 return jsonb_build_object('balance',wallet.balance,'owned',coalesce(owned,'[]'::jsonb),
  'frame_id',equip.frame_id,'title_id',equip.title_id,'banner_id',equip.banner_id,
  'overlay_id',equip.overlay_id,'showcase_id',equip.showcase_id,
  'card_id',equip.card_id,'icon_id',equip.icon_id,'shape_id',equip.shape_id,'plate_id',equip.plate_id,'mascot_id',equip.mascot_id,'xp_id',equip.xp_id,'name_id',equip.name_id);
end $fn$;


-- Extend the verified daily quest claim path, preserving idempotency and premium XP.

revoke all on function public.komi_premium_store(text,text) from public,anon,authenticated;
grant execute on function public.komi_premium_store(text,text) to authenticated;
commit;
