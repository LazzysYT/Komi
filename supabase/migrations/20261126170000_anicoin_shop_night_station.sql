-- Station 00:17: additive catalog. No changes to previous price or ownership rows.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

insert into komi_private.shop_item_prices(item_id,cost,giftable) values
  ('banner_last_train',45,true),
  ('banner_moon_platform',40,true),
  ('frame_platform_light',30,true),
  ('overlay_station_rain',35,true),
  ('title_last_departure',15,true)
on conflict(item_id) do nothing;

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
    'icon_leaf',
    'banner_last_train','banner_moon_platform','frame_platform_light','overlay_station_rain','title_last_departure'
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
    'frame_aperture','frame_letterbox','frame_ivy','frame_dewdrop',
    'frame_platform_light'
  ));

alter table public.komi_premium_cosmetic_equips
  drop constraint if exists komi_premium_cosmetic_equips_banner_id_check,
  add constraint komi_premium_cosmetic_equips_banner_id_check
  check (banner_id is null or banner_id in (
    'banner_noir','banner_stars','banner_grid','banner_moon','banner_aurora',
    'banner_frost','banner_glitch','banner_eclipse','banner_projection','banner_citylight',
    'banner_panels','banner_synthwave','banner_orbit','banner_silverscreen','banner_contactsheet',
    'banner_botanical','banner_petal',
    'banner_last_train','banner_moon_platform'
  ));

alter table public.komi_premium_cosmetic_equips
  drop constraint if exists komi_premium_cosmetic_equips_overlay_id_check,
  add constraint komi_premium_cosmetic_equips_overlay_id_check
  check (overlay_id is null or overlay_id in (
    'overlay_sakura','overlay_rain','overlay_film','overlay_sparks','overlay_snow',
    'overlay_dust','overlay_fireflies','overlay_datastream','overlay_meteor','overlay_pollen',
    'overlay_station_rain'
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
    'title_gardenkeeper','title_bloom',
    'title_last_departure'
  ));

do $verify$
begin
  if public.komi_shop_catalog_revision() is distinct from '20261125-shop-v7' then
    raise exception 'Unexpected Komi catalog revision';
  end if;
  if exists (
    select 1 from (values ('banner_last_train',45,true),
  ('banner_moon_platform',40,true),
  ('frame_platform_light',30,true),
  ('overlay_station_rain',35,true),
  ('title_last_departure',15,true)) expected(item_id,cost,giftable)
    left join komi_private.shop_item_prices actual on actual.item_id=expected.item_id
    where actual.cost is distinct from expected.cost or actual.giftable is distinct from expected.giftable
  ) then
    raise exception 'Unexpected Station 00:17 price or gifting flag';
  end if;
end;
$verify$;
-- Keep the legacy V7 RPC untouched so already-loaded clients can still check out.
create or replace function public.komi_shop_station_revision()
returns text language sql immutable security invoker set search_path = ''
as $revision$ select '20261126-station-0017'::text $revision$;
revoke all on function public.komi_shop_station_revision() from public, anon, authenticated;
grant execute on function public.komi_shop_station_revision() to authenticated;
commit;
