begin;
create table public.komi_party_rooms (
  id uuid primary key default gen_random_uuid(),
  host uuid not null references auth.users on delete cascade,
  name text not null check (length(name) between 1 and 100),
  anime_id text not null,
  private boolean not null,
  episode integer not null default 0,
  source text not null default '',
  position double precision not null default 0,
  playing boolean not null default false,
  changed_at timestamptz not null default now(),
  touched_at timestamptz not null default now(),
  messages jsonb not null default '[]',
  guests uuid[] not null default '{}'
);
alter table public.komi_party_rooms enable row level security;
revoke all on public.komi_party_rooms from public, anon, authenticated;

create function public.komi_party(action text, room_id uuid default null, args jsonb default '{}')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  room public.komi_party_rooms;
  result jsonb;
  stamp timestamptz := clock_timestamp();
  guest uuid;
begin
  if actor is null then raise exception 'Sign in required'; end if;
  if action = 'list' then
    select coalesce(jsonb_agg(to_jsonb(r) - 'guests' - 'messages'), '[]'::jsonb) into result
    from (select * from public.komi_party_rooms
          where touched_at > stamp - interval '2 minutes'
            and (not private or host = actor or actor = any(guests))
          order by touched_at desc limit 50) r;
    return result;
  end if;
  if action = 'create' then
    perform pg_advisory_xact_lock(hashtextextended(actor::text, 0));
    delete from public.komi_party_rooms where host = actor or touched_at < stamp - interval '1 day';
    insert into public.komi_party_rooms(host, name, anime_id, private, episode, source)
    values (actor, left(args->>'name', 100), args->>'animeId', coalesce((args->>'private')::boolean,false),
            greatest(0, (args->>'episode')::integer), left(args->>'source', 120))
    returning * into room;
  else
    select * into room from public.komi_party_rooms r where r.id = room_id for update;
    if not found or room.touched_at <= stamp - interval '2 minutes' then
      raise exception 'Room closed';
    end if;
    if room.host <> actor and (action not in ('read', 'chat') or (room.private and not actor = any(room.guests))) then
      raise exception 'Room access denied';
    end if;
    case action
      when 'read' then null;
      when 'chat' then
        if coalesce(length(trim(args->>'message')),0) not between 1 and 300 then
          raise exception 'Invalid message';
        end if;
        update public.komi_party_rooms set messages =
          (case when jsonb_array_length(messages) >= 50 then messages - 0 else messages end)
          || jsonb_build_array(jsonb_build_object('author',
              coalesce((select username from public.komi_profiles where user_id = actor),'Участник'),
              'text',trim(args->>'message')))
          where id = room_id returning * into room;
      when 'heartbeat' then
        update public.komi_party_rooms set touched_at = stamp where id = room_id returning * into room;
      when 'state' then
        update public.komi_party_rooms set episode = greatest(0,(args->>'episode')::integer),
          source = left(args->>'source',120), position = greatest(0,least(86400,(args->>'position')::double precision)),
          playing = (args->>'playing')::boolean, changed_at = stamp, touched_at = stamp
          where id = room_id returning * into room;
      when 'invite' then
        select user_id into guest from public.komi_profiles where lower(username) = lower(args->>'username');
        if guest is null then raise exception 'User not found'; end if;
        update public.komi_party_rooms set guests = array_append(guests, guest)
          where id = room_id and not guest = any(guests);
      when 'close' then
        delete from public.komi_party_rooms where id = room_id;
        return null;
      else raise exception 'Unknown action';
    end case;
  end if;
  return (to_jsonb(room) - 'guests') || jsonb_build_object('server_now', stamp);
end;
$$;
revoke all on function public.komi_party(text, uuid, jsonb) from public, anon;
grant execute on function public.komi_party(text, uuid, jsonb) to authenticated;
commit;
