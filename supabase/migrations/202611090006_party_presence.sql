-- Presence is separate from the invited guest list. No existing room data is changed.
create table if not exists public.komi_party_presence (
  room_id uuid not null references public.komi_party_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  last_seen timestamptz not null default now(),
  primary key (room_id, user_id)
);
create index if not exists komi_party_presence_recent on public.komi_party_presence (room_id, last_seen desc);
alter table public.komi_party_presence enable row level security;
revoke all on public.komi_party_presence from public, anon, authenticated;

create or replace function public.komi_party_presence(p_room_id uuid, p_action text default 'touch')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  room public.komi_party_rooms;
  members jsonb;
  stamp timestamptz := clock_timestamp();
begin
  if actor is null then raise exception 'Sign in required'; end if;
  select * into room from public.komi_party_rooms
    where id = p_room_id and touched_at > stamp - interval '2 minutes';
  if not found then raise exception 'Room closed'; end if;
  if room.host <> actor and room.private and not (actor = any(room.guests)) then
    raise exception 'Room access denied';
  end if;
  if p_action = 'touch' then
    insert into public.komi_party_presence(room_id, user_id, last_seen)
    values(p_room_id, actor, stamp)
    on conflict(room_id, user_id) do update set last_seen = excluded.last_seen;
  elsif p_action = 'leave' then
    delete from public.komi_party_presence
    where room_id = p_room_id and user_id = actor;
  else
    raise exception 'Unknown action';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', m.user_id,
    'username', coalesce(p.username, 'Участник'),
    'displayName', coalesce(nullif(p.display_name, ''), p.username, 'Участник'),
    'avatar', p.avatar_url,
    'host', m.user_id = room.host
  ) order by (m.user_id <> room.host), m.last_seen desc), '[]'::jsonb)
  into members
  from public.komi_party_presence m
  left join public.komi_profiles p on p.user_id = m.user_id
  where m.room_id = p_room_id and m.last_seen >= stamp - interval '30 seconds';
  return members;
end; $$;
revoke all on function public.komi_party_presence(uuid,text) from public, anon;
grant execute on function public.komi_party_presence(uuid,text) to authenticated;
