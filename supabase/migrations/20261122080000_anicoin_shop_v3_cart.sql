-- AniCoin Shop V3: atomic checkout for a preview combination.
-- Maintains existing single-item RPC contract and the same private fixed-price catalog.
begin;
create or replace function public.komi_shop_cart_buy_equip(p_items text[])
returns jsonb language plpgsql security definer set search_path=''
as $fn$
declare
 v_user uuid:=auth.uid();
 v_id text;
 v_kind text;
 v_kinds text[]:=array[]::text[];
 v_price integer;
 v_total integer:=0;
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
                     'icon','shape','plate','mascot','xp','name')
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
   end if;
 end loop;
 update public.komi_anicoin_wallets set balance=balance-v_total
    where user_id=v_user returning * into v_wallet;
 select * into v_equips from public.komi_premium_cosmetic_equips where user_id=v_user;
 select coalesce(jsonb_agg(item_id order by item_id),'[]'::jsonb) into v_inventory
    from komi_private.premium_store_purchases where user_id=v_user;
 return jsonb_build_object('balance',v_wallet.balance,'spent',v_total,
    'owned',v_inventory,
    'frame_id',v_equips.frame_id,'title_id',v_equips.title_id,'banner_id',v_equips.banner_id,
    'overlay_id',v_equips.overlay_id,'showcase_id',v_equips.showcase_id,
    'card_id',v_equips.card_id,'icon_id',v_equips.icon_id,
    'shape_id',v_equips.shape_id,'plate_id',v_equips.plate_id,
    'mascot_id',v_equips.mascot_id,'xp_id',v_equips.xp_id,'name_id',v_equips.name_id);
end $fn$;
revoke all on function public.komi_shop_cart_buy_equip(text[]) from public,anon,authenticated;
grant execute on function public.komi_shop_cart_buy_equip(text[]) to authenticated;
commit;
