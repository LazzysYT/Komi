-- Preserve all existing title-wide comments. Only new episode discussions
-- receive a stable season/episode number; voice-over source indices are not IDs.
-- Existing RLS, author-assignment/cooldown triggers and grants stay unchanged.

alter table public.komi_comments
  add column season integer,
  add column episode_number integer,
  add constraint komi_comments_episode_scope_check check (
    (season is null and episode_number is null)
    or (
      season is not null and episode_number is not null
      and season between 1 and 9999
      and episode_number between 1 and 99999
    )
  );

create index komi_comments_episode_newest_idx
  on public.komi_comments (anime_id, season, episode_number, created_at desc, id desc);

comment on column public.komi_comments.season is
  'Season number of an episode discussion; NULL together with episode_number for title-wide comments.';
comment on column public.komi_comments.episode_number is
  'Public episode number within the season, independent of voice-over/source array indices; NULL for title-wide comments.';
