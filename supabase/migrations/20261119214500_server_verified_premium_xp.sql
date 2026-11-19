-- Compute the profile XP total from authenticated database records, never from client-supplied numbers.
-- Replaces no existing XP data, payment logic or Premium welcome grants.
create or replace function public.komi_verified_xp()
returns jsonb language plpgsql stable security definer set search_path=''
as $fn$
declare
 actor uuid:=auth.uid();
 watched_count integer; watching_count integer; friend_count integer;
 base_xp integer; welcome_xp integer; quest_xp integer; total_xp integer;
 premium_active boolean;
begin
 if actor is null or not exists(
   select 1 from auth.users u where u.id=actor and u.deleted_at is null
   and u.is_anonymous is not true
 ) then raise exception 'Authenticated account required' using errcode='42501'; end if;
 select count(*) filter(where l.status='Просмотрено')::integer,
        count(*) filter(where l.status='Смотрю')::integer
 into watched_count,watching_count
 from public.komi_anime_lists l
 join public.anime_catalog c on c.shikimori_id=l.anime_id
 where l.user_id=actor;
 select count(*)::integer into friend_count from public.komi_friendships f
  where f.user_a=actor or f.user_b=actor;
 base_xp:=watched_count*100+watching_count*20+friend_count*15;
 premium_active:=exists(select 1 from public.komi_premium_badges p
   where p.user_id=actor and p.active_until>now());
 select coalesce(sum(r.xp_awarded),0)::integer into welcome_xp
 from public.komi_premium_rewards r where r.user_id=actor;
 select coalesce(sum(q.xp_awarded),0)::integer into quest_xp
 from komi_private.daily_quest_claims q where q.user_id=actor;
 -- Claim XP was already server-multiplied at award time. Never multiply gift XP.
 total_xp:=(case when premium_active then base_xp*3/2 else base_xp end)
   +welcome_xp+quest_xp;
 return jsonb_build_object(
  'xp',total_xp,'base_xp',base_xp,'welcome_xp',welcome_xp,
  'quest_xp',quest_xp,'premium_multiplier',case when premium_active then 1.5 else 1 end,
  'level',total_xp/500+1,
  'watched',watched_count,'watching',watching_count,'friends',friend_count
 );
end $fn$;
revoke all on function public.komi_verified_xp() from public,anon,authenticated;
grant execute on function public.komi_verified_xp() to authenticated;
