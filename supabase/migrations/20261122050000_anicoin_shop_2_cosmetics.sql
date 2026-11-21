-- AniCoin Shop 2.0: 51 fixed-price permanent cosmetics; existing balances and purchases untouched.
begin;
alter table komi_private.premium_store_purchases drop constraint if exists premium_store_purchases_item_id_check;
alter table komi_private.premium_store_purchases add constraint premium_store_purchases_item_id_check check(item_id in ('frame_moon','frame_aurora','frame_noir','frame_silver','frame_frost','frame_neon','frame_orbit','frame_eclipse','frame_prism','frame_royal','frame_pixel','frame_halo','title_cinema','title_starlight','title_collector','title_otaku','title_explorer','title_nocturne','title_legend','title_archivist','title_marathon','title_curator','title_cosmic','title_veteran','banner_noir','banner_stars','banner_grid','banner_moon','banner_aurora','banner_frost','banner_glitch','banner_eclipse','overlay_sakura','overlay_rain','overlay_film','overlay_sparks','overlay_snow','overlay_dust','showcase_film','showcase_gloss','showcase_neon','card_graphite','card_frost','card_aurora','card_glass','icon_headphones','icon_ramen','icon_cassette','icon_crown','icon_katana','icon_comet'));
alter table public.komi_premium_cosmetic_equips add column if not exists overlay_id text;
alter table public.komi_premium_cosmetic_equips add constraint komi_premium_cosmetic_equips_overlay_id_check check(overlay_id is null or overlay_id in ('overlay_sakura', 'overlay_rain', 'overlay_film', 'overlay_sparks', 'overlay_snow', 'overlay_dust'));
alter table public.komi_premium_cosmetic_equips add column if not exists showcase_id text;
alter table public.komi_premium_cosmetic_equips add constraint komi_premium_cosmetic_equips_showcase_id_check check(showcase_id is null or showcase_id in ('showcase_film', 'showcase_gloss', 'showcase_neon'));
alter table public.komi_premium_cosmetic_equips add column if not exists card_id text;
alter table public.komi_premium_cosmetic_equips add constraint komi_premium_cosmetic_equips_card_id_check check(card_id is null or card_id in ('card_graphite', 'card_frost', 'card_aurora', 'card_glass'));
alter table public.komi_premium_cosmetic_equips add column if not exists icon_id text;
alter table public.komi_premium_cosmetic_equips add constraint komi_premium_cosmetic_equips_icon_id_check check(icon_id is null or icon_id in ('icon_headphones', 'icon_ramen', 'icon_cassette', 'icon_crown', 'icon_katana', 'icon_comet'));
grant select(user_id,frame_id,title_id,banner_id,overlay_id,showcase_id,card_id,icon_id) on public.komi_premium_cosmetic_equips to anon,authenticated;

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
 cost:=case p_item when 'frame_moon' then 30
 when 'frame_aurora' then 45
 when 'frame_noir' then 35
 when 'frame_silver' then 55
 when 'frame_frost' then 60
 when 'frame_neon' then 80
 when 'frame_orbit' then 95
 when 'frame_eclipse' then 110
 when 'frame_prism' then 125
 when 'frame_royal' then 160
 when 'frame_pixel' then 40
 when 'frame_halo' then 140
 when 'title_cinema' then 20
 when 'title_starlight' then 25
 when 'title_collector' then 35
 when 'title_otaku' then 40
 when 'title_explorer' then 50
 when 'title_nocturne' then 60
 when 'title_legend' then 100
 when 'title_archivist' then 65
 when 'title_marathon' then 75
 when 'title_curator' then 85
 when 'title_cosmic' then 110
 when 'title_veteran' then 140
 when 'banner_noir' then 40
 when 'banner_stars' then 50
 when 'banner_grid' then 55
 when 'banner_moon' then 65
 when 'banner_aurora' then 80
 when 'banner_frost' then 90
 when 'banner_glitch' then 100
 when 'banner_eclipse' then 130
 when 'overlay_sakura' then 65
 when 'overlay_rain' then 85
 when 'overlay_film' then 45
 when 'overlay_sparks' then 95
 when 'overlay_snow' then 70
 when 'overlay_dust' then 120
 when 'showcase_film' then 100
 when 'showcase_gloss' then 115
 when 'showcase_neon' then 150
 when 'card_graphite' then 80
 when 'card_frost' then 110
 when 'card_aurora' then 130
 when 'card_glass' then 140
 when 'icon_headphones' then 35
 when 'icon_ramen' then 40
 when 'icon_cassette' then 50
 when 'icon_crown' then 125
 when 'icon_katana' then 95
 when 'icon_comet' then 75 else null end;
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
   else raise exception 'Unknown item category' using errcode='22023'; end if;
 elsif p_action='unequip' then
   if kind='frame' then update public.komi_premium_cosmetic_equips set frame_id=null,updated_at=now() where user_id=actor and frame_id=p_item;
   elsif kind='title' then update public.komi_premium_cosmetic_equips set title_id=null,updated_at=now() where user_id=actor and title_id=p_item;
   elsif kind='banner' then update public.komi_premium_cosmetic_equips set banner_id=null,updated_at=now() where user_id=actor and banner_id=p_item;
   elsif kind='overlay' then update public.komi_premium_cosmetic_equips set overlay_id=null,updated_at=now() where user_id=actor and overlay_id=p_item;
   elsif kind='showcase' then update public.komi_premium_cosmetic_equips set showcase_id=null,updated_at=now() where user_id=actor and showcase_id=p_item;
   elsif kind='card' then update public.komi_premium_cosmetic_equips set card_id=null,updated_at=now() where user_id=actor and card_id=p_item;
   elsif kind='icon' then update public.komi_premium_cosmetic_equips set icon_id=null,updated_at=now() where user_id=actor and icon_id=p_item;
   else raise exception 'Unknown item category' using errcode='22023'; end if;
 end if;
 select coalesce(jsonb_agg(p.item_id order by p.item_id),'[]'::jsonb) into owned
 from komi_private.premium_store_purchases p where p.user_id=actor;
 select * into equip from public.komi_premium_cosmetic_equips where user_id=actor;
 return jsonb_build_object('balance',wallet.balance,'owned',coalesce(owned,'[]'::jsonb),
  'frame_id',equip.frame_id,'title_id',equip.title_id,'banner_id',equip.banner_id,
  'overlay_id',equip.overlay_id,'showcase_id',equip.showcase_id,
  'card_id',equip.card_id,'icon_id',equip.icon_id);
end $fn$;
revoke all on function public.komi_premium_store(text,text) from public,anon,authenticated;
grant execute on function public.komi_premium_store(text,text) to authenticated;
commit;
