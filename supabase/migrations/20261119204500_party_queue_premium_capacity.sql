-- Watch Party additions: Premium rooms have 10 reserved seats; free/legacy rooms stay unchanged.
-- Secure server queue with host-only updates and room-level permission checks.
alter table public.komi_party_rooms
 add column if not exists max_participants smallint not null default 0
 check (max_participants=0 or max_participants between 2 and 10);

create or replace function komi_private.party_capacity_rule()
returns trigger language plpgsql security definer set search_path=''
as $fn$
begin
 if tg_op='INSERT' then
   new.max_participants:=case when exists(
     select 1 from public.komi_premium_badges b
     where b.user_id=new.host and b.active_until>now()
   ) then 10 else 0 end;
 else
   new.max_participants:=old.max_participants;
 end if;
 return new;
end $fn$;
revoke all on function komi_private.party_capacity_rule() from public,anon,authenticated;
drop trigger if exists trg_komi_party_capacity_rule on public.komi_party_rooms;
create trigger trg_komi_party_capacity_rule
 before insert or update of max_participants on public.komi_party_rooms
 for each row execute function komi_private.party_capacity_rule();

create or replace function komi_private.party_reject_extra_members()
returns trigger language plpgsql security definer set search_path=''
as $fn$
declare room public.komi_party_rooms; current_count integer; host_active boolean;
begin
 select * into room from public.komi_party_rooms where id=new.room_id for update;
 if not found then raise exception 'Room closed'; end if;
 if room.max_participants=0 then return new; end if;
 -- Existing active member refreshes are never blocked.
 if exists(select 1 from public.komi_party_presence p
           where p.room_id=new.room_id and p.user_id=new.user_id
           and p.last_seen>clock_timestamp()-interval '30 seconds') then return new; end if;
 select count(*),coalesce(bool_or(p.user_id=room.host),false)
   into current_count,host_active
 from public.komi_party_presence p
 where p.room_id=new.room_id and p.last_seen>clock_timestamp()-interval '30 seconds';
 if new.user_id<>room.host and current_count+(case when host_active then 0 else 1 end)>=room.max_participants then
   raise exception 'Premium room is full (10 participants)' using errcode='P0001';
 end if;
 return new;
end $fn$;
revoke all on function komi_private.party_reject_extra_members() from public,anon,authenticated;
drop trigger if exists trg_komi_party_limit_on_presence on public.komi_party_presence;
create trigger trg_komi_party_limit_on_presence
 before insert or update of last_seen on public.komi_party_presence
 for each row execute function komi_private.party_reject_extra_members();

create table if not exists komi_private.party_queue_entries (
  id bigint generated always as identity primary key,
  room_id uuid not null references public.komi_party_rooms(id) on delete cascade,
  episode integer not null check(episode between 0 and 9999),
  source text not null check(length(source) between 1 and 120),
  added_at timestamptz not null default now()
);
create index if not exists komi_party_queue_order on komi_private.party_queue_entries(room_id,id);
alter table komi_private.party_queue_entries enable row level security;
revoke all on komi_private.party_queue_entries from public,anon,authenticated;

create or replace function public.komi_party_queue(
 p_room_id uuid,
 p_action text default 'read',
 p_episode integer default null,
 p_source text default null,
 p_entry_id bigint default null
) returns jsonb language plpgsql security definer set search_path=''
as $fn$
declare actor uuid:=auth.uid(); stamp timestamptz:=clock_timestamp();
 room public.komi_party_rooms; next_item komi_private.party_queue_entries;
 entries jsonb;
begin
 if actor is null or p_room_id is null then raise exception 'Sign in and room required' using errcode='42501'; end if;
 if p_action is null or p_action not in ('read','add','remove','next') then
   raise exception 'Invalid queue operation' using errcode='22023'; end if;
 select * into room from public.komi_party_rooms where id=p_room_id for update;
 if not found or room.touched_at<stamp-interval '2 minutes' then
   raise exception 'Room closed' using errcode='22023'; end if;
 if room.private and actor<>room.host
    and not komi_private.party_invite_is_valid(room.id,actor,stamp) then
   raise exception 'Room access denied' using errcode='42501'; end if;
 if p_action<>'read' and actor<>room.host then
   raise exception 'Only host can edit queue' using errcode='42501'; end if;
 if p_action='add' then
   if p_episode is null or p_episode not between 0 and 9999 or
      p_source is null or length(btrim(p_source)) not between 1 and 120 then
      raise exception 'Invalid episode choice' using errcode='22023'; end if;
   if (select count(*) from komi_private.party_queue_entries where room_id=p_room_id)>=30 then
      raise exception 'Queue is full' using errcode='22023'; end if;
   insert into komi_private.party_queue_entries(room_id,episode,source)
     values(p_room_id,p_episode,btrim(p_source));
 elsif p_action='remove' then
   delete from komi_private.party_queue_entries
    where room_id=p_room_id and id=p_entry_id;
 elsif p_action='next' then
   select * into next_item from komi_private.party_queue_entries
    where room_id=p_room_id order by id limit 1 for update;
   if found then
     delete from komi_private.party_queue_entries where id=next_item.id;
     update public.komi_party_rooms set episode=next_item.episode,
       source=next_item.source,position=0,playing=false,
       changed_at=stamp,touched_at=stamp where id=p_room_id;
   end if;
 end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'episode',q.episode,
         'source',q.source) order by q.id),'[]'::jsonb) into entries
 from komi_private.party_queue_entries q where q.room_id=p_room_id;
 return jsonb_build_object('items',entries,'max_participants',room.max_participants);
end $fn$;
revoke all on function public.komi_party_queue(uuid,text,integer,text,bigint)
 from public,anon,authenticated;
grant execute on function public.komi_party_queue(uuid,text,integer,text,bigint) to authenticated;
