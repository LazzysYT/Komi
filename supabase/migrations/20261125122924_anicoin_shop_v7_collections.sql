-- Komi Shop V7: 48 permanent cosmetics across six themed collections.
-- Existing item prices, wallets, ownership and purchase history are unchanged.
-- The existing authenticated store and cart RPCs keep owning all purchases.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

insert into komi_private.shop_item_prices(item_id,cost,giftable) values
('frame_velvet',35,true),
('banner_citylight',45,true),
('title_midnight',15,true),
('name_moonstone',60,true),
('shape_arch',25,true),
('plate_window',35,true),
('overlay_fireflies',55,true),
('icon_moonrise',20,true),
('frame_ink',40,true),
('banner_panels',40,true),
('title_pagekeeper',15,true),
('name_inklight',45,true),
('shape_stamp',30,true),
('plate_speech',30,true),
('xp_panels',35,true),
('icon_inkpen',15,true),
('frame_scanline',55,true),
('banner_synthwave',60,true),
('title_playerone',20,true),
('name_pixelbeam',65,true),
('shape_pixelcut',35,true),
('plate_terminal',40,true),
('xp_combo',45,true),
('overlay_datastream',60,true),
('frame_constellation',65,true),
('banner_orbit',60,true),
('title_stargazer',25,true),
('name_stardust',70,true),
('shape_comet',40,true),
('plate_constellation',45,true),
('xp_constellation',45,true),
('overlay_meteor',70,true),
('frame_aperture',45,true),
('banner_silverscreen',35,true),
('title_lastrow',10,true),
('frame_letterbox',40,true),
('banner_contactsheet',45,true),
('title_director',25,true),
('xp_cue',35,true),
('icon_clapper',20,true),
('frame_ivy',50,true),
('banner_botanical',50,true),
('title_gardenkeeper',15,true),
('frame_dewdrop',60,true),
('banner_petal',55,true),
('title_bloom',20,true),
('overlay_pollen',50,true),
('icon_leaf',15,true)
on conflict(item_id) do update set cost=excluded.cost;

-- Expand only explicit allowlists. All previous item IDs remain valid.
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
    'icon_ticket','plate_subtitle','xp_perforation','frame_velvet','banner_citylight',
    'title_midnight','name_moonstone','shape_arch','plate_window','overlay_fireflies',
    'icon_moonrise','frame_ink','banner_panels','title_pagekeeper','name_inklight',
    'shape_stamp','plate_speech','xp_panels','icon_inkpen','frame_scanline',
    'banner_synthwave','title_playerone','name_pixelbeam','shape_pixelcut','plate_terminal',
    'xp_combo','overlay_datastream','frame_constellation','banner_orbit','title_stargazer',
    'name_stardust','shape_comet','plate_constellation','xp_constellation','overlay_meteor',
    'frame_aperture','banner_silverscreen','title_lastrow','frame_letterbox','banner_contactsheet',
    'title_director','xp_cue','icon_clapper','frame_ivy','banner_botanical',
    'title_gardenkeeper','frame_dewdrop','banner_petal','title_bloom','overlay_pollen',
    'icon_leaf'
  ));

alter table public.komi_premium_cosmetic_equips
  drop constraint if exists komi_premium_cosmetic_equips_frame_id_check,
  add constraint komi_premium_cosmetic_equips_frame_id_check
  check (frame_id is null or frame_id in (
    'frame_moon','frame_aurora','frame_noir','frame_silver','frame_frost',
    'frame_neon','frame_orbit','frame_eclipse','frame_prism','frame_royal',
    'frame_pixel','frame_halo','frame_sumi','frame_film35','frame_glitch',
    'frame_glass','frame_sakura','frame_slash','frame_shogun','frame_matte',
    'frame_anamorphic','frame_velvet','frame_ink','frame_scanline','frame_constellation',
    'frame_aperture','frame_letterbox','frame_ivy','frame_dewdrop'
  ));

alter table public.komi_premium_cosmetic_equips
  drop constraint if exists komi_premium_cosmetic_equips_banner_id_check,
  add constraint komi_premium_cosmetic_equips_banner_id_check
  check (banner_id is null or banner_id in (
    'banner_noir','banner_stars','banner_grid','banner_moon','banner_aurora',
    'banner_frost','banner_glitch','banner_eclipse','banner_projection','banner_citylight',
    'banner_panels','banner_synthwave','banner_orbit','banner_silverscreen','banner_contactsheet',
    'banner_botanical','banner_petal'
  ));

alter table public.komi_premium_cosmetic_equips
  drop constraint if exists komi_premium_cosmetic_equips_title_id_check,
  add constraint komi_premium_cosmetic_equips_title_id_check
  check (title_id is null or title_id in (
    'title_cinema','title_starlight','title_collector','title_otaku','title_explorer',
    'title_nocturne','title_legend','title_archivist','title_marathon','title_curator',
    'title_cosmic','title_veteran','title_ongoing','title_nightmarathon','title_critic',
    'title_spoiler','title_pioneer','title_titres','title_doublefeature','title_midnight',
    'title_pagekeeper','title_playerone','title_stargazer','title_lastrow','title_director',
    'title_gardenkeeper','title_bloom'
  ));

alter table public.komi_premium_cosmetic_equips
  drop constraint if exists komi_premium_cosmetic_equips_name_id_check,
  add constraint komi_premium_cosmetic_equips_name_id_check
  check (name_id is null or name_id in (
    'name_silver','name_ghost','name_dawn','name_chrome','name_moonstone',
    'name_inklight','name_pixelbeam','name_stardust'
  ));

alter table public.komi_premium_cosmetic_equips
  drop constraint if exists komi_premium_cosmetic_equips_shape_id_check,
  add constraint komi_premium_cosmetic_equips_shape_id_check
  check (shape_id is null or shape_id in (
    'shape_cyber','shape_octagon','shape_diamond','shape_drop','shape_arch',
    'shape_stamp','shape_pixelcut','shape_comet'
  ));

alter table public.komi_premium_cosmetic_equips
  drop constraint if exists komi_premium_cosmetic_equips_plate_id_check,
  add constraint komi_premium_cosmetic_equips_plate_id_check
  check (plate_id is null or plate_id in (
    'plate_manga','plate_seigaiha','plate_rain','plate_gradient','plate_subtitle',
    'plate_window','plate_speech','plate_terminal','plate_constellation'
  ));

alter table public.komi_premium_cosmetic_equips
  drop constraint if exists komi_premium_cosmetic_equips_overlay_id_check,
  add constraint komi_premium_cosmetic_equips_overlay_id_check
  check (overlay_id is null or overlay_id in (
    'overlay_sakura','overlay_rain','overlay_film','overlay_sparks','overlay_snow',
    'overlay_dust','overlay_fireflies','overlay_datastream','overlay_meteor','overlay_pollen'
  ));

alter table public.komi_premium_cosmetic_equips
  drop constraint if exists komi_premium_cosmetic_equips_icon_id_check,
  add constraint komi_premium_cosmetic_equips_icon_id_check
  check (icon_id is null or icon_id in (
    'icon_headphones','icon_ramen','icon_cassette','icon_crown','icon_katana',
    'icon_comet','icon_ticket','icon_moonrise','icon_inkpen','icon_clapper',
    'icon_leaf'
  ));

alter table public.komi_premium_cosmetic_equips
  drop constraint if exists komi_premium_cosmetic_equips_xp_id_check,
  add constraint komi_premium_cosmetic_equips_xp_id_check
  check (xp_id is null or xp_id in (
    'xp_silver','xp_hatch','xp_beam','xp_dots','xp_perforation',
    'xp_panels','xp_combo','xp_constellation','xp_cue'
  ));

-- A revision is published only when every advertised client price matches.
-- This verifies old prices without changing them and rolls back on drift.
do $verify$
begin
  if exists (
    select 1
    from (values
      ('frame_moon',20),
      ('frame_aurora',25),
      ('frame_noir',20),
      ('frame_silver',35),
      ('frame_frost',35),
      ('frame_neon',50),
      ('frame_orbit',55),
      ('frame_eclipse',65),
      ('frame_prism',75),
      ('frame_royal',95),
      ('frame_pixel',25),
      ('frame_halo',85),
      ('title_cinema',10),
      ('title_starlight',15),
      ('title_collector',20),
      ('title_otaku',25),
      ('title_explorer',30),
      ('title_nocturne',35),
      ('title_legend',60),
      ('title_archivist',40),
      ('title_marathon',45),
      ('title_curator',50),
      ('title_cosmic',65),
      ('title_veteran',85),
      ('banner_noir',25),
      ('banner_stars',30),
      ('banner_grid',35),
      ('banner_moon',40),
      ('banner_aurora',50),
      ('banner_frost',55),
      ('banner_glitch',60),
      ('banner_eclipse',80),
      ('overlay_sakura',40),
      ('overlay_rain',50),
      ('overlay_film',25),
      ('overlay_sparks',55),
      ('overlay_snow',40),
      ('overlay_dust',70),
      ('showcase_film',60),
      ('showcase_gloss',70),
      ('showcase_neon',90),
      ('card_graphite',50),
      ('card_frost',65),
      ('card_aurora',80),
      ('card_glass',85),
      ('icon_headphones',20),
      ('icon_ramen',25),
      ('icon_cassette',30),
      ('icon_crown',75),
      ('icon_katana',55),
      ('icon_comet',45),
      ('reaction_hype',40),
      ('reaction_soft',35),
      ('reaction_cinema',50),
      ('frame_sumi',55),
      ('frame_film35',55),
      ('frame_glitch',70),
      ('frame_glass',80),
      ('frame_sakura',85),
      ('frame_slash',65),
      ('frame_shogun',120),
      ('shape_cyber',35),
      ('shape_octagon',40),
      ('shape_diamond',45),
      ('shape_drop',50),
      ('plate_manga',40),
      ('plate_seigaiha',55),
      ('plate_rain',45),
      ('plate_gradient',70),
      ('mascot_cat',55),
      ('mascot_lantern',65),
      ('mascot_spirit',85),
      ('xp_silver',55),
      ('xp_hatch',35),
      ('xp_beam',70),
      ('xp_dots',35),
      ('name_silver',70),
      ('name_ghost',60),
      ('name_dawn',85),
      ('name_chrome',95),
      ('title_ongoing',40),
      ('title_nightmarathon',50),
      ('title_critic',55),
      ('title_spoiler',60),
      ('title_pioneer',90),
      ('frame_matte',15),
      ('frame_anamorphic',50),
      ('title_titres',10),
      ('title_doublefeature',25),
      ('banner_projection',30),
      ('icon_ticket',15),
      ('plate_subtitle',20),
      ('xp_perforation',35),
      ('frame_velvet',35),
      ('banner_citylight',45),
      ('title_midnight',15),
      ('name_moonstone',60),
      ('shape_arch',25),
      ('plate_window',35),
      ('overlay_fireflies',55),
      ('icon_moonrise',20),
      ('frame_ink',40),
      ('banner_panels',40),
      ('title_pagekeeper',15),
      ('name_inklight',45),
      ('shape_stamp',30),
      ('plate_speech',30),
      ('xp_panels',35),
      ('icon_inkpen',15),
      ('frame_scanline',55),
      ('banner_synthwave',60),
      ('title_playerone',20),
      ('name_pixelbeam',65),
      ('shape_pixelcut',35),
      ('plate_terminal',40),
      ('xp_combo',45),
      ('overlay_datastream',60),
      ('frame_constellation',65),
      ('banner_orbit',60),
      ('title_stargazer',25),
      ('name_stardust',70),
      ('shape_comet',40),
      ('plate_constellation',45),
      ('xp_constellation',45),
      ('overlay_meteor',70),
      ('frame_aperture',45),
      ('banner_silverscreen',35),
      ('title_lastrow',10),
      ('frame_letterbox',40),
      ('banner_contactsheet',45),
      ('title_director',25),
      ('xp_cue',35),
      ('icon_clapper',20),
      ('frame_ivy',50),
      ('banner_botanical',50),
      ('title_gardenkeeper',15),
      ('frame_dewdrop',60),
      ('banner_petal',55),
      ('title_bloom',20),
      ('overlay_pollen',50),
      ('icon_leaf',15)
    ) as expected(item_id,cost)
    left join komi_private.shop_item_prices actual on actual.item_id=expected.item_id
    where actual.cost is distinct from expected.cost
  ) then
    raise exception 'Shop V7 prices do not match the catalog; deploy the V6 prerequisite first';
  end if;
end;
$verify$;

-- Public build marker only; no table access or privileged execution.
create or replace function public.komi_shop_catalog_revision()
returns text language sql immutable security invoker set search_path = ''
as $revision$ select '20261125-shop-v7'::text $revision$;
revoke all on function public.komi_shop_catalog_revision() from public, anon, authenticated;
grant execute on function public.komi_shop_catalog_revision() to authenticated;

commit;
