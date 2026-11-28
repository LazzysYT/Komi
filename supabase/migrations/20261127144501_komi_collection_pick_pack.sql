-- The paid offer is stable across retries and private until a card is claimed.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create table komi_collection_private.pack_rarity (
  series_id text not null,
  character_id text not null,
  rarity text not null check (rarity in ('common','rare','epic','legendary')),
  primary key (series_id, character_id)
);

-- Mirrors the versioned collection roster. The database regression checks every entry.
insert into komi_collection_private.pack_rarity (series_id, character_id, rarity) values
  ('ghoul', 'kaneki', 'legendary'),
  ('ghoul', 'touka', 'epic'),
  ('ghoul', 'juuzou', 'epic'),
  ('ghoul', 'uta', 'rare'),
  ('ghoul', 'tsukiyama', 'rare'),
  ('ghoul', 'hide', 'common'),
  ('ghoul', 'rize', 'epic'),
  ('ghoul', 'arima', 'legendary'),
  ('ghoul', 'eto', 'legendary'),
  ('ghoul', 'ayato', 'rare'),
  ('ghoul', 'hinami', 'common'),
  ('ghoul', 'amon', 'common'),
  ('ghoul', 'nishiki', 'common'),
  ('ghoul', 'yomo', 'common'),
  ('ghoul', 'yoshimura', 'rare'),
  ('ghoul', 'akira', 'common'),
  ('ghoul', 'furuta', 'epic'),
  ('ghoul', 'takizawa', 'rare'),
  ('ghoul', 'mado', 'rare'),
  ('ghoul', 'irimi', 'rare'),
  ('ghoul', 'yamori', 'epic'),
  ('ghoul', 'naki', 'rare'),
  ('ghoul', 'koma', 'rare'),
  ('ghoul', 'tatara', 'epic'),
  ('jujutsu', 'itadori', 'rare'),
  ('jujutsu', 'fushiguro', 'epic'),
  ('jujutsu', 'kugisaki', 'rare'),
  ('jujutsu', 'gojo', 'legendary'),
  ('jujutsu', 'sukuna', 'legendary'),
  ('jujutsu', 'maki', 'epic'),
  ('jujutsu', 'toge', 'rare'),
  ('jujutsu', 'panda', 'rare'),
  ('jujutsu', 'nanami', 'epic'),
  ('jujutsu', 'yuta', 'legendary'),
  ('jujutsu', 'shoko', 'rare'),
  ('jujutsu', 'geto', 'legendary'),
  ('jujutsu', 'toji', 'legendary'),
  ('jujutsu', 'choso', 'epic'),
  ('jujutsu', 'mahito', 'epic'),
  ('jujutsu', 'todo', 'rare'),
  ('jujutsu', 'meimei', 'rare'),
  ('jujutsu', 'utahime', 'rare'),
  ('jujutsu', 'miwa', 'common'),
  ('jujutsu', 'kusakabe', 'rare'),
  ('jujutsu', 'jogo', 'epic'),
  ('jujutsu', 'hanami', 'epic'),
  ('jujutsu', 'dagon', 'rare'),
  ('jujutsu', 'higuruma', 'epic'),
  ('frieren', 'frieren', 'legendary'),
  ('frieren', 'fern', 'epic'),
  ('frieren', 'stark', 'rare'),
  ('frieren', 'himmel', 'legendary'),
  ('frieren', 'heiter', 'common'),
  ('frieren', 'eisen', 'epic'),
  ('frieren', 'flamme', 'legendary'),
  ('frieren', 'serie', 'legendary'),
  ('frieren', 'denken', 'epic'),
  ('frieren', 'ubel', 'epic'),
  ('frieren', 'lawine', 'rare'),
  ('frieren', 'kanne', 'rare'),
  ('frieren', 'land', 'epic'),
  ('frieren', 'methode', 'epic'),
  ('frieren', 'wirbel', 'epic'),
  ('frieren', 'ehre', 'rare'),
  ('frieren', 'scharf', 'common'),
  ('frieren', 'laufen', 'rare'),
  ('frieren', 'richter', 'rare'),
  ('frieren', 'lernen', 'epic'),
  ('frieren', 'sein', 'rare'),
  ('frieren', 'aura', 'epic'),
  ('frieren', 'lugner', 'rare'),
  ('frieren', 'linie', 'rare'),
  ('alchemist', 'edward', 'legendary'),
  ('alchemist', 'alphonse', 'epic'),
  ('alchemist', 'winry', 'rare'),
  ('alchemist', 'roy', 'legendary'),
  ('alchemist', 'riza', 'epic'),
  ('alchemist', 'alex', 'epic'),
  ('alchemist', 'maes', 'rare'),
  ('alchemist', 'scar', 'legendary'),
  ('alchemist', 'olivier', 'legendary'),
  ('alchemist', 'lanfan', 'epic'),
  ('alchemist', 'ling', 'epic'),
  ('alchemist', 'mei', 'rare'),
  ('alchemist', 'greed', 'epic'),
  ('alchemist', 'lust', 'epic'),
  ('alchemist', 'envy', 'epic'),
  ('alchemist', 'gluttony', 'rare'),
  ('alchemist', 'wrath', 'legendary'),
  ('alchemist', 'pride', 'legendary'),
  ('alchemist', 'hohenheim', 'legendary'),
  ('alchemist', 'izumi', 'epic'),
  ('alchemist', 'pinako', 'rare'),
  ('alchemist', 'havoc', 'common'),
  ('alchemist', 'kimblee', 'epic'),
  ('alchemist', 'buccaneer', 'rare'),
  ('demon', 'tanjiro', 'legendary'),
  ('demon', 'nezuko', 'legendary'),
  ('demon', 'zenitsu', 'epic'),
  ('demon', 'inosuke', 'epic'),
  ('demon', 'giyu', 'epic'),
  ('demon', 'shinobu', 'epic'),
  ('demon', 'rengoku', 'legendary'),
  ('demon', 'tengen', 'epic'),
  ('demon', 'mitsuri', 'epic'),
  ('demon', 'muichiro', 'epic'),
  ('demon', 'gyomei', 'epic'),
  ('demon', 'sanemi', 'epic'),
  ('demon', 'obanai', 'rare'),
  ('demon', 'kanao', 'rare'),
  ('demon', 'genya', 'rare'),
  ('demon', 'muzan', 'legendary'),
  ('demon', 'akaza', 'legendary'),
  ('demon', 'doma', 'epic'),
  ('demon', 'kokushibo', 'legendary'),
  ('demon', 'daki', 'rare'),
  ('demon', 'sabito', 'rare'),
  ('demon', 'makomo', 'rare'),
  ('demon', 'tamayo', 'epic'),
  ('demon', 'yushiro', 'rare'),
  ('aot', 'eren', 'legendary'),
  ('aot', 'mikasa', 'legendary'),
  ('aot', 'armin', 'epic'),
  ('aot', 'levi', 'legendary'),
  ('aot', 'erwin', 'legendary'),
  ('aot', 'hange', 'epic'),
  ('aot', 'jean', 'rare'),
  ('aot', 'connie', 'common'),
  ('aot', 'sasha', 'rare'),
  ('aot', 'reiner', 'epic'),
  ('aot', 'bertholdt', 'rare'),
  ('aot', 'annie', 'epic'),
  ('aot', 'historia', 'rare'),
  ('aot', 'ymir', 'rare'),
  ('aot', 'zeke', 'epic'),
  ('aot', 'pieck', 'rare'),
  ('aot', 'porco', 'rare'),
  ('aot', 'gabi', 'rare'),
  ('aot', 'falco', 'common'),
  ('aot', 'moblit', 'common'),
  ('aot', 'hannes', 'common'),
  ('aot', 'kenny', 'epic'),
  ('aot', 'petra', 'rare'),
  ('aot', 'yelena', 'rare'),
  ('naruto', 'naruto', 'legendary'),
  ('naruto', 'sasuke', 'legendary'),
  ('naruto', 'sakura', 'epic'),
  ('naruto', 'kakashi', 'epic'),
  ('naruto', 'shikamaru', 'rare'),
  ('naruto', 'hinata', 'rare'),
  ('naruto', 'gaara', 'epic'),
  ('naruto', 'lee', 'rare'),
  ('naruto', 'neji', 'rare'),
  ('naruto', 'temari', 'common'),
  ('naruto', 'itachi', 'legendary'),
  ('naruto', 'pain', 'legendary'),
  ('naruto', 'konan', 'rare'),
  ('naruto', 'deidara', 'common'),
  ('naruto', 'kisame', 'common'),
  ('naruto', 'jiraiya', 'epic'),
  ('naruto', 'tsunade', 'epic'),
  ('naruto', 'orochimaru', 'epic'),
  ('naruto', 'minato', 'legendary'),
  ('naruto', 'madara', 'legendary'),
  ('bleach', 'ichigo', 'legendary'),
  ('bleach', 'rukia', 'epic'),
  ('bleach', 'renji', 'rare'),
  ('bleach', 'byakuya', 'legendary'),
  ('bleach', 'toshiro', 'epic'),
  ('bleach', 'orihime', 'rare'),
  ('bleach', 'uryu', 'epic'),
  ('bleach', 'chad', 'common'),
  ('bleach', 'urahara', 'legendary'),
  ('bleach', 'yoruichi', 'legendary'),
  ('bleach', 'kenpachi', 'legendary'),
  ('bleach', 'rangiku', 'common'),
  ('bleach', 'soifon', 'rare'),
  ('bleach', 'shunsui', 'epic'),
  ('bleach', 'yamamoto', 'legendary'),
  ('bleach', 'aizen', 'legendary'),
  ('bleach', 'gin', 'rare'),
  ('bleach', 'ulquiorra', 'epic'),
  ('bleach', 'grimmjow', 'epic'),
  ('bleach', 'nelliel', 'rare'),
  ('onepiece', 'luffy', 'legendary'),
  ('onepiece', 'zoro', 'legendary'),
  ('onepiece', 'nami', 'epic'),
  ('onepiece', 'usopp', 'common'),
  ('onepiece', 'sanji', 'epic'),
  ('onepiece', 'chopper', 'rare'),
  ('onepiece', 'robin', 'epic'),
  ('onepiece', 'franky', 'rare'),
  ('onepiece', 'brook', 'rare'),
  ('onepiece', 'jinbe', 'epic'),
  ('onepiece', 'ace', 'legendary'),
  ('onepiece', 'sabo', 'epic'),
  ('onepiece', 'shanks', 'legendary'),
  ('onepiece', 'law', 'legendary'),
  ('onepiece', 'hancock', 'epic'),
  ('onepiece', 'mihawk', 'legendary'),
  ('onepiece', 'buggy', 'common'),
  ('onepiece', 'smoker', 'rare'),
  ('onepiece', 'vivi', 'rare'),
  ('onepiece', 'crocodile', 'epic'),
  ('chainsaw', 'denji', 'legendary'),
  ('chainsaw', 'power', 'epic'),
  ('chainsaw', 'aki', 'epic'),
  ('chainsaw', 'makima', 'legendary'),
  ('chainsaw', 'pochita', 'legendary'),
  ('chainsaw', 'kishibe', 'epic'),
  ('chainsaw', 'himeno', 'rare'),
  ('chainsaw', 'kobeni', 'common'),
  ('chainsaw', 'reze', 'legendary'),
  ('chainsaw', 'quanxi', 'epic'),
  ('chainsaw', 'angel', 'epic'),
  ('chainsaw', 'beam', 'rare'),
  ('chainsaw', 'galgali', 'rare'),
  ('chainsaw', 'princi', 'common'),
  ('chainsaw', 'yoshida', 'rare'),
  ('chainsaw', 'katana', 'epic'),
  ('chainsaw', 'asa', 'rare'),
  ('chainsaw', 'yoru', 'epic'),
  ('chainsaw', 'nayuta', 'rare'),
  ('chainsaw', 'fumiko', 'common'),
  ('hunter', 'gon', 'legendary'),
  ('hunter', 'killua', 'legendary'),
  ('hunter', 'kurapika', 'epic'),
  ('hunter', 'leorio', 'rare'),
  ('hunter', 'hisoka', 'legendary'),
  ('hunter', 'chrollo', 'epic'),
  ('hunter', 'illumi', 'epic'),
  ('hunter', 'netero', 'epic'),
  ('hunter', 'bisky', 'rare'),
  ('hunter', 'kite', 'rare'),
  ('hunter', 'meruem', 'legendary'),
  ('hunter', 'pitou', 'epic'),
  ('hunter', 'komugi', 'rare'),
  ('hunter', 'knuckle', 'common'),
  ('hunter', 'shoot', 'common'),
  ('hunter', 'morel', 'rare'),
  ('hunter', 'palm', 'common'),
  ('hunter', 'feitan', 'rare'),
  ('hunter', 'machi', 'common'),
  ('hunter', 'shizuku', 'common');

create table komi_collection_private.pack_offers (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  series_id text not null,
  choices text[] not null check (pg_catalog.cardinality(choices) between 1 and 5),
  -- Independent of the public offer ID to keep older purchase RPCs compatible.
  settlement_id uuid not null unique default pg_catalog.gen_random_uuid(),
  claimed_slot integer check (claimed_slot between 1 and pg_catalog.cardinality(choices)),
  obsolete boolean not null default false
);
create unique index collection_one_pending_pack
  on komi_collection_private.pack_offers (user_id, series_id)
  where claimed_slot is null and not obsolete;
create index collection_pack_offers_user_idx on komi_collection_private.pack_offers (user_id);

alter table komi_collection_private.pack_rarity enable row level security;
alter table komi_collection_private.pack_offers enable row level security;
revoke all on komi_collection_private.pack_offers, komi_collection_private.pack_rarity from public, anon, authenticated, service_role;

create function komi_collection_private.pick_pack(p_series_id text, p_offer_id uuid, p_slot integer)
returns jsonb language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_series text;
  v_pack komi_collection_private.pack_offers%rowtype;
  v_owned text[];
  v_choices text[];
  v_visible jsonb;
  v_snapshot jsonb;
  v_result text;
  v_balance bigint;
  v_status text := 'ready';
  v_price constant integer := 50;
begin
  if v_user is null or coalesce(auth.jwt()->>'is_anonymous','false') = 'true'
     or not exists(select 1 from auth.users where id=v_user and deleted_at is null and is_anonymous is not true) then
    raise exception 'Authentication required' using errcode='42501';
  end if;
  if (p_slot is not null and (p_offer_id is null or p_slot not between 1 and 5))
     or (p_slot is null and p_series_id is null) then
    raise exception 'Invalid pack request' using errcode='22023';
  end if;

  -- Same lock and lock order as legacy purchases, including wallet mutations.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('komi_collection:' || v_user::text, 0));

  if p_offer_id is not null then
    select o.* into v_pack from komi_collection_private.pack_offers o
      where o.id=p_offer_id and o.user_id=v_user;
    if not found or (p_series_id is not null and p_series_id is distinct from v_pack.series_id) then
      raise exception 'Pack unavailable' using errcode='22023';
    end if;
  end if;
  v_series := coalesce(p_series_id, v_pack.series_id);
  if not exists(select 1 from komi_collection_private.pack_rarity where series_id=v_series) then
    raise exception 'Unknown collection series' using errcode='22023';
  end if;

  if v_series='ghoul' then
    v_snapshot := komi_collection_private.action('read');
  else
    v_snapshot := komi_collection_private.series_action_edition(v_series, null, false, 3);
  end if;
  v_owned := array(select pg_catalog.jsonb_array_elements_text(v_snapshot->'owned'));

  if v_pack.id is null then
    select o.* into v_pack from komi_collection_private.pack_offers o
      where o.user_id=v_user and o.series_id=v_series and o.claimed_slot is null and not o.obsolete;
  end if;

  if v_pack.id is not null and v_pack.claimed_slot is not null then
    -- Retries and concurrent picks always read back the first committed choice.
    v_status := 'claimed';
  elsif v_pack.id is not null and (v_pack.obsolete or v_pack.choices <@ v_owned) then
    update komi_collection_private.pack_offers set obsolete=true where id=v_pack.id;
    if p_offer_id is null then
      v_pack := null;
    else
      v_status := 'stale';
    end if;
  end if;

  if v_pack.id is null then
    select pg_catalog.array_agg(c.character_id order by c.draw) into v_choices
    from (
      select r.character_id, pg_catalog.random() as draw
        from komi_collection_private.pack_rarity r
        where r.series_id=v_series and not (r.character_id=any(v_owned))
        order by draw limit 5
    ) c;
    if v_choices is null then
      return v_snapshot || pg_catalog.jsonb_build_object('pack_status','complete');
    end if;
    if coalesce((v_snapshot->>'balance')::bigint,0) < v_price then
      return v_snapshot || pg_catalog.jsonb_build_object('pack_status','insufficient');
    end if;
    insert into komi_collection_private.pack_offers (user_id, series_id, choices)
      values (v_user, v_series, v_choices) returning * into v_pack;
  elsif v_status='ready' and p_slot is not null then
    v_result := v_pack.choices[p_slot];
    if v_result is null then
      raise exception 'Invalid pack slot' using errcode='22023';
    end if;
    if v_result=any(v_owned) then
      v_status := 'stale';
    else
      select balance into v_balance from public.komi_anicoin_wallets
        where user_id=v_user for update;
      if coalesce(v_balance,0) < v_price then
        v_status := 'insufficient';
        v_snapshot := v_snapshot || pg_catalog.jsonb_build_object('balance',coalesce(v_balance,0));
      else
        update public.komi_anicoin_wallets set balance=balance-v_price where user_id=v_user;
        if v_series='ghoul' then
          insert into komi_collection_private.unlocks (user_id,character_id,opened_on,paid_request_id,paid_cost)
            values(v_user,v_result,(now() at time zone 'UTC')::date,v_pack.settlement_id,v_price);
        else
          insert into komi_collection_private.series_unlocks (user_id,series_id,character_id,paid_request_id,paid_cost)
            values(v_user,v_series,v_result,v_pack.settlement_id,v_price);
        end if;
        update komi_collection_private.pack_offers set claimed_slot=p_slot where id=v_pack.id returning * into v_pack;
        v_snapshot := v_snapshot || pg_catalog.jsonb_build_object(
          'owned', pg_catalog.to_jsonb(pg_catalog.array_append(v_owned,v_result)), 'balance', v_balance-v_price);
        v_status := 'claimed';
      end if;
    end if;
  end if;

  select pg_catalog.jsonb_agg(
    pg_catalog.jsonb_build_object('slot', c.slot, 'rarity', r.rarity,
      'available', v_status <> 'claimed' and not(c.character_id=any(v_owned)))
    || case when v_status='claimed' then pg_catalog.jsonb_build_object('id',c.character_id) else '{}'::jsonb end
    order by c.slot
  ) into v_visible
  from pg_catalog.unnest(v_pack.choices) with ordinality c(character_id,slot)
  join komi_collection_private.pack_rarity r on r.series_id=v_series and r.character_id=c.character_id;

  return v_snapshot || pg_catalog.jsonb_build_object(
    'pack_status', v_status,
    'offer_id', v_pack.id,
    'choices', v_visible,
    'selected_slot', v_pack.claimed_slot,
    'result', v_pack.choices[v_pack.claimed_slot],
    'purchase_status', case when v_status='claimed' then 'ok' else null end
  );
end;
$$;

create function public.komi_collection_pack_open(p_series_id text, p_offer_id uuid default null)
returns jsonb language sql volatile security invoker set search_path = ''
as $$ select komi_collection_private.pick_pack(p_series_id,p_offer_id,null) $$;

create function public.komi_collection_pack_claim(p_offer_id uuid, p_slot integer)
returns jsonb language sql volatile security invoker set search_path = ''
as $$ select komi_collection_private.pick_pack(null,p_offer_id,p_slot) $$;

revoke all on function komi_collection_private.pick_pack(text,uuid,integer),
  public.komi_collection_pack_open(text,uuid), public.komi_collection_pack_claim(uuid,integer)
  from public, anon, authenticated, service_role;
grant execute on function komi_collection_private.pick_pack(text,uuid,integer),
  public.komi_collection_pack_open(text,uuid), public.komi_collection_pack_claim(uuid,integer)
  to authenticated;

-- An issue number belongs to one copy. Counters retain the last serial if a
-- collector deletes their account, so no later copy can acquire that number.
create table komi_collection_private.card_issue_counters (
  series_id text not null,
  character_id text not null,
  last_serial bigint not null check (last_serial > 0),
  primary key (series_id, character_id)
);
create table komi_collection_private.card_issues (
  user_id uuid not null references auth.users(id) on delete cascade,
  series_id text not null,
  character_id text not null,
  serial bigint not null check (serial > 0),
  primary key (user_id, series_id, character_id),
  unique (series_id, character_id, serial)
);
alter table komi_collection_private.card_issue_counters enable row level security;
alter table komi_collection_private.card_issues enable row level security;
revoke all on komi_collection_private.card_issue_counters, komi_collection_private.card_issues
  from public, anon, authenticated, service_role;

create function komi_collection_private.issue_card_number()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_series text;
  v_serial bigint;
begin
  if tg_table_name = 'unlocks' then v_series := 'ghoul';
  else v_series := new.series_id;
  end if;
  insert into komi_collection_private.card_issue_counters as c (series_id,character_id,last_serial)
    values(v_series,new.character_id,1)
    on conflict (series_id,character_id) do update set last_serial=c.last_serial+1
    returning last_serial into v_serial;
  insert into komi_collection_private.card_issues(user_id,series_id,character_id,serial)
    values(new.user_id,v_series,new.character_id,v_serial)
    on conflict (user_id,series_id,character_id) do update set serial=excluded.serial;
  return new;
end;
$$;
revoke all on function komi_collection_private.issue_card_number() from public, anon, authenticated, service_role;

-- Installing the triggers before the backfill holds the same write barrier
-- through commit. Existing owners are numbered in acquisition order.
create trigger collection_ghoul_issue_number
  after insert on komi_collection_private.unlocks
  for each row execute function komi_collection_private.issue_card_number();
create trigger collection_series_issue_number
  after insert on komi_collection_private.series_unlocks
  for each row execute function komi_collection_private.issue_card_number();

insert into komi_collection_private.card_issues(user_id,series_id,character_id,serial)
select user_id,series_id,character_id,
  pg_catalog.row_number() over(partition by series_id,character_id order by created_at,user_id)
from (
  select user_id,'ghoul'::text as series_id,character_id,created_at from komi_collection_private.unlocks
  union all
  select user_id,series_id,character_id,created_at from komi_collection_private.series_unlocks
) owners;
insert into komi_collection_private.card_issue_counters(series_id,character_id,last_serial)
select series_id,character_id,max(serial) from komi_collection_private.card_issues group by series_id,character_id;

create function komi_collection_private.card_number(p_series_id text,p_character_id text)
returns jsonb language sql stable security definer set search_path = ''
as $$
  select pg_catalog.jsonb_build_object('serial',i.serial,'issued',c.last_serial)
  from komi_collection_private.card_issues i
  join komi_collection_private.card_issue_counters c using(series_id,character_id)
  where komi_collection_private.showcase_verified_actor() and i.user_id=auth.uid()
    and i.series_id=p_series_id and i.character_id=p_character_id
    and case when i.series_id='ghoul' then exists(
      select 1 from komi_collection_private.unlocks u where u.user_id=i.user_id and u.character_id=i.character_id
    ) else exists(
      select 1 from komi_collection_private.series_unlocks u
      where u.user_id=i.user_id and u.series_id=i.series_id and u.character_id=i.character_id
    ) end
$$;
create function public.komi_collection_card_number(p_series_id text,p_character_id text)
returns jsonb language sql stable security invoker set search_path = ''
as $$ select komi_collection_private.card_number(p_series_id,p_character_id) $$;
revoke all on function komi_collection_private.card_number(text,text), public.komi_collection_card_number(text,text)
  from public, anon, authenticated, service_role;
grant execute on function komi_collection_private.card_number(text,text), public.komi_collection_card_number(text,text)
  to authenticated;

commit;
