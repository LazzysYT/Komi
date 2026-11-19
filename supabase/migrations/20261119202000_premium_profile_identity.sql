-- Cosmetic Premium profiles only; separate from billing and one-time bonuses.
create table if not exists public.komi_premium_profile_prefs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nick_theme smallint not null default 0 check(nick_theme between 0 and 5),
  status_emoji text not null default '' check(status_emoji in ('','✨','🌙','🎬','⭐','🔥','💫')),
  music_theme smallint not null default 0 check(music_theme between 0 and 2),
  updated_at timestamptz not null default now()
);
alter table public.komi_premium_profile_prefs enable row level security;
revoke all on public.komi_premium_profile_prefs from public,anon,authenticated;
grant select(user_id,nick_theme,status_emoji,music_theme) on public.komi_premium_profile_prefs to anon,authenticated;
grant insert(user_id,nick_theme,status_emoji,music_theme) on public.komi_premium_profile_prefs to authenticated;
grant update(nick_theme,status_emoji,music_theme) on public.komi_premium_profile_prefs to authenticated;
create policy "Active Premium identity visible to community" on public.komi_premium_profile_prefs
 for select to anon,authenticated using (
   exists(select 1 from public.komi_premium_badges b
          where b.user_id=komi_premium_profile_prefs.user_id and b.active_until>now())
 );
create policy "Active Premium can create own identity" on public.komi_premium_profile_prefs
 for insert to authenticated with check(
   user_id=(select auth.uid()) and
   exists(select 1 from public.komi_premium_badges b
          where b.user_id=(select auth.uid()) and b.active_until>now())
 );
create policy "Active Premium can edit own identity" on public.komi_premium_profile_prefs
 for update to authenticated
 using(user_id=(select auth.uid()) and exists(
   select 1 from public.komi_premium_badges b
   where b.user_id=(select auth.uid()) and b.active_until>now()))
 with check(user_id=(select auth.uid()) and exists(
   select 1 from public.komi_premium_badges b
   where b.user_id=(select auth.uid()) and b.active_until>now()));
