-- Character-inspired titles. Preserve all existing ID and checkout revisions.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
insert into komi_private.shop_item_prices(item_id,cost,giftable) values
  ('title_gojo_infinity',45,true),
  ('title_levi_captain',35,true),
  ('title_frieren_bloom',30,true),
  ('title_luffy_dawn',35,true),
  ('title_tanjiro_current',40,true),
  ('title_anya_signal',30,true)
on conflict (item_id) do nothing;

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
    'banner_last_train','banner_moon_platform','frame_platform_light','overlay_station_rain','title_last_departure',
    'title_crimson_hunter','title_moon_ronin','title_yokai_whisper','title_awakening_mode','title_sakura_vow','title_last_cut',
    'title_gojo_infinity','title_levi_captain','title_frieren_bloom','title_luffy_dawn','title_tanjiro_current','title_anya_signal'
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
    'title_last_departure',
    'title_crimson_hunter','title_moon_ronin','title_yokai_whisper','title_awakening_mode','title_sakura_vow','title_last_cut',
    'title_gojo_infinity','title_levi_captain','title_frieren_bloom','title_luffy_dawn','title_tanjiro_current','title_anya_signal'
  ));

do $verify$
begin
  if public.komi_shop_titles_revision() is distinct from '20261126-anime-title-foil' then
    raise exception 'Anime foil titles prerequisite missing';
  end if;
  if exists (
    select 1 from (values ('title_gojo_infinity',45,true),
  ('title_levi_captain',35,true),
  ('title_frieren_bloom',30,true),
  ('title_luffy_dawn',35,true),
  ('title_tanjiro_current',40,true),
  ('title_anya_signal',30,true)) expected(item_id,cost,giftable)
    left join komi_private.shop_item_prices actual on actual.item_id=expected.item_id
    where actual.cost is distinct from expected.cost or actual.giftable is distinct from expected.giftable
  ) then raise exception 'Unexpected character-inspired title price'; end if;
end;
$verify$;
create or replace function public.komi_shop_cast_revision()
returns text language sql immutable security invoker set search_path=''
as $revision$ select '20261126-anime-cast'::text $revision$;
revoke all on function public.komi_shop_cast_revision() from public,anon,authenticated;
grant execute on function public.komi_shop_cast_revision() to authenticated;
commit;
