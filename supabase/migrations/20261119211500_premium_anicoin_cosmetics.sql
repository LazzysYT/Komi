-- Separate Premium AniCoin cosmetics store. No changes to the existing free shop or payment flows.
create table if not exists komi_private.premium_store_purchases (
 user_id uuid not null references auth.users(id) on delete cascade,
 item_id text not null check(item_id in ('frame_moon','frame_aurora','title_cinema','title_starlight')),
 purchased_at timestamptz not null default now(),
 price integer not null check(price between 1 and 100),
 primary key(user_id,item_id)
);
create table if not exists public.komi_premium_cosmetic_equips (
 user_id uuid primary key references auth.users(id) on delete cascade,
 frame_id text check(frame_id in ('frame_moon','frame_aurora')),
 title_id text check(title_id in ('title_cinema','title_starlight')),
 updated_at timestamptz not null default now()
);
alter table komi_private.premium_store_purchases enable row level security;
alter table public.komi_premium_cosmetic_equips enable row level security;
revoke all on komi_private.premium_store_purchases from public,anon,authenticated;
revoke all on public.komi_premium_cosmetic_equips from public,anon,authenticated;
grant select(user_id,frame_id,title_id) on public.komi_premium_cosmetic_equips to anon,authenticated;
create policy "Active Premium cosmetics public display" on public.komi_premium_cosmetic_equips
 for select to anon,authenticated using(
   exists(select 1 from public.komi_premium_badges b
          where b.user_id=komi_premium_cosmetic_equips.user_id and b.active_until>now())
 );

create or replace function public.komi_premium_store(
 p_action text default 'read',
 p_item text default null
) returns jsonb language plpgsql security definer set search_path=''
as $fn$
declare
 actor uuid:=auth.uid();
 cost integer;
 wallet public.komi_anicoin_wallets%rowtype;
 owned jsonb;
 equip public.komi_premium_cosmetic_equips%rowtype;
begin
 if actor is null or not exists(
   select 1 from auth.users u
   where u.id=actor and u.deleted_at is null and u.is_anonymous is not true
 ) then raise exception 'Verified account required' using errcode='42501'; end if;
 if not exists(select 1 from public.komi_premium_badges b
               where b.user_id=actor and b.active_until>now()) then
    raise exception 'Premium subscription required' using errcode='42501';
 end if;
 if p_action not in ('read','buy','equip') or p_action is null then
    raise exception 'Unsupported store action' using errcode='22023';
 end if;
 cost:=case p_item when 'frame_moon' then 30
                   when 'frame_aurora' then 45
                   when 'title_cinema' then 20
                   when 'title_starlight' then 25
                   else null end;
 if p_action<>'read' and cost is null then
    raise exception 'Unknown Premium item' using errcode='22023'; end if;
 insert into public.komi_anicoin_wallets(user_id) values(actor) on conflict do nothing;
 select * into wallet from public.komi_anicoin_wallets where user_id=actor for update;
 if p_action='buy' then
   if exists(select 1 from komi_private.premium_store_purchases p
             where p.user_id=actor and p.item_id=p_item) then
     raise exception 'Item already purchased' using errcode='22023'; end if;
   if wallet.balance<cost then
     raise exception 'Not enough AniCoin' using errcode='22023'; end if;
   insert into komi_private.premium_store_purchases(user_id,item_id,price)
   values(actor,p_item,cost);
   update public.komi_anicoin_wallets set balance=balance-cost
   where user_id=actor returning * into wallet;
 elsif p_action='equip' then
   if not exists(select 1 from komi_private.premium_store_purchases p
                 where p.user_id=actor and p.item_id=p_item) then
     raise exception 'Purchase required before equipping' using errcode='42501'; end if;
   if p_item like 'frame_%' then
     insert into public.komi_premium_cosmetic_equips(user_id,frame_id) values(actor,p_item)
     on conflict(user_id) do update set frame_id=excluded.frame_id,updated_at=now();
   else
     insert into public.komi_premium_cosmetic_equips(user_id,title_id) values(actor,p_item)
     on conflict(user_id) do update set title_id=excluded.title_id,updated_at=now();
   end if;
 end if;
 select coalesce(jsonb_agg(p.item_id order by p.item_id),'[]'::jsonb) into owned
 from komi_private.premium_store_purchases p where p.user_id=actor;
 select * into equip from public.komi_premium_cosmetic_equips where user_id=actor;
 return jsonb_build_object('balance',wallet.balance,'owned',coalesce(owned,'[]'::jsonb),
   'frame_id',equip.frame_id,'title_id',equip.title_id);
end $fn$;
revoke all on function public.komi_premium_store(text,text) from public,anon,authenticated;
grant execute on function public.komi_premium_store(text,text) to authenticated;
