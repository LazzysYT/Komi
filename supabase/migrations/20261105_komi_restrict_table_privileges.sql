-- Second additive migration, applied 2026-11-05.
-- Remove broad default grants, including TRUNCATE, TRIGGER and REFERENCES (not governed by RLS).
revoke all privileges on table public.komi_profiles, public.komi_friend_requests, public.komi_friendships, public.komi_notifications, public.komi_watch_progress, public.komi_anime_lists from anon, authenticated;
grant select,insert on public.komi_profiles to authenticated;
grant update (username,display_name,avatar_url,bio) on public.komi_profiles to authenticated;
grant select,insert on public.komi_friend_requests to authenticated;
grant select on public.komi_friendships to authenticated;
grant select on public.komi_notifications to authenticated;
grant select,insert,update,delete on public.komi_watch_progress to authenticated;
grant select,insert,update,delete on public.komi_anime_lists to authenticated;
