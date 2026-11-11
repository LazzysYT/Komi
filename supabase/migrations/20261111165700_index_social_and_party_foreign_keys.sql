-- Preserve all existing rows and RLS policies. These indexes cover the
-- foreign keys flagged by Supabase Database Advisor on 2026-11-11.
-- The recipient index additionally supports the newest-notification lookup.
create index if not exists komi_site_presence_user_idx
    on komi_private.site_presence (user_id);
create index if not exists komi_comments_author_idx
    on public.komi_comments (user_id);
create index if not exists komi_friend_requests_recipient_idx
    on public.komi_friend_requests (receiver_id);
create index if not exists komi_friend_requests_sender_idx
    on public.komi_friend_requests (sender_id);
create index if not exists komi_friendships_user_b_idx
    on public.komi_friendships (user_b);
create index if not exists komi_notifications_actor_idx
    on public.komi_notifications (actor_id);
create index if not exists komi_notifications_recipient_newest_idx
    on public.komi_notifications (recipient_id, id desc);
create index if not exists komi_party_presence_user_idx
    on public.komi_party_presence (user_id);
create index if not exists komi_party_rooms_host_idx
    on public.komi_party_rooms (host);
