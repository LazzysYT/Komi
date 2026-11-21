-- Shop social features. All prices and ownership checks are server-side; no direct client writes.
begin;

-- Fixed prices are reused by friend gifts. One catalog entry per unique permanent item.
create table if not exists komi_private.shop_item_prices(
  item_id text primary key,
  cost integer not null check(cost between 1 and 500),
  giftable boolean not null default true
);
alter table komi_private.shop_item_prices enable row level security;
revoke all on komi_private.shop_item_prices from public,anon,authenticated;
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
('reaction_cinema',85,true)
on conflict(item_id) do update set cost=excluded.cost,giftable=excluded.giftable;

alter table komi_private.premium_store_purchases drop constraint if exists premium_store_purchases_item_id_check;
alter table komi_private.premium_store_purchases add constraint premium_store_purchases_item_id_check
  check(item_id in ('frame_moon','frame_aurora','frame_noir','frame_silver','frame_frost','frame_neon','frame_orbit','frame_eclipse','frame_prism','frame_royal','frame_pixel','frame_halo','title_cinema','title_starlight','title_collector','title_otaku','title_explorer','title_nocturne','title_legend','title_archivist','title_marathon','title_curator','title_cosmic','title_veteran','banner_noir','banner_stars','banner_grid','banner_moon','banner_aurora','banner_frost','banner_glitch','banner_eclipse','overlay_sakura','overlay_rain','overlay_film','overlay_sparks','overlay_snow','overlay_dust','showcase_film','showcase_gloss','showcase_neon','card_graphite','card_frost','card_aurora','card_glass','icon_headphones','icon_ramen','icon_cassette','icon_crown','icon_katana','icon_comet','reaction_hype','reaction_soft','reaction_cinema'));
alter table komi_private.premium_store_purchases drop constraint if exists premium_store_purchases_price_check;
alter table komi_private.premium_store_purchases add constraint premium_store_purchases_price_check
  check(price between 0 and 500);
alter table komi_private.premium_store_purchases add column if not exists acquisition text not null default 'purchase';
alter table komi_private.premium_store_purchases add constraint premium_store_purchases_acquisition_check
  check(acquisition in ('purchase','gift'));

-- No direct access to spending logs or gift notes.
create table if not exists komi_private.shop_gifts(
  id bigint generated always as identity primary key,
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  item_id text not null references komi_private.shop_item_prices(item_id),
  price integer not null check(price between 1 and 500),
  note text not null default '' check(length(note)<=120),
  created_at timestamptz not null default now(),
  check(sender_id<>recipient_id)
);
create index if not exists komi_shop_gifts_to_idx on komi_private.shop_gifts(recipient_id,created_at desc);
create index if not exists komi_shop_gifts_from_idx on komi_private.shop_gifts(sender_id,created_at desc);
alter table komi_private.shop_gifts enable row level security;
revoke all on komi_private.shop_gifts from public,anon,authenticated;

create table if not exists komi_private.shop_consumable_orders(
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check(kind in ('comment_highlight','quest_xp_booster')),
  object_id text,
  price integer not null check(price between 1 and 500),
  created_at timestamptz not null default now()
);
create index if not exists komi_shop_orders_recent_idx
  on komi_private.shop_consumable_orders(user_id,kind,created_at desc);
alter table komi_private.shop_consumable_orders enable row level security;
revoke all on komi_private.shop_consumable_orders from public,anon,authenticated;

-- Published boost metadata contains no private wallet information.
create table if not exists public.komi_comment_highlights(
 comment_id bigint primary key references public.komi_comments(id) on delete cascade,
 expires_at timestamptz not null,
 updated_at timestamptz not null default now()
);
alter table public.komi_comment_highlights enable row level security;
revoke all on public.komi_comment_highlights from public,anon,authenticated;
grant select(comment_id,expires_at) on public.komi_comment_highlights to anon,authenticated;
create policy "Comment highlights publicly visible" on public.komi_comment_highlights
  for select to anon,authenticated using(true);

create table if not exists komi_private.shop_xp_boosters(
 user_id uuid primary key references auth.users(id) on delete cascade,
 started_at timestamptz not null,
 expires_at timestamptz not null
);
alter table komi_private.shop_xp_boosters enable row level security;
revoke all on komi_private.shop_xp_boosters from public,anon,authenticated;
-- 2x applies to newly claimed daily quest XP only (verified events), never historical XP.
alter table komi_private.daily_quest_claims drop constraint if exists daily_quest_claims_xp_awarded_check;
alter table komi_private.daily_quest_claims add constraint daily_quest_claims_xp_awarded_check
 check(xp_awarded between 10 and 60);

-- Reuse the existing protected store contract, with 3 reaction pack SKUs added.
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
 when 'icon_comet' then 75
 when 'reaction_hype' then 70
 when 'reaction_soft' then 60
 when 'reaction_cinema' then 85 else null end;
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


-- Extend the verified daily quest claim path, preserving idempotency and premium XP.
create or replace function public.komi_daily_quests(
  p_action text default 'read',
  p_quest text default null
)
returns jsonb language plpgsql security definer set search_path = ''
as $fn$
declare
  v_user uuid := auth.uid();
  v_day date := (now() at time zone 'UTC')::date;
  v_today_start timestamptz := ((now() at time zone 'UTC')::date::timestamp at time zone 'UTC');
  v_premium boolean; v_booster boolean;
  v_checkin boolean; v_watch boolean; v_comment boolean;
  v_eligible boolean := false;
  v_base_xp integer; v_xp integer; v_coins integer;
  v_awarded boolean := false;
  v_claims jsonb; v_total_xp integer;
begin
  if v_user is null or not exists(
    select 1 from auth.users u where u.id=v_user and u.deleted_at is null
      and u.is_anonymous is not true
  ) then
    raise exception 'Verified user required' using errcode='42501';
  end if;
  if p_action not in ('read','claim') or p_action is null
     or (p_action='claim' and (p_quest is null or p_quest not in ('checkin','watch','comment'))) then
    raise exception 'Unsupported quest action' using errcode='22023';
  end if;
  v_premium := exists(
    select 1 from public.komi_premium_badges b
    where b.user_id=v_user and b.active_until>now()
  );
  v_booster := exists(select 1 from komi_private.shop_xp_boosters b
     where b.user_id=v_user and b.expires_at>now());
  v_checkin := exists(
    select 1 from komi_private.daily_activity_checkins c
    where c.user_id=v_user and c.activity_day=v_day
  );
  v_watch := exists(
    select 1 from public.komi_anicoin_ledger l
    where l.user_id=v_user and l.reason='watch'
      and l.created_at>=v_today_start and l.created_at<v_today_start+interval '1 day'
  );
  v_comment := exists(
    select 1 from public.komi_comments c
    where c.user_id=v_user and c.created_at>=v_today_start
      and c.created_at<v_today_start+interval '1 day'
      and length(btrim(c.body))>=10
  );
  if p_action='claim' then
    v_eligible := case p_quest
      when 'checkin' then v_checkin
      when 'watch' then v_watch
      when 'comment' then v_comment else false end;
    if not v_eligible then
      raise exception 'Quest evidence is not verified' using errcode='22023';
    end if;
    v_base_xp := case p_quest when 'checkin' then 20 when 'watch' then 30 else 10 end;
    v_xp := case when v_booster then v_base_xp*2 when v_premium then v_base_xp*3/2 else v_base_xp end;
    v_coins := case when p_quest in ('checkin','watch') then 1 else 0 end;
    insert into komi_private.daily_quest_claims(user_id,quest_day,quest_id,xp_awarded,coins_awarded)
      values(v_user,v_day,p_quest,v_xp,v_coins)
      on conflict(user_id,quest_day,quest_id) do nothing;
    v_awarded := found;
    if v_awarded and v_coins>0 then
      insert into public.komi_anicoin_wallets(user_id,balance)
        values(v_user,v_coins)
        on conflict(user_id) do update
          set balance=public.komi_anicoin_wallets.balance+excluded.balance;
      insert into public.komi_anicoin_ledger(user_id,delta,reason)
        values(v_user,v_coins,'quest_daily');
    end if;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',c.quest_id,'xp',c.xp_awarded,'coins',c.coins_awarded,
    'day',c.quest_day) order by c.quest_day desc),'[]'::jsonb),
    coalesce(sum(c.xp_awarded),0)::integer
  into v_claims,v_total_xp
  from komi_private.daily_quest_claims c where c.user_id=v_user;
  return jsonb_build_object(
    'server_day',v_day,
    'premium_xp_multiplier',case when v_premium then 1.5 else 1 end,
    'quest_xp_multiplier',case when v_booster then 2 when v_premium then 1.5 else 1 end,
    'available',jsonb_build_object('checkin',v_checkin,'watch',v_watch,'comment',v_comment),
    'claims',v_claims,'quest_xp_total',v_total_xp,
    'awarded_now',v_awarded
  );
end
$fn$;


-- Atomic friend-only purchase for recipient. Gift is nonrefundable and never auto-equips.
create or replace function public.komi_shop_gifts(
 p_action text default 'read',
 p_item text default null,
 p_recipient uuid default null,
 p_message text default ''
) returns jsonb language plpgsql security definer set search_path=''
as $fn$
declare
 actor uuid:=auth.uid();
 v_price integer;
 v_note text;
 v_wallet public.komi_anicoin_wallets%rowtype;
 v_inbox jsonb;
 v_outbox jsonb;
begin
 if actor is null or not exists(select 1 from auth.users u where u.id=actor and u.deleted_at is null and u.is_anonymous is not true)
 then raise exception 'Sign in required' using errcode='42501'; end if;
 if p_action is null or p_action not in ('read','send') then
   raise exception 'Invalid gift action' using errcode='22023';
 end if;
 if p_action='send' then
   if p_recipient is null or p_recipient=actor or not exists(
      select 1 from public.komi_friendships f
      where (f.user_a=actor and f.user_b=p_recipient) or (f.user_b=actor and f.user_a=p_recipient))
   then raise exception 'You can only gift confirmed friends' using errcode='42501'; end if;
   if not exists(select 1 from auth.users u where u.id=p_recipient and u.deleted_at is null and u.is_anonymous is not true)
   then raise exception 'Recipient unavailable' using errcode='42501'; end if;
   select cost into v_price from komi_private.shop_item_prices where item_id=p_item and giftable=true;
   if v_price is null then raise exception 'Unknown gift item' using errcode='22023'; end if;
   v_note:=btrim(regexp_replace(coalesce(p_message,''),'[[:cntrl:]]','','g'));
   if length(v_note)>120 then raise exception 'Message too long' using errcode='22023'; end if;
   insert into public.komi_anicoin_wallets(user_id) values(actor) on conflict do nothing;
   select * into v_wallet from public.komi_anicoin_wallets where user_id=actor for update;
   if (select count(*) from komi_private.shop_gifts where sender_id=actor and created_at>=now()-interval '1 day')>=3
   then raise exception 'Daily gift limit reached (3)' using errcode='22023'; end if;
   if exists(select 1 from komi_private.premium_store_purchases p where p.user_id=p_recipient and p.item_id=p_item)
   then raise exception 'Friend already owns this item' using errcode='22023'; end if;
   if v_wallet.balance<v_price then raise exception 'Not enough AniCoin' using errcode='22023'; end if;
   insert into komi_private.premium_store_purchases(user_id,item_id,price,acquisition)
       values(p_recipient,p_item,0,'gift');
   update public.komi_anicoin_wallets set balance=balance-v_price where user_id=actor returning * into v_wallet;
   insert into komi_private.shop_gifts(sender_id,recipient_id,item_id,price,note)
       values(actor,p_recipient,p_item,v_price,v_note);
 end if;
 select coalesce(jsonb_agg(row_data order by created_at desc),'[]'::jsonb) into v_inbox
 from (select jsonb_build_object('id',g.id,'item',g.item_id,'note',g.note,
        'from',coalesce(p.display_name,p.username,'Участник Komi'),'date',g.created_at) as row_data,
       g.created_at
       from komi_private.shop_gifts g left join public.komi_profiles p on p.user_id=g.sender_id
       where g.recipient_id=actor order by g.created_at desc limit 30) t;
 select coalesce(jsonb_agg(row_data order by created_at desc),'[]'::jsonb) into v_outbox
 from (select jsonb_build_object('id',g.id,'item',g.item_id,'to',
       coalesce(p.display_name,p.username,'Участник Komi'),'date',g.created_at) as row_data,
       g.created_at from komi_private.shop_gifts g
       left join public.komi_profiles p on p.user_id=g.recipient_id
       where g.sender_id=actor order by g.created_at desc limit 30) t;
 return jsonb_build_object('received',coalesce(v_inbox,'[]'::jsonb),
   'sent',coalesce(v_outbox,'[]'::jsonb),'balance',v_wallet.balance,
   'success',p_action='send');
end $fn$;
revoke all on function public.komi_shop_gifts(text,text,uuid,text) from public,anon,authenticated;
grant execute on function public.komi_shop_gifts(text,text,uuid,text) to authenticated;

-- Single-use 24-hour comment promotion, clearly labelled; max two each UTC day.
create or replace function public.komi_shop_highlight(p_comment_id bigint)
returns jsonb language plpgsql security definer set search_path=''
as $fn$
declare actor uuid:=auth.uid(); v_wallet public.komi_anicoin_wallets%rowtype;
 v_expires timestamptz;
begin
 if actor is null or not exists(select 1 from auth.users u where u.id=actor and u.deleted_at is null and u.is_anonymous is not true)
 then raise exception 'Sign in required' using errcode='42501'; end if;
 if not exists(select 1 from public.komi_comments c where c.id=p_comment_id and c.user_id=actor)
 then raise exception 'You can highlight only your own comment' using errcode='42501'; end if;
 insert into public.komi_anicoin_wallets(user_id) values(actor) on conflict do nothing;
 select * into v_wallet from public.komi_anicoin_wallets where user_id=actor for update;
 if exists(select 1 from public.komi_comment_highlights where comment_id=p_comment_id and expires_at>now())
 then raise exception 'Comment is already highlighted' using errcode='22023'; end if;
 if (select count(*) from komi_private.shop_consumable_orders
     where user_id=actor and kind='comment_highlight'
       and created_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC')>=2
 then raise exception 'Daily highlight limit reached' using errcode='22023'; end if;
 if v_wallet.balance<12 then raise exception 'Not enough AniCoin' using errcode='22023'; end if;
 v_expires:=now()+interval '24 hours';
 insert into public.komi_comment_highlights(comment_id,expires_at,updated_at)
  values(p_comment_id,v_expires,now())
  on conflict(comment_id) do update set expires_at=excluded.expires_at,updated_at=now()
  where public.komi_comment_highlights.expires_at<=now();
 if not found then raise exception 'Comment is already highlighted' using errcode='22023'; end if;
 update public.komi_anicoin_wallets set balance=balance-12 where user_id=actor;
 insert into komi_private.shop_consumable_orders(user_id,kind,object_id,price)
  values(actor,'comment_highlight',p_comment_id::text,12);
 return jsonb_build_object('expires_at',v_expires,'price',12);
end $fn$;
revoke all on function public.komi_shop_highlight(bigint) from public,anon,authenticated;
grant execute on function public.komi_shop_highlight(bigint) to authenticated;

create or replace function public.komi_shop_booster(p_action text default 'read')
returns jsonb language plpgsql security definer set search_path=''
as $fn$
declare actor uuid:=auth.uid(); v_wallet public.komi_anicoin_wallets%rowtype;
 v_expiry timestamptz;
begin
 if actor is null or not exists(select 1 from auth.users u where u.id=actor and u.deleted_at is null and u.is_anonymous is not true)
 then raise exception 'Sign in required' using errcode='42501'; end if;
 if p_action is null or p_action not in ('read','buy') then raise exception 'Invalid booster action' using errcode='22023'; end if;
 if p_action='buy' then
   insert into public.komi_anicoin_wallets(user_id) values(actor) on conflict do nothing;
   select * into v_wallet from public.komi_anicoin_wallets where user_id=actor for update;
   if exists(select 1 from komi_private.shop_xp_boosters b where b.user_id=actor and b.expires_at>now())
   then raise exception 'Booster is already active' using errcode='22023'; end if;
   if v_wallet.balance<110 then raise exception 'Not enough AniCoin' using errcode='22023'; end if;
   v_expiry:=now()+interval '24 hours';
   insert into komi_private.shop_xp_boosters(user_id,started_at,expires_at)
    values(actor,now(),v_expiry)
    on conflict(user_id) do update set started_at=excluded.started_at,expires_at=excluded.expires_at;
   update public.komi_anicoin_wallets set balance=balance-110 where user_id=actor;
   insert into komi_private.shop_consumable_orders(user_id,kind,price)
    values(actor,'quest_xp_booster',110);
 end if;
 select expires_at into v_expiry from komi_private.shop_xp_boosters where user_id=actor;
 return jsonb_build_object('active',coalesce(v_expiry>now(),false),
    'active_until',v_expiry,'price',110);
end $fn$;
revoke all on function public.komi_shop_booster(text) from public,anon,authenticated;
grant execute on function public.komi_shop_booster(text) to authenticated;

-- Reaction packs: entitled owner + live room participant, using existing chat moderation/cooldown.
create or replace function public.komi_shop_reaction(p_room uuid,p_reaction text)
returns jsonb language plpgsql security definer set search_path=''
as $fn$
declare actor uuid:=auth.uid(); v_room public.komi_party_rooms%rowtype;
 v_pack text; v_emoji text; v_name text;
begin
 if actor is null or not exists(select 1 from auth.users u where u.id=actor and u.deleted_at is null and u.is_anonymous is not true)
 then raise exception 'Sign in required' using errcode='42501'; end if;
 select * into v_room from public.komi_party_rooms where id=p_room for update;
 if not found or v_room.touched_at<now()-interval '2 minutes'
 then raise exception 'Room closed' using errcode='22023'; end if;
 if v_room.host<>actor and not exists(select 1 from public.komi_party_presence q
    where q.room_id=p_room and q.user_id=actor and q.last_seen>now()-interval '90 seconds')
 then raise exception 'Join the room to react' using errcode='42501'; end if;
 if v_room.private and v_room.host<>actor and not (
    actor=any(v_room.guests) or komi_private.party_invite_is_valid(v_room.id,actor,clock_timestamp()))
 then raise exception 'Private room only' using errcode='42501'; end if;
 v_pack:=case p_reaction
 when 'hype' then 'reaction_hype'
 when 'wow' then 'reaction_hype'
 when 'clap' then 'reaction_hype'
 when 'tear' then 'reaction_soft'
 when 'heart' then 'reaction_soft'
 when 'laugh' then 'reaction_soft'
 when 'star' then 'reaction_cinema'
 when 'suspense' then 'reaction_cinema'
 when 'popcorn' then 'reaction_cinema'
 else null end;
 v_emoji:=case p_reaction
 when 'hype' then '🔥'
 when 'wow' then '😮'
 when 'clap' then '👏'
 when 'tear' then '🥲'
 when 'heart' then '🤍'
 when 'laugh' then '😂'
 when 'star' then '⭐'
 when 'suspense' then '👀'
 when 'popcorn' then '🍿'
 else null end;
 if v_pack is null or not exists(select 1 from komi_private.premium_store_purchases p
   where p.user_id=actor and p.item_id=v_pack)
 then raise exception 'Reaction pack not owned' using errcode='42501'; end if;
 select left(coalesce(display_name,username,'Участник Komi'),40) into v_name
   from public.komi_profiles where user_id=actor;
 update public.komi_party_rooms set messages=
   (case when jsonb_array_length(messages)>=50 then messages-0 else messages end)
    || jsonb_build_array(jsonb_build_object(
      'author',coalesce(v_name,'Участник Komi'),'text',v_emoji,
      'kind','reaction','code',p_reaction,'event_id',gen_random_uuid()::text))
 where id=p_room returning * into v_room;
 return jsonb_build_object('messages',v_room.messages);
end $fn$;
revoke all on function public.komi_shop_reaction(uuid,text) from public,anon,authenticated;
grant execute on function public.komi_shop_reaction(uuid,text) to authenticated;

commit;
