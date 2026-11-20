-- Server-scored opening quiz for authenticated members of Watch Party rooms.
-- No copyrighted tracks are inserted. Admin must curate legally licensed audio.
create table if not exists komi_private.party_quiz_rounds(
 room_id uuid primary key references public.komi_party_rooms(id) on delete cascade,
 track_id bigint not null references public.komi_opening_tracks(id),
 round_index smallint not null default 1 check(round_index between 1 and 5),
 total_rounds smallint not null default 3 check(total_rounds between 3 and 5),
 used_tracks bigint[] not null default '{}',
 started_at timestamptz not null default now(),
 finished_at timestamptz
);
create table if not exists komi_private.party_quiz_scores(
 room_id uuid not null references public.komi_party_rooms(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 points smallint not null default 0 check(points between 0 and 5),
 answered_round smallint not null default 0 check(answered_round between 0 and 5),
 primary key(room_id,user_id)
);
alter table komi_private.party_quiz_rounds enable row level security;
alter table komi_private.party_quiz_scores enable row level security;
revoke all on komi_private.party_quiz_rounds,komi_private.party_quiz_scores from public,anon,authenticated;
-- Audio/answer mapping must not be queried from the browser outside the room RPC.
revoke select on public.komi_opening_tracks from authenticated;

create or replace function public.komi_party_quiz(
 p_action text,p_room uuid,p_guess bigint default null,p_rounds integer default 3
) returns jsonb language plpgsql security definer set search_path=''
as $fn$
declare v_user uuid:=auth.uid(); v_room public.komi_party_rooms%rowtype;
 v_quiz komi_private.party_quiz_rounds%rowtype;
 v_track public.komi_opening_tracks%rowtype; v_scores jsonb;
 v_count integer; v_correct boolean:=false; v_finished boolean;
begin
 if v_user is null or not exists(select 1 from auth.users u where u.id=v_user and u.is_anonymous is not true and u.deleted_at is null)
 then raise exception 'Sign in to play' using errcode='42501'; end if;
 select * into v_room from public.komi_party_rooms where id=p_room;
 if v_room.id is null or not (v_room.host=v_user or v_user=any(v_room.guests))
 then raise exception 'Not in this room' using errcode='42501'; end if;
 if p_action not in ('read','start','next','guess') then raise exception 'Invalid quiz action' using errcode='22023'; end if;
 if p_action in ('start','next') then
   if v_room.host<>v_user then raise exception 'Only host can start rounds' using errcode='42501'; end if;
   select count(*) into v_count from public.komi_opening_tracks where enabled;
   if v_count<3 then raise exception 'Add at least 3 licensed opening tracks first' using errcode='22023'; end if;
   select * into v_quiz from komi_private.party_quiz_rounds where room_id=p_room for update;
   if p_action='start' then
     if p_rounds not between 3 and 5 or v_count<p_rounds then raise exception 'Insufficient tracks' using errcode='22023'; end if;
     select * into v_track from public.komi_opening_tracks where enabled order by random() limit 1;
     insert into komi_private.party_quiz_rounds(room_id,track_id,round_index,total_rounds,used_tracks,started_at,finished_at)
      values(p_room,v_track.id,1,p_rounds,array[v_track.id],now(),null)
      on conflict(room_id) do update set track_id=excluded.track_id,round_index=1,total_rounds=excluded.total_rounds,
      used_tracks=excluded.used_tracks,started_at=now(),finished_at=null;
     delete from komi_private.party_quiz_scores where room_id=p_room;
   else
     if v_quiz.room_id is null or v_quiz.finished_at is not null then raise exception 'Start a quiz first' using errcode='22023'; end if;
     if now() < v_quiz.started_at + interval '40 seconds' then raise exception 'Round is still running' using errcode='22023'; end if;
     if v_quiz.round_index >= v_quiz.total_rounds then
       update komi_private.party_quiz_rounds set finished_at=now() where room_id=p_room;
     else
       select * into v_track from public.komi_opening_tracks
         where enabled and not (id=any(v_quiz.used_tracks)) order by random() limit 1;
       if v_track.id is null then raise exception 'No unused licensed track' using errcode='22023'; end if;
       update komi_private.party_quiz_rounds set
         track_id=v_track.id,round_index=v_quiz.round_index+1,
         used_tracks=array_append(v_quiz.used_tracks,v_track.id),started_at=now()
         where room_id=p_room;
     end if;
   end if;
 end if;
 select * into v_quiz from komi_private.party_quiz_rounds where room_id=p_room;
 if v_quiz.room_id is null then return jsonb_build_object('active',false,'round',0); end if;
 select * into v_track from public.komi_opening_tracks where id=v_quiz.track_id;
 v_finished:=v_quiz.finished_at is not null;
 if p_action='guess' then
   if v_finished or now()>=v_quiz.started_at+interval '40 seconds'
   then raise exception 'Round expired' using errcode='22023'; end if;
   if p_guess is null or p_guess<=0 then raise exception 'Choose an anime' using errcode='22023'; end if;
   v_correct:=p_guess=v_track.anime_id;
   insert into komi_private.party_quiz_scores(room_id,user_id,points,answered_round)
   values(p_room,v_user,case when v_correct then 1 else 0 end,v_quiz.round_index)
   on conflict(room_id,user_id) do update
     set points=komi_private.party_quiz_scores.points+excluded.points,answered_round=excluded.answered_round
     where komi_private.party_quiz_scores.answered_round<excluded.answered_round;
 end if;
 select coalesce(jsonb_agg(jsonb_build_object('name',coalesce(nullif(p.display_name,''),p.username,'Участник'),
 'points',s.points) order by s.points desc),'[]'::jsonb)
 into v_scores from komi_private.party_quiz_scores s
 left join public.komi_profiles p on p.user_id=s.user_id where s.room_id=p_room;
 return jsonb_build_object(
  'active',not v_finished,'round',v_quiz.round_index,'rounds',v_quiz.total_rounds,
  'deadline',v_quiz.started_at+interval '40 seconds',
  'audio_url',case when not v_finished then v_track.audio_url else null end,
  'answer_id',case when v_finished or now()>=v_quiz.started_at+interval '40 seconds' then v_track.anime_id else null end,
  'scores',v_scores
 );
end $fn$;
revoke all on function public.komi_party_quiz(text,uuid,bigint,integer) from public,anon,authenticated;
grant execute on function public.komi_party_quiz(text,uuid,bigint,integer) to authenticated;
