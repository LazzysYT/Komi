-- Komi Shop v6. Forward-only catalogue prices and cosmetic eligibility.
-- Existing wallet balances, purchase prices and ownership records are not rewritten.
-- The REST-visible revision is enabled in the same transaction as the price cut.
begin;
set local lock_timeout = '5s';

insert into komi_private.shop_item_prices(item_id,cost,giftable) values
('frame_moon',20,true),
('frame_aurora',25,true),
('frame_noir',20,true),
('frame_silver',35,true),
('frame_frost',35,true),
('frame_neon',50,true),
('frame_orbit',55,true),
('frame_eclipse',65,true),
('frame_prism',75,true),
('frame_royal',95,true),
('frame_pixel',25,true),
('frame_halo',85,true),
('title_cinema',10,true),
('title_starlight',15,true),
('title_collector',20,true),
('title_otaku',25,true),
('title_explorer',30,true),
('title_nocturne',35,true),
('title_legend',60,true),
('title_archivist',40,true),
('title_marathon',45,true),
('title_curator',50,true),
('title_cosmic',65,true),
('title_veteran',85,true),
('banner_noir',25,true),
('banner_stars',30,true),
('banner_grid',35,true),
('banner_moon',40,true),
('banner_aurora',50,true),
('banner_frost',55,true),
('banner_glitch',60,true),
('banner_eclipse',80,true),
('overlay_sakura',40,true),
('overlay_rain',50,true),
('overlay_film',25,true),
('overlay_sparks',55,true),
('overlay_snow',40,true),
('overlay_dust',70,true),
('showcase_film',60,true),
('showcase_gloss',70,true),
('showcase_neon',90,true),
('card_graphite',50,true),
('card_frost',65,true),
('card_aurora',80,true),
('card_glass',85,true),
('icon_headphones',20,true),
('icon_ramen',25,true),
('icon_cassette',30,true),
('icon_crown',75,true),
('icon_katana',55,true),
('icon_comet',45,true),
('reaction_hype',40,true),
('reaction_soft',35,true),
('reaction_cinema',50,true),
('frame_sumi',55,true),
('frame_film35',55,true),
('frame_glitch',70,true),
('frame_glass',80,true),
('frame_sakura',85,true),
('frame_slash',65,true),
('frame_shogun',120,true),
('shape_cyber',35,true),
('shape_octagon',40,true),
('shape_diamond',45,true),
('shape_drop',50,true),
('plate_manga',40,true),
('plate_seigaiha',55,true),
('plate_rain',45,true),
('plate_gradient',70,true),
('mascot_cat',55,true),
('mascot_lantern',65,true),
('mascot_spirit',85,true),
('xp_silver',55,true),
('xp_hatch',35,true),
('xp_beam',70,true),
('xp_dots',35,true),
('name_silver',70,true),
('name_ghost',60,true),
('name_dawn',85,true),
('name_chrome',95,true),
('title_ongoing',40,true),
('title_nightmarathon',50,true),
('title_critic',55,true),
('title_spoiler',60,true),
('title_pioneer',90,true),
('frame_matte',15,true),
('frame_anamorphic',50,true),
('title_titres',10,true),
('title_doublefeature',25,true),
('banner_projection',30,true),
('icon_ticket',15,true),
('plate_subtitle',20,true),
('xp_perforation',35,true)
on conflict(item_id) do update set cost=excluded.cost;

-- Validate the known item IDs without broadening a constraint to arbitrary IDs.
-- Frames and titles include items previously sold but omitted from equip CHECKs.


alter table komi_private.premium_store_purchases
  drop constraint if exists premium_store_purchases_item_id_check,
  add constraint premium_store_purchases_item_id_check
  check (item_id in (
    'frame_moon','frame_aurora','frame_noir','frame_silver','frame_frost',
    'frame_neon','frame_orbit','frame_eclipse','frame_prism','frame_royal',
    'frame_pixel','frame_halo','title_cinema','title_starlight','title_collector',
    'title_otaku','title_explorer','title_nocturne','title_legend','title_archivist',
    'title_marathon','title_curator','title_cosmic','title_veteran','banner_noir',
    'banner_stars','banner_grid','banner_moon','banner_aurora','banner_frost',
    'banner_glitch','banner_eclipse','overlay_sakura','overlay_rain','overlay_film',
    'overlay_sparks','overlay_snow','overlay_dust','showcase_film','showcase_gloss',
    'showcase_neon','card_graphite','card_frost','card_aurora','card_glass',
    'icon_headphones','icon_ramen','icon_cassette','icon_crown','icon_katana',
    'icon_comet','reaction_hype','reaction_soft','reaction_cinema','frame_sumi',
    'frame_film35','frame_glitch','frame_glass','frame_sakura','frame_slash',
    'frame_shogun','shape_cyber','shape_octagon','shape_diamond','shape_drop',
    'plate_manga','plate_seigaiha','plate_rain','plate_gradient','mascot_cat',
    'mascot_lantern','mascot_spirit','xp_silver','xp_hatch','xp_beam',
    'xp_dots','name_silver','name_ghost','name_dawn','name_chrome',
    'title_ongoing','title_nightmarathon','title_critic','title_spoiler','title_pioneer',
    'frame_matte','frame_anamorphic','title_titres','title_doublefeature','banner_projection',
    'icon_ticket','plate_subtitle','xp_perforation'
  ));

alter table public.komi_premium_cosmetic_equips
  drop constraint if exists komi_premium_cosmetic_equips_frame_id_check,
  add constraint komi_premium_cosmetic_equips_frame_id_check
  check (frame_id is null or frame_id in (
    'frame_moon','frame_aurora','frame_noir','frame_silver','frame_frost',
    'frame_neon','frame_orbit','frame_eclipse','frame_prism','frame_royal',
    'frame_pixel','frame_halo','frame_sumi','frame_film35','frame_glitch',
    'frame_glass','frame_sakura','frame_slash','frame_shogun','frame_matte',
    'frame_anamorphic'
  ));

alter table public.komi_premium_cosmetic_equips
  drop constraint if exists komi_premium_cosmetic_equips_title_id_check,
  add constraint komi_premium_cosmetic_equips_title_id_check
  check (title_id is null or title_id in (
    'title_cinema','title_starlight','title_collector','title_otaku','title_explorer',
    'title_nocturne','title_legend','title_archivist','title_marathon','title_curator',
    'title_cosmic','title_veteran','title_ongoing','title_nightmarathon','title_critic',
    'title_spoiler','title_pioneer','title_titres','title_doublefeature'
  ));

alter table public.komi_premium_cosmetic_equips
  drop constraint if exists komi_premium_cosmetic_equips_banner_id_check,
  add constraint komi_premium_cosmetic_equips_banner_id_check
  check (banner_id is null or banner_id in (
    'banner_noir','banner_stars','banner_grid','banner_moon','banner_aurora',
    'banner_frost','banner_glitch','banner_eclipse','banner_projection'
  ));

alter table public.komi_premium_cosmetic_equips
  drop constraint if exists komi_premium_cosmetic_equips_icon_id_check,
  add constraint komi_premium_cosmetic_equips_icon_id_check
  check (icon_id is null or icon_id in (
    'icon_headphones','icon_ramen','icon_cassette','icon_crown','icon_katana',
    'icon_comet','icon_ticket'
  ));

alter table public.komi_premium_cosmetic_equips
  drop constraint if exists komi_premium_cosmetic_equips_plate_id_check,
  add constraint komi_premium_cosmetic_equips_plate_id_check
  check (plate_id is null or plate_id in (
    'plate_manga','plate_seigaiha','plate_rain','plate_gradient','plate_subtitle'
  ));

alter table public.komi_premium_cosmetic_equips
  drop constraint if exists komi_premium_cosmetic_equips_xp_id_check,
  add constraint komi_premium_cosmetic_equips_xp_id_check
  check (xp_id is null or xp_id in (
    'xp_silver','xp_hatch','xp_beam','xp_dots','xp_perforation'
  ));

-- Returns a public build marker only, without accessing tables or bypassing RLS.
create function public.komi_shop_catalog_revision()
returns text language sql immutable security invoker set search_path = ''
as $revision$ select '20261125-shop-v6'::text $revision$;
revoke all on function public.komi_shop_catalog_revision() from public, anon, authenticated;
grant execute on function public.komi_shop_catalog_revision() to authenticated;

commit;
