\set ON_ERROR_STOP on
-- Disposable test database only. No live credentials or production data.
create role anon nologin;
create role authenticated nologin;
create schema auth;
create schema komi_private;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema auth to anon,authenticated;
grant execute on function auth.uid() to anon,authenticated;
create table auth.users(id uuid primary key,deleted_at timestamptz,is_anonymous boolean not null default false);
create table public.komi_anicoin_wallets(user_id uuid primary key references auth.users(id),balance integer not null default 0 check(balance>=0));
create table komi_private.shop_item_prices(item_id text primary key,cost integer not null check(cost>0),giftable boolean not null);
create table komi_private.premium_store_purchases(user_id uuid not null references auth.users(id),item_id text not null,price integer not null,primary key(user_id,item_id),
 constraint premium_store_purchases_item_id_check check(item_id in ('frame_ghoul_seal','name_mangaka_ink','title_cinema','frame_moon')),
 constraint premium_store_purchases_no_retired_gallery_items check(item_id<>'frame_moon'));
create table public.komi_premium_cosmetic_equips(user_id uuid primary key references auth.users(id),updated_at timestamptz,
 frame_id text constraint komi_premium_cosmetic_equips_frame_id_check check (frame_id is null or frame_id in ('frame_ghoul_seal')),
 title_id text constraint komi_premium_cosmetic_equips_title_id_check check (title_id is null or title_id in ('title_cinema')),
 banner_id text constraint komi_premium_cosmetic_equips_banner_id_check check (banner_id is null or banner_id in ('banner_noir')),
 overlay_id text,
 showcase_id text,
 card_id text,
 icon_id text,
 shape_id text,
 plate_id text,
 mascot_id text,
 xp_id text,
 name_id text constraint komi_premium_cosmetic_equips_name_id_check check (name_id is null or name_id in ('name_mangaka_ink')));
alter table public.komi_premium_cosmetic_equips enable row level security;
create policy fixture_public_equips on public.komi_premium_cosmetic_equips for select to anon,authenticated using (true);
grant select(user_id,frame_id,title_id,banner_id,overlay_id,showcase_id,card_id,icon_id,shape_id,plate_id,mascot_id,xp_id,name_id) on public.komi_premium_cosmetic_equips to anon,authenticated;
create table public.komi_comments(id bigint primary key,user_id uuid not null references auth.users(id));
create function public.komi_shop_living_revision() returns text language sql immutable as $$ select '20261126-living-profile'::text $$;
insert into auth.users(id) values('00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000002');
insert into public.komi_anicoin_wallets values('00000000-0000-0000-0000-000000000001',200),('00000000-0000-0000-0000-000000000002',20);
insert into public.komi_comments values(1,'00000000-0000-0000-0000-000000000002');
insert into komi_private.shop_item_prices values('frame_ghoul_seal',30,false),('name_mangaka_ink',25,false),('title_cinema',10,true),('frame_moon',20,true);
\ir ../docs/animated-shop-catalog.sql
do $$ begin
 if (select count(*) from komi_private.shop_item_prices)<>32 then raise exception 'wrong catalog count'; end if;
 if (select cost from komi_private.shop_item_prices where item_id='frame_ghoul_seal')<>30 then raise exception 'old price changed'; end if;
 if not exists(select 1 from pg_constraint where conname='premium_store_purchases_no_retired_gallery_items') then raise exception 'retired constraint lost'; end if;
end $$;
set role anon;
do $$ begin
 if public.komi_shop_animated_revision()<>'20261127-animated-shop' then raise exception 'public revision'; end if;
 begin perform public.komi_premium_store('read',null);raise exception 'anonymous RPC allowed'; exception when insufficient_privilege then null;end;
end $$;
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
do $$ declare r jsonb; begin
 r:=public.komi_shop_cart_buy_equip(array['entry_moonrise','aura_crimson','commentfx_hype','party_comet','frame_kakugan']);
 if (r->>'spent')::integer<>120 or (r->>'balance')::integer<>80 or r->>'entry_id'<>'entry_moonrise' or r->>'aura_id'<>'aura_crimson' or r->>'commentfx_id'<>'commentfx_hype' or r->>'party_id'<>'party_comet' or r->>'frame_id'<>'frame_kakugan' then raise exception 'cart mismatch %',r; end if;
 r:=public.komi_shop_cart_buy_equip(array['entry_moonrise','commentfx_hype']);
 if (r->>'spent')::integer<>0 or (r->>'balance')::integer<>80 then raise exception 'duplicate charge'; end if;
 begin perform public.komi_shop_cart_buy_equip(array['frame_moon']);raise exception 'retired purchase allowed';exception when check_violation then null;end;
 begin perform public.komi_premium_store('equip','entry_neon_gate');raise exception 'unowned equip allowed';exception when insufficient_privilege then null;end;
 begin perform public.komi_shop_cart_buy_equip(array['entry_moonrise','entry_neon_gate']);raise exception 'duplicate category allowed';exception when invalid_parameter_value then null;end;
 r:=public.komi_premium_store('unequip','aura_crimson');
 if r->>'aura_id' is not null or (r->>'balance')::integer<>80 then raise exception 'unequip mismatch';end if;
 r:=public.komi_premium_store('equip','aura_crimson');
 if r->>'aura_id'<>'aura_crimson' then raise exception 'reequip mismatch';end if;
 insert into public.komi_comment_animated_reactions(comment_id,user_id,effect_id) values(1,auth.uid(),'commentfx_hype');
 begin insert into public.komi_comment_animated_reactions(comment_id,user_id,effect_id) values(1,'00000000-0000-0000-0000-000000000002','commentfx_hype');raise exception 'spoofed reaction allowed';exception when insufficient_privilege then null;end;
 begin update public.komi_comment_animated_reactions set effect_id='commentfx_heart' where comment_id=1 and user_id=auth.uid();raise exception 'unowned reaction allowed';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
do $$ declare r jsonb; n integer; begin
 begin perform public.komi_shop_cart_buy_equip(array['frame_kakugan']);raise exception 'insufficient balance accepted';exception when invalid_parameter_value then null;end;
 begin insert into public.komi_comment_animated_reactions(comment_id,user_id,effect_id) values(1,auth.uid(),'commentfx_hype');raise exception 'unowned reaction allowed';exception when insufficient_privilege then null;end;
 delete from public.komi_comment_animated_reactions where comment_id=1 and user_id='00000000-0000-0000-0000-000000000001';get diagnostics n=row_count;if n<>0 then raise exception 'cross-account deletion';end if;
 r:=public.komi_premium_store('read',null);if (r->>'balance')::integer<>20 or jsonb_array_length(r->'owned')<>0 then raise exception 'second account changed';end if;
end $$;
reset role;
select 'PASS: server prices, independent equipment, no repeat charge, retired checks, RLS reaction ownership and account isolation' as result;

-- Remove only fixture purchases for the four retired effects to simulate a shop with no customers affected.
delete from komi_private.premium_store_purchases where item_id in ('entry_moonrise','entry_neon_gate','party_comet','party_portal');
\ir ../docs/animated-shop-retirement.sql
do $$ begin
 if exists(select 1 from komi_private.shop_item_prices where item_id in ('entry_moonrise','entry_neon_gate','party_comet','party_portal')) then raise exception 'retired prices remain';end if;
 if (select count(*) from komi_private.shop_item_prices)<>28 then raise exception 'unrelated prices changed';end if;
end $$;
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
do $$ declare id text; begin
 foreach id in array array['entry_moonrise','entry_neon_gate','party_comet','party_portal'] loop
  begin perform public.komi_premium_store('buy_equip',id);raise exception 'retired single purchase accepted';exception when invalid_parameter_value then null;end;
  begin perform public.komi_shop_cart_buy_equip(array[id]);raise exception 'retired cart accepted';exception when invalid_parameter_value then null;end;
 end loop;
end $$;
reset role;
select 'PASS: arrival effect retirement rejects direct and cart purchases' as result;

-- Keep a historic owner and exercise both the retired price and stale-price paths.
\ir ../supabase/migrations/20261127135000_anicoin_retire_character_auras.sql
update public.komi_anicoin_wallets set balance=120 where user_id='00000000-0000-0000-0000-000000000002';
do $$ begin
 if exists(select 1 from komi_private.shop_item_prices where item_id='aura_starlight') then raise exception 'unowned aura still priced'; end if;
 if (select count(*) from komi_private.premium_store_purchases where item_id='aura_crimson')<>1 then raise exception 'historic aura was modified'; end if;
end $$;
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
do $$ declare receipt jsonb; begin
 perform public.komi_premium_store('unequip','aura_crimson');
 receipt:=public.komi_shop_cart_buy_equip(array['aura_crimson']);
 if receipt->>'aura_id'<>'aura_crimson' or (receipt->>'spent')::integer<>0 or (receipt->>'balance')::integer<>80 then
  raise exception 'historic aura can no longer be equipped for free: %',receipt;
 end if;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
do $$ declare id text; receipt jsonb; begin
 foreach id in array array['aura_crimson','aura_starlight'] loop
  begin perform public.komi_premium_store('buy',id); raise exception 'retired direct purchase allowed'; exception when invalid_parameter_value then null; end;
  begin perform public.komi_shop_cart_buy_equip(array['frame_kakugan',id]); raise exception 'retired cart purchase allowed'; exception when invalid_parameter_value then null; end;
 end loop;
 receipt:=public.komi_premium_store('read',null);
 if (receipt->>'balance')::integer<>120 or jsonb_array_length(receipt->'owned')<>0 then raise exception 'declined checkout changed inventory or balance'; end if;
 receipt:=public.komi_premium_store('buy','frame_kakugan');
 if (receipt->>'balance')::integer<>80 then raise exception 'unrelated checkout broken'; end if;
end $$;
reset role;
select 'PASS: retired auras cannot be purchased; historical ownership and normal checkout remain intact' as result;

-- Seed a historical cover owner before withdrawing the entire category.
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
select public.komi_premium_store('buy_equip','banner_blood_moon');
reset role;
-- Simulate a historical giftable price and check retirement keeps receipts resolvable.
update komi_private.shop_item_prices set giftable=true where item_id='banner_blood_moon';
\ir ../docs/frame-atelier-v2.sql
do $ begin
 if not exists(select 1 from komi_private.shop_item_prices where item_id='banner_blood_moon' and cost=35 and giftable=false) then raise exception 'banner price history or gift retirement incorrect'; end if;
end $;
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
do $$ declare r jsonb; begin
 perform public.komi_premium_store('unequip','banner_blood_moon');
 r:=public.komi_shop_cart_buy_equip(array['banner_blood_moon']);
 if r->>'banner_id'<>'banner_blood_moon' or (r->>'spent')::integer<>0 then raise exception 'owned banner no longer works'; end if;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
do $$ declare r jsonb; begin
 begin perform public.komi_premium_store('buy','banner_blood_moon'); raise exception 'retired banner direct buy accepted'; exception when invalid_parameter_value then null; end;
 begin perform public.komi_shop_cart_buy_equip(array['banner_blood_moon']); raise exception 'retired banner cart accepted'; exception when invalid_parameter_value then null; end;
 r:=public.komi_shop_cart_buy_equip(array['frame_silver_bloom']);
 if r->>'frame_id'<>'frame_silver_bloom' or (r->>'spent')::integer<>25 or (r->>'balance')::integer<>55 then raise exception 'new frame checkout wrong %',r; end if;
 r:=public.komi_shop_cart_buy_equip(array['frame_silver_bloom']);
 if (r->>'spent')::integer<>0 or (r->>'balance')::integer<>55 then raise exception 'repeat charge'; end if;
end $$;
reset role;
select 'PASS: frame atelier purchase, free re-equip, no new banner purchases, historical banners retained' as result;
