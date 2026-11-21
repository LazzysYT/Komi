-- Expanded shared AniCoin cosmetics. The wallet and original purchases remain intact.
alter table komi_private.premium_store_purchases
 drop constraint if exists premium_store_purchases_item_id_check;
alter table komi_private.premium_store_purchases
 add constraint premium_store_purchases_item_id_check check(item_id in ('frame_moon','frame_aurora','frame_noir','frame_silver','frame_frost','frame_neon','frame_orbit','frame_eclipse','frame_prism','frame_royal','frame_pixel','frame_halo','title_cinema','title_starlight','title_collector','title_otaku','title_explorer','title_nocturne','title_legend','title_archivist','title_marathon','title_curator','title_cosmic','title_veteran','banner_noir','banner_stars','banner_grid','banner_moon','banner_aurora','banner_frost','banner_glitch','banner_eclipse'));
alter table komi_private.premium_store_purchases
 drop constraint if exists premium_store_purchases_price_check;
alter table komi_private.premium_store_purchases
 add constraint premium_store_purchases_price_check check(price between 1 and 500);
alter table public.komi_premium_cosmetic_equips
 drop constraint if exists komi_premium_cosmetic_equips_frame_id_check;
alter table public.komi_premium_cosmetic_equips
 add constraint komi_premium_cosmetic_equips_frame_id_check check(frame_id is null or frame_id in ('frame_moon','frame_aurora','frame_noir','frame_silver','frame_frost','frame_neon','frame_orbit','frame_eclipse','frame_prism','frame_royal','frame_pixel','frame_halo'));
alter table public.komi_premium_cosmetic_equips
 drop constraint if exists komi_premium_cosmetic_equips_title_id_check;
alter table public.komi_premium_cosmetic_equips
 add constraint komi_premium_cosmetic_equips_title_id_check check(title_id is null or title_id in ('title_cinema','title_starlight','title_collector','title_otaku','title_explorer','title_nocturne','title_legend','title_archivist','title_marathon','title_curator','title_cosmic','title_veteran'));
alter table public.komi_premium_cosmetic_equips
 add column if not exists banner_id text;
alter table public.komi_premium_cosmetic_equips
 add constraint komi_premium_cosmetic_equips_banner_id_check check(banner_id is null or banner_id in ('banner_noir','banner_stars','banner_grid','banner_moon','banner_aurora','banner_frost','banner_glitch','banner_eclipse'));
-- Cosmetic display is not a Premium entitlement. Users spend earned coins freely.
drop policy if exists "Active Premium cosmetics public display" on public.komi_premium_cosmetic_equips;
drop policy if exists "Purchased cosmetics public display" on public.komi_premium_cosmetic_equips;
create policy "Purchased cosmetics public display" on public.komi_premium_cosmetic_equips
 for select to anon,authenticated using(true);
grant select(user_id,frame_id,title_id,banner_id) on public.komi_premium_cosmetic_equips to anon,authenticated;

create or replace function public.komi_premium_store(
 p_action text default 'read',p_item text default null
) returns jsonb language plpgsql security definer set search_path=''
as $fn$
declare
 actor uuid:=auth.uid();
 cost integer;
 wallet public.komi_anicoin_wallets%rowtype;
 owned jsonb;
 equip public.komi_premium_cosmetic_equips%rowtype;
begin
 if actor is null or not exists(select 1 from auth.users u
   where u.id=actor and u.deleted_at is null and u.is_anonymous is not true)
 then raise exception 'Verified account required' using errcode='42501'; end if;
 if p_action is null or p_action not in ('read','buy','equip','unequip')
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
    when 'banner_eclipse' then 130 else null end;
 if p_action<>'read' and cost is null
 then raise exception 'Unknown AniCoin item' using errcode='22023'; end if;
 insert into public.komi_anicoin_wallets(user_id) values(actor) on conflict do nothing;
 select * into wallet from public.komi_anicoin_wallets where user_id=actor for update;
 if p_action='buy' then
   if exists(select 1 from komi_private.premium_store_purchases p
     where p.user_id=actor and p.item_id=p_item)
   then raise exception 'Item already purchased' using errcode='22023'; end if;
   if wallet.balance<cost
   then raise exception 'Not enough AniCoin' using errcode='22023'; end if;
   insert into komi_private.premium_store_purchases(user_id,item_id,price)
    values(actor,p_item,cost);
   update public.komi_anicoin_wallets set balance=balance-cost
    where user_id=actor returning * into wallet;
 elsif p_action='equip' then
   if not exists(select 1 from komi_private.premium_store_purchases p
     where p.user_id=actor and p.item_id=p_item)
   then raise exception 'Purchase required before equipping' using errcode='42501'; end if;
   if p_item like 'frame_%' then
     insert into public.komi_premium_cosmetic_equips(user_id,frame_id) values(actor,p_item)
     on conflict(user_id) do update set frame_id=excluded.frame_id,updated_at=now();
   elsif p_item like 'title_%' then
     insert into public.komi_premium_cosmetic_equips(user_id,title_id) values(actor,p_item)
     on conflict(user_id) do update set title_id=excluded.title_id,updated_at=now();
   else
     insert into public.komi_premium_cosmetic_equips(user_id,banner_id) values(actor,p_item)
     on conflict(user_id) do update set banner_id=excluded.banner_id,updated_at=now();
   end if;
 elsif p_action='unequip' then
   if p_item like 'frame_%' then
     update public.komi_premium_cosmetic_equips set frame_id=null,updated_at=now()
       where user_id=actor and frame_id=p_item;
   elsif p_item like 'title_%' then
     update public.komi_premium_cosmetic_equips set title_id=null,updated_at=now()
       where user_id=actor and title_id=p_item;
   else
     update public.komi_premium_cosmetic_equips set banner_id=null,updated_at=now()
       where user_id=actor and banner_id=p_item;
   end if;
 end if;
 select coalesce(jsonb_agg(p.item_id order by p.item_id),'[]'::jsonb) into owned
   from komi_private.premium_store_purchases p where p.user_id=actor;
 select * into equip from public.komi_premium_cosmetic_equips where user_id=actor;
 return jsonb_build_object('balance',wallet.balance,'owned',coalesce(owned,'[]'::jsonb),
   'frame_id',equip.frame_id,'title_id',equip.title_id,'banner_id',equip.banner_id);
end $fn$;
revoke all on function public.komi_premium_store(text,text) from public,anon,authenticated;
grant execute on function public.komi_premium_store(text,text) to authenticated;
