-- Applied on Supabase as migration 20261112135133 (private_watched_episode_markers).
-- Dedicated private watch completion history. Does not replace or modify komi_watch_progress.
create table public.komi_watched_episodes (
  user_id uuid not null references auth.users(id) on delete cascade,
  anime_id bigint not null check (anime_id > 0),
  season integer not null check (season between 1 and 1000),
  episode_index integer not null check (episode_index between 0 and 9999),
  watched_at timestamptz not null default now(),
  primary key (user_id, anime_id, season, episode_index)
);
alter table public.komi_watched_episodes enable row level security;
revoke all on public.komi_watched_episodes from public, anon, authenticated;
grant select, insert on public.komi_watched_episodes to authenticated;
create policy "Users read only their watched episodes"
  on public.komi_watched_episodes for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Users mark only their watched episodes"
  on public.komi_watched_episodes for insert to authenticated
  with check (user_id = (select auth.uid()));
comment on table public.komi_watched_episodes is
  'Private immutable per-episode completion markers. Never used for AniCoin awards or authorization.';
