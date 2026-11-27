-- CANDIDATE: test in disposable PostgreSQL, then generate a tracked migration.
-- No live schema or wallet changes are authorized by this file alone.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
create schema if not exists komi_profile_extras_private;
revoke all on schema komi_profile_extras_private from public,anon,authenticated;
grant usage on schema komi_profile_extras_private to authenticated;
create table komi_profile_extras_private.medal_catalog(
 id text primary key, metric text not null, group_label text not null, condition_label text not null, label text not null,
 target integer not null check(target>0), rarity text not null check(rarity in ('common','uncommon','rare','epic','legendary','mythic')),
 tier integer not null check(tier between 1 and 6));
insert into komi_profile_extras_private.medal_catalog values
  ('watched_1','watched','Завершённые тайтлы','Отмечено «Просмотрено»','Первый финал',1,'common',1),
  ('watched_5','watched','Завершённые тайтлы','Отмечено «Просмотрено»','Пять историй',5,'uncommon',2),
  ('watched_15','watched','Завершённые тайтлы','Отмечено «Просмотрено»','Знаток сюжетов',15,'rare',3),
  ('watched_50','watched','Завершённые тайтлы','Отмечено «Просмотрено»','Большой марафон',50,'epic',4),
  ('watched_100','watched','Завершённые тайтлы','Отмечено «Просмотрено»','Легенда экрана',100,'legendary',5),
  ('watched_250','watched','Завершённые тайтлы','Отмечено «Просмотрено»','Вечный зритель',250,'mythic',6),
  ('watching_1','watching','Текущий просмотр','Тайтлов со статусом «Смотрю»','Первый кадр',1,'common',1),
  ('watching_3','watching','Текущий просмотр','Тайтлов со статусом «Смотрю»','Три премьеры',3,'uncommon',2),
  ('watching_5','watching','Текущий просмотр','Тайтлов со статусом «Смотрю»','В ритме сезона',5,'rare',3),
  ('watching_10','watching','Текущий просмотр','Тайтлов со статусом «Смотрю»','Сезонный навигатор',10,'epic',4),
  ('watching_20','watching','Текущий просмотр','Тайтлов со статусом «Смотрю»','Хранитель расписания',20,'legendary',5),
  ('watching_40','watching','Текущий просмотр','Тайтлов со статусом «Смотрю»','Вихрь историй',40,'mythic',6),
  ('listed_5','listed','Библиотека','Разных тайтлов в списках','Записная книжка',5,'common',1),
  ('listed_15','listed','Библиотека','Разных тайтлов в списках','Малая библиотека',15,'uncommon',2),
  ('listed_30','listed','Библиотека','Разных тайтлов в списках','Архивариус',30,'rare',3),
  ('listed_75','listed','Библиотека','Разных тайтлов в списках','Хранитель каталога',75,'epic',4),
  ('listed_150','listed','Библиотека','Разных тайтлов в списках','Великая библиотека',150,'legendary',5),
  ('listed_400','listed','Библиотека','Разных тайтлов в списках','Бесконечный архив',400,'mythic',6),
  ('favorites_1','favorites','Любимое','Тайтлов в избранном','В сердце',1,'common',1),
  ('favorites_3','favorites','Любимое','Тайтлов в избранном','Три фаворита',3,'uncommon',2),
  ('favorites_10','favorites','Любимое','Тайтлов в избранном','Подборка мечты',10,'rare',3),
  ('favorites_25','favorites','Любимое','Тайтлов в избранном','Сокровищница',25,'epic',4),
  ('favorites_50','favorites','Любимое','Тайтлов в избранном','Коллекция сердца',50,'legendary',5),
  ('favorites_100','favorites','Любимое','Тайтлов в избранном','Сердце аниме',100,'mythic',6),
  ('friends_1','friends','Друзья','Подтверждённых друзей','Первая встреча',1,'common',1),
  ('friends_3','friends','Друзья','Подтверждённых друзей','Малый круг',3,'uncommon',2),
  ('friends_5','friends','Друзья','Подтверждённых друзей','Команда',5,'rare',3),
  ('friends_10','friends','Друзья','Подтверждённых друзей','Дружеский клуб',10,'epic',4),
  ('friends_20','friends','Друзья','Подтверждённых друзей','Гильдия',20,'legendary',5),
  ('friends_50','friends','Друзья','Подтверждённых друзей','Созвездие друзей',50,'mythic',6),
  ('xp_100','xp','Опыт','XP по серверному расчёту','Искра опыта',100,'common',1),
  ('xp_500','xp','Опыт','XP по серверному расчёту','Новый уровень',500,'uncommon',2),
  ('xp_1500','xp','Опыт','XP по серверному расчёту','Ученик мастера',1500,'rare',3),
  ('xp_5000','xp','Опыт','XP по серверному расчёту','Мастер пути',5000,'epic',4),
  ('xp_15000','xp','Опыт','XP по серверному расчёту','Высшая ступень',15000,'legendary',5),
  ('xp_50000','xp','Опыт','XP по серверному расчёту','Легенда Komi',50000,'mythic',6),
  ('checkins_1','checkins','Активность','Дней с отметкой активности','День первый',1,'common',1),
  ('checkins_7','checkins','Активность','Дней с отметкой активности','Неделя Komi',7,'uncommon',2),
  ('checkins_14','checkins','Активность','Дней с отметкой активности','Две недели',14,'rare',3),
  ('checkins_30','checkins','Активность','Дней с отметкой активности','Месяц историй',30,'epic',4),
  ('checkins_90','checkins','Активность','Дней с отметкой активности','Три месяца',90,'legendary',5),
  ('checkins_365','checkins','Активность','Дней с отметкой активности','Год вместе',365,'mythic',6),
  ('quests_1','quests','Задания','Серверных наград за задания','Первое задание',1,'common',1),
  ('quests_5','quests','Задания','Серверных наград за задания','Искатель',5,'uncommon',2),
  ('quests_15','quests','Задания','Серверных наград за задания','Испытатель',15,'rare',3),
  ('quests_50','quests','Задания','Серверных наград за задания','Охотник за заданиями',50,'epic',4),
  ('quests_150','quests','Задания','Серверных наград за задания','Мастер квестов',150,'legendary',5),
  ('quests_500','quests','Задания','Серверных наград за задания','Герой ежедневий',500,'mythic',6),
  ('characters_1','characters','Коллекция','Разных открытых персонажей','Первый герой',1,'common',1),
  ('characters_5','characters','Коллекция','Разных открытых персонажей','Малый отряд',5,'uncommon',2),
  ('characters_10','characters','Коллекция','Разных открытых персонажей','Коллекционер',10,'rare',3),
  ('characters_20','characters','Коллекция','Разных открытых персонажей','Галерея героев',20,'epic',4),
  ('characters_40','characters','Коллекция','Разных открытых персонажей','Архив миров',40,'legendary',5),
  ('characters_75','characters','Коллекция','Разных открытых персонажей','Хранитель вселенных',75,'mythic',6),
  ('worlds_1','worlds','Миры аниме','Серий с открытыми персонажами','Первый мир',1,'common',1),
  ('worlds_2','worlds','Миры аниме','Серий с открытыми персонажами','Два мира',2,'uncommon',2),
  ('worlds_3','worlds','Миры аниме','Серий с открытыми персонажами','Путешественник',3,'rare',3),
  ('worlds_4','worlds','Миры аниме','Серий с открытыми персонажами','Между мирами',4,'epic',4),
  ('worlds_5','worlds','Миры аниме','Серий с открытыми персонажами','Мастер миров',5,'legendary',5),
  ('worlds_6','worlds','Миры аниме','Серий с открытыми персонажами','Все шесть миров',6,'mythic',6);
create table komi_profile_extras_private.products(
 id text primary key, kind text not null check(kind in ('cursor','effect')), cost integer not null check(cost between 1 and 100));
insert into komi_profile_extras_private.products values
  ('cursor_katana','cursor',10),
  ('cursor_sakura','cursor',10),
  ('cursor_ghoul','cursor',15),
  ('cursor_alchemy','cursor',15),
  ('cursor_infinity','cursor',15),
  ('cursor_frost','cursor',12),
  ('cursor_flame','cursor',20),
  ('cursor_shadow','cursor',20),
  ('cursor_kitsune','cursor',20),
  ('cursor_star','cursor',25),
  ('friend_fx_sakura','effect',15),
  ('friend_fx_neon','effect',20),
  ('friend_fx_moon','effect',20),
  ('friend_fx_ghoul','effect',25),
  ('friend_fx_stars','effect',30),
  ('friend_fx_royal','effect',35);
create table komi_profile_extras_private.medals(
 user_id uuid not null references auth.users(id) on delete cascade,
 medal_id text not null references komi_profile_extras_private.medal_catalog(id),
 awarded_at timestamptz not null default now(), primary key(user_id,medal_id));
create table komi_profile_extras_private.purchases(
 user_id uuid not null references auth.users(id) on delete cascade,
 item_id text not null references komi_profile_extras_private.products(id),
 price integer not null check(price between 1 and 100), purchased_at timestamptz not null default now(),primary key(user_id,item_id));
create table komi_profile_extras_private.appearance(
 user_id uuid primary key references auth.users(id) on delete cascade,
 cursor_id text, effect_id text, medal_id text, card_enabled boolean not null default false,
 background text not null default 'noir' check(background in ('noir','sakura','night','moon','ice','gold','custom')),
 avatar_path text, background_path text,
 check((background='custom')=(background_path is not null)),
 foreign key(user_id,cursor_id) references komi_profile_extras_private.purchases(user_id,item_id),
 foreign key(user_id,effect_id) references komi_profile_extras_private.purchases(user_id,item_id),
 foreign key(user_id,medal_id) references komi_profile_extras_private.medals(user_id,medal_id));
alter table komi_profile_extras_private.medal_catalog enable row level security;
alter table komi_profile_extras_private.products enable row level security;
alter table komi_profile_extras_private.medals enable row level security;
alter table komi_profile_extras_private.purchases enable row level security;
alter table komi_profile_extras_private.appearance enable row level security;
revoke all on all tables in schema komi_profile_extras_private from public,anon,authenticated;
create function komi_profile_extras_private.stats(actor uuid)
returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object(
 'watched',coalesce((select count(distinct l.anime_id) from public.komi_anime_lists l join public.anime_catalog c on c.shikimori_id=l.anime_id where l.user_id=actor and l.status='Просмотрено'),0),
 'watching',coalesce((select count(distinct l.anime_id) from public.komi_anime_lists l join public.anime_catalog c on c.shikimori_id=l.anime_id where l.user_id=actor and l.status='Смотрю'),0),
 'listed',coalesce((select count(distinct l.anime_id) from public.komi_anime_lists l join public.anime_catalog c on c.shikimori_id=l.anime_id where l.user_id=actor and l.status in ('Просмотрено','Смотрю','В планах','Отложено','Брошено')),0),
 'favorites',coalesce((select count(distinct l.anime_id) from public.komi_favorites l join public.anime_catalog c on c.shikimori_id=l.anime_id where l.user_id=actor),0),
 'friends',(select count(*) from public.komi_friendships f where f.user_a=actor or f.user_b=actor),
 'xp',coalesce((public.komi_verified_xp()->>'xp')::bigint,0),
 'checkins',(select count(*) from komi_private.daily_activity_checkins a where a.user_id=actor),
 'quests',(select count(*) from komi_private.daily_quest_claims q where q.user_id=actor),
 'characters',(select count(*) from komi_collection_private.unlocks u where u.user_id=actor)+(select count(*) from komi_collection_private.series_unlocks s where s.user_id=actor),
 'worlds',(case when exists(select 1 from komi_collection_private.unlocks u where u.user_id=actor) then 1 else 0 end)+(select count(distinct s.series_id) from komi_collection_private.series_unlocks s where s.user_id=actor)
 )
$$;
revoke all on function komi_profile_extras_private.stats(uuid) from public,anon,authenticated;
create function komi_profile_extras_private.valid_photo(actor uuid,photo text)
returns boolean language sql stable set search_path='' as $$
 select photo is null or (photo ~ ('^'||actor::text||'/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.]jpg$')
 and exists(select 1 from storage.objects o where o.bucket_id='avatars' and o.name=photo))
$$;
revoke all on function komi_profile_extras_private.valid_photo(uuid,text) from public,anon,authenticated;
create function komi_profile_extras_private.action(p_action text,p_args jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 actor uuid:=auth.uid(); args jsonb:=coalesce(p_args,'{}'::jsonb); item text; price integer; item_kind text;
 stats jsonb; ap komi_profile_extras_private.appearance%rowtype; balance bigint;
 medal komi_profile_extras_private.medal_catalog%rowtype; changed integer; awarded text:=null;
 bg text; av text; bp text; enabled boolean; selected_cursor text; selected_effect text;
begin
 if actor is null or not exists(select 1 from auth.users u where u.id=actor and u.deleted_at is null and u.is_anonymous is not true) then
  raise exception 'Verified account required' using errcode='42501';
 end if;
 if jsonb_typeof(args)<>'object' or pg_column_size(args)>12000 then raise exception 'Invalid arguments' using errcode='22023'; end if;
 if p_action='cards' then
  if jsonb_typeof(args->'handles') is distinct from 'array' then raise exception 'Handles required' using errcode='22023'; end if;
  if jsonb_array_length(args->'handles')>60 then raise exception 'Too many handles' using errcode='22023'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('username',k.h,'background',a.background,'avatar_path',a.avatar_path,'background_path',a.background_path,'effect_id',a.effect_id,'medal_id',a.medal_id))
    from public.komi_profiles p join komi_profile_extras_private.appearance a using(user_id)
    cross join lateral (select distinct h from jsonb_array_elements_text(args->'handles') as x(h)
      where length(h) between 1 and 64 and (h=p.user_id::text or h=p.username)) k
    where a.card_enabled
    and public.komi_is_profile_visible(p.user_id)
    and (p.user_id=actor or exists(select 1 from public.komi_friendships f where (f.user_a=actor and f.user_b=p.user_id) or (f.user_b=actor and f.user_a=p.user_id)))), '[]'::jsonb);
 elsif p_action='public_medal' then
  return coalesce((select jsonb_build_object('medal_id',a.medal_id) from public.komi_profiles p join komi_profile_extras_private.appearance a using(user_id)
   where p.username=args->>'username' and length(p.username)<=64 and public.komi_is_profile_visible(p.user_id) limit 1),'{}'::jsonb);
 end if;
 if p_action is null or p_action not in ('read','buy','equip','claim','pin','save_card') then raise exception 'Unsupported action' using errcode='22023'; end if;
 -- Serialize mutations across tabs; wallet row is also locked by all existing store purchase RPCs.
 if p_action<>'read' then
  perform pg_advisory_xact_lock(hashtextextended('komi_profile_extras:'||actor::text,0));
  insert into komi_profile_extras_private.appearance(user_id) values(actor) on conflict do nothing;
 end if;
 if p_action in ('buy','equip') then
  item:=args->>'item_id';
  if p_action='equip' and item is null then
   if args->>'kind'='cursor' then update komi_profile_extras_private.appearance set cursor_id=null where user_id=actor;
   elsif args->>'kind'='effect' then update komi_profile_extras_private.appearance set effect_id=null where user_id=actor;
   else raise exception 'Unknown equipment slot' using errcode='22023'; end if;
  else
   select p.cost,p.kind into price,item_kind from komi_profile_extras_private.products p where p.id=item;
   if price is null then raise exception 'Unknown cosmetic' using errcode='22023'; end if;
   if p_action='buy' then
    if jsonb_typeof(args->'expected_cost') is distinct from 'number'
       or (args->>'expected_cost')::numeric is distinct from price::numeric then
     raise exception 'Price changed; confirm again' using errcode='22023';
    end if;
    insert into public.komi_anicoin_wallets(user_id) values(actor) on conflict do nothing;
    select w.balance into balance from public.komi_anicoin_wallets w where w.user_id=actor for update;
    if not exists(select 1 from komi_profile_extras_private.purchases p where p.user_id=actor and p.item_id=item) then
     if balance<price then raise exception 'Not enough AniCoin' using errcode='22023'; end if;
     insert into komi_profile_extras_private.purchases(user_id,item_id,price) values(actor,item,price);
     update public.komi_anicoin_wallets as w set balance=w.balance-price where w.user_id=actor;
    end if;
   elsif not exists(select 1 from komi_profile_extras_private.purchases p where p.user_id=actor and p.item_id=item) then
    raise exception 'Purchase required' using errcode='42501';
   end if;
   if item_kind='cursor' then update komi_profile_extras_private.appearance set cursor_id=item where user_id=actor;
   else update komi_profile_extras_private.appearance set effect_id=item where user_id=actor; end if;
  end if;
 elsif p_action='save_card' then
  bg:=args->>'background'; av:=nullif(args->>'avatar_path',''); bp:=nullif(args->>'background_path','');
  if jsonb_typeof(args->'card_enabled') is distinct from 'boolean' or bg is null or bg not in ('noir','sakura','night','moon','ice','gold','custom')
     or ((bg='custom') is distinct from (bp is not null))
     or not komi_profile_extras_private.valid_photo(actor,av) or not komi_profile_extras_private.valid_photo(actor,bp) then
   raise exception 'Invalid card settings' using errcode='22023';
  end if;
  enabled:=(args->>'card_enabled')::boolean;
  selected_cursor:=nullif(args->>'cursor_id','');
  selected_effect:=nullif(args->>'effect_id','');
  if selected_cursor is not null and not exists(select 1 from komi_profile_extras_private.purchases p
    join komi_profile_extras_private.products c on c.id=p.item_id
    where p.user_id=actor and p.item_id=selected_cursor and c.kind='cursor') then
   raise exception 'Cursor not owned' using errcode='42501';
  end if;
  if selected_effect is not null and not exists(select 1 from komi_profile_extras_private.purchases p
    join komi_profile_extras_private.products c on c.id=p.item_id
    where p.user_id=actor and p.item_id=selected_effect and c.kind='effect') then
   raise exception 'Card effect not owned' using errcode='42501';
  end if;
  update komi_profile_extras_private.appearance set background=bg,avatar_path=av,background_path=bp,card_enabled=enabled,
    cursor_id=selected_cursor,effect_id=selected_effect where user_id=actor;
 elsif p_action='claim' then
  select * into medal from komi_profile_extras_private.medal_catalog m where m.id=args->>'medal_id';
  stats:=komi_profile_extras_private.stats(actor);
  if medal.id is null or coalesce((stats->>medal.metric)::bigint,0)<medal.target then raise exception 'Medal not earned' using errcode='22023'; end if;
  insert into komi_profile_extras_private.medals(user_id,medal_id) values(actor,medal.id) on conflict do nothing;
  get diagnostics changed=row_count;
  if changed=1 then awarded:=medal.id; end if;
 elsif p_action='pin' then
  item:=args->>'medal_id';
  if item is not null and not exists(select 1 from komi_profile_extras_private.medals m where m.user_id=actor and m.medal_id=item) then
   raise exception 'Medal not owned' using errcode='42501'; end if;
  update komi_profile_extras_private.appearance set medal_id=item where user_id=actor;
 end if;
 stats:=komi_profile_extras_private.stats(actor);
 select * into ap from komi_profile_extras_private.appearance a where a.user_id=actor;
 select w.balance into balance from public.komi_anicoin_wallets w where w.user_id=actor;
 return jsonb_build_object('revision','20261127-profile-extras-v1','balance',coalesce(balance,0),'new_medal',awarded,'stats',stats,
 'owned',coalesce((select jsonb_agg(p.item_id order by p.item_id) from komi_profile_extras_private.purchases p where p.user_id=actor),'[]'::jsonb),
 'medals',coalesce((select jsonb_agg(jsonb_build_object('id',m.medal_id,'awarded_at',m.awarded_at) order by m.awarded_at desc,m.medal_id) from komi_profile_extras_private.medals m where m.user_id=actor),'[]'::jsonb),
 'appearance',jsonb_build_object('cursor_id',ap.cursor_id,'effect_id',ap.effect_id,'medal_id',ap.medal_id,'card_enabled',coalesce(ap.card_enabled,false),'background',coalesce(ap.background,'noir'),'avatar_path',ap.avatar_path,'background_path',ap.background_path));
end $$;
revoke all on function komi_profile_extras_private.action(text,jsonb) from public,anon,authenticated;
grant execute on function komi_profile_extras_private.action(text,jsonb) to authenticated;
create function public.komi_profile_extras(p_action text,p_args jsonb default '{}'::jsonb)
returns jsonb language sql security invoker set search_path='' as $$
 select komi_profile_extras_private.action(p_action,p_args)
$$;
revoke all on function public.komi_profile_extras(text,jsonb) from public,anon,authenticated;
grant execute on function public.komi_profile_extras(text,jsonb) to authenticated;
commit;
