\set ON_ERROR_STOP on
-- Disposable PostgreSQL fixture; never run on production.
create role anon nologin;
create role authenticated nologin;
create schema auth;
create schema storage;
create schema komi_private;
create schema komi_collection_private;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema auth to authenticated;
grant execute on function auth.uid() to authenticated;
create table auth.users(id uuid primary key,deleted_at timestamptz,is_anonymous boolean not null default false);
create table storage.objects(bucket_id text,name text,primary key(bucket_id,name));
create table public.anime_catalog(shikimori_id integer primary key);
create table public.komi_anime_lists(user_id uuid,anime_id integer,status text,primary key(user_id,anime_id));
create table public.komi_favorites(user_id uuid,anime_id integer,category text,primary key(user_id,anime_id,category));
create table public.komi_friendships(user_a uuid,user_b uuid,primary key(user_a,user_b));
create table public.komi_anicoin_wallets(user_id uuid primary key references auth.users(id),balance bigint not null default 0 check(balance>=0));
create table public.komi_profiles(user_id uuid primary key,username text unique);
create table komi_private.daily_activity_checkins(user_id uuid,activity_day date,primary key(user_id,activity_day));
create table komi_private.daily_quest_claims(user_id uuid,quest_id text,primary key(user_id,quest_id));
create table komi_private.user_privacy(user_id uuid primary key,hide_profile boolean);
create table komi_collection_private.unlocks(user_id uuid,character_id text,primary key(user_id,character_id));
create table komi_collection_private.series_unlocks(user_id uuid,series_id text,character_id text,primary key(user_id,series_id,character_id));
create function public.komi_verified_xp() returns jsonb language sql stable security definer set search_path='' as $$select jsonb_build_object('xp',case when auth.uid()='00000000-0000-0000-0000-000000000001' then 1600 else 0 end)$$;
create function public.komi_is_profile_visible(p_user uuid) returns boolean language sql stable security definer set search_path='' as $$select not exists(select 1 from komi_private.user_privacy where user_id=p_user and hide_profile)$$;
insert into auth.users(id) values('00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000002'),('00000000-0000-0000-0000-000000000003');
insert into auth.users(id,is_anonymous) values('00000000-0000-0000-0000-000000000004',true);
insert into public.komi_profiles values('00000000-0000-0000-0000-000000000001','alpha'),('00000000-0000-0000-0000-000000000002','beta'),('00000000-0000-0000-0000-000000000003','gamma');
insert into public.komi_anicoin_wallets values('00000000-0000-0000-0000-000000000001',100),('00000000-0000-0000-0000-000000000002',5),('00000000-0000-0000-0000-000000000003',100);
insert into public.anime_catalog values(1),(2),(3);
insert into public.komi_anime_lists values('00000000-0000-0000-0000-000000000001',1,'Просмотрено'),('00000000-0000-0000-0000-000000000001',2,'Смотрю'),('00000000-0000-0000-0000-000000000001',3,'В планах'),('00000000-0000-0000-0000-000000000001',999,'Просмотрено');
insert into public.komi_favorites values('00000000-0000-0000-0000-000000000001',1,'a'),('00000000-0000-0000-0000-000000000001',1,'b');
insert into public.komi_friendships values('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002');
insert into komi_private.daily_activity_checkins values('00000000-0000-0000-0000-000000000001','2026-11-27');
insert into komi_private.daily_quest_claims values('00000000-0000-0000-0000-000000000001','first');
insert into komi_collection_private.unlocks values('00000000-0000-0000-0000-000000000001','kaneki');
insert into komi_collection_private.series_unlocks values('00000000-0000-0000-0000-000000000001','jujutsu','gojo');
insert into storage.objects values('avatars','00000000-0000-0000-0000-000000000001/11111111-1111-1111-1111-111111111111.jpg');
\ir ../docs/profile-extras-v1.sql
do $$begin
 if (select count(*) from komi_profile_extras_private.medal_catalog)<>60 or (select count(*) from komi_profile_extras_private.products)<>16 then raise exception 'catalog count';end if;
end$$;
set role anon;
do $$begin
 begin perform public.komi_profile_extras('read');raise exception 'anon read allowed';exception when insufficient_privilege then null;end;
end$$;
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000004',false);
do $$begin
 begin perform public.komi_profile_extras('read');raise exception 'anonymous account read allowed';exception when insufficient_privilege then null;end;
end$$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
do $$declare r jsonb;begin
 r:=public.komi_profile_extras('read');
 if r->>'revision'<>'20261127-profile-extras-v1' or r->'stats'->>'watched'<>'1' or r->'stats'->>'listed'<>'3' or r->'stats'->>'favorites'<>'1' or r->'stats'->>'worlds'<>'2' then raise exception 'server metrics wrong %',r;end if;
 begin perform public.komi_profile_extras('claim','{"medal_id":"watched_250","progress":9999}');raise exception 'unearned medal allowed';exception when invalid_parameter_value then null;end;
 r:=public.komi_profile_extras('claim','{"medal_id":"watched_1"}');
 if r->>'new_medal'<>'watched_1' or r->>'balance'<>'100' then raise exception 'medal grant incorrect';end if;
 r:=public.komi_profile_extras('claim','{"medal_id":"watched_1"}');
 if r->>'new_medal' is not null or jsonb_array_length(r->'medals')<>1 then raise exception 'duplicate award';end if;
 begin perform public.komi_profile_extras('pin','{"medal_id":"watched_250"}');raise exception 'unowned pin allowed';exception when insufficient_privilege then null;end;
 perform public.komi_profile_extras('pin','{"medal_id":"watched_1"}');
 begin perform public.komi_profile_extras('buy','{"item_id":"cursor_katana","expected_cost":1}');raise exception 'price injection';exception when invalid_parameter_value then null;end;
 r:=public.komi_profile_extras('buy','{"item_id":"cursor_katana","expected_cost":10}');
 if r->>'balance'<>'90' or r->'appearance'->>'cursor_id'<>'cursor_katana' then raise exception 'cursor checkout';end if;
 r:=public.komi_profile_extras('buy','{"item_id":"cursor_katana","expected_cost":10}');
 if r->>'balance'<>'90' then raise exception 'double charge';end if;
 r:=public.komi_profile_extras('buy','{"item_id":"friend_fx_sakura","expected_cost":15}');
 if r->>'balance'<>'75' or r->'appearance'->>'effect_id'<>'friend_fx_sakura' then raise exception 'effect checkout';end if;
 begin perform public.komi_profile_extras('save_card','{"background":"custom","background_path":"00000000-0000-0000-0000-000000000002/11111111-1111-1111-1111-111111111111.jpg","card_enabled":true,"cursor_id":"cursor_katana","effect_id":"friend_fx_sakura"}');raise exception 'foreign photo accepted';exception when invalid_parameter_value then null;end;
 begin perform public.komi_profile_extras('save_card','{"background":"gold","card_enabled":true,"cursor_id":"friend_fx_sakura","effect_id":"friend_fx_sakura"}');raise exception 'wrong kind accepted';exception when insufficient_privilege then null;end;
 r:=public.komi_profile_extras('read');if r->'appearance'->>'background'<>'noir' then raise exception 'partial update';end if;
 r:=public.komi_profile_extras('save_card','{"background":"custom","avatar_path":"00000000-0000-0000-0000-000000000001/11111111-1111-1111-1111-111111111111.jpg","background_path":"00000000-0000-0000-0000-000000000001/11111111-1111-1111-1111-111111111111.jpg","card_enabled":true,"cursor_id":"cursor_katana","effect_id":"friend_fx_sakura"}');
 if r->'appearance'->>'background'<>'custom' or r->'appearance'->>'effect_id'<>'friend_fx_sakura' then raise exception 'atomic card save';end if;
 begin execute 'select count(*) from komi_profile_extras_private.purchases';raise exception 'private purchases exposed';exception when insufficient_privilege then null;end;
end$$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
do $$declare r jsonb;begin
 r:=public.komi_profile_extras('read');if r->>'balance'<>'5' or jsonb_array_length(r->'owned')<>0 or jsonb_array_length(r->'medals')<>0 then raise exception 'cross-account data';end if;
 begin perform public.komi_profile_extras('equip','{"item_id":"cursor_katana"}');raise exception 'foreign ownership accepted';exception when insufficient_privilege then null;end;
 begin perform public.komi_profile_extras('buy','{"item_id":"cursor_katana","expected_cost":10}');raise exception 'negative wallet allowed';exception when invalid_parameter_value then null;end;
 r:=public.komi_profile_extras('cards','{"handles":["alpha","gamma"]}');if jsonb_array_length(r)<>1 or r->0->>'username'<>'alpha' or r->0->>'effect_id'<>'friend_fx_sakura' then raise exception 'friend card missing %',r;end if;
 r:=public.komi_profile_extras('cards','{"handles":["00000000-0000-0000-0000-000000000001"]}');if jsonb_array_length(r)<>1 or r->0->>'username'<>'00000000-0000-0000-0000-000000000001' then raise exception 'verified ID friend card missing';end if;
 r:=public.komi_profile_extras('public_medal','{"username":"alpha"}');if r->>'medal_id'<>'watched_1' then raise exception 'public pin missing';end if;
end$$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',false);
do $$begin
 if jsonb_array_length(public.komi_profile_extras('cards','{"handles":["alpha"]}'))<>0 then raise exception 'nonfriend data leaked';end if;
end$$;
reset role;
insert into komi_private.user_privacy values('00000000-0000-0000-0000-000000000001',true);
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
do $$begin
 if jsonb_array_length(public.komi_profile_extras('cards','{"handles":["alpha"]}'))<>0 then raise exception 'private friend card leaked';end if;
 if public.komi_profile_extras('public_medal','{"username":"alpha"}')->>'medal_id' is not null then raise exception 'private medal leaked';end if;
end$$;
reset role;
select 'PASS: server medals, fixed-price purchases, no repeated charges, atomic card settings, owner-only media, friend and profile privacy' as result;
