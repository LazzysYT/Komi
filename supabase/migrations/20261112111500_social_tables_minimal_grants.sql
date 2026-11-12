-- Restore least-privilege grants for browser-accessible social tables.
-- RLS does not apply to TRUNCATE; neither browser role may have this privilege.
-- The old blanket grants also gave anon the ability to attempt writes to favorites.
-- These statements DO NOT remove or rewrite any user rows.

revoke all privileges on table public.komi_comments
  from public, anon, authenticated;
revoke all privileges on table public.komi_favorites
  from public, anon, authenticated;

-- Public comments are intended to be visible without signing in.
grant select on table public.komi_comments to anon, authenticated;
grant insert, delete on table public.komi_comments to authenticated;

-- Favorites are private. The authenticated role still needs CRUD,
-- with existing owner-scoped RLS policies restricting individual rows.
grant select, insert, update, delete on table public.komi_favorites
  to authenticated;
