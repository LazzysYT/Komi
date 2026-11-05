-- Komi Anime Hub: additive, non-destructive schema (phase 1).
-- Review and run in Supabase SQL Editor only after taking a database backup.
-- Existing animes/anime_catalog tables are intentionally untouched.
create table if not exists public.komi_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[A-Za-z0-9_]{3,24}$'),
  display_name text not null default '',
  avatar_url text,
  bio text not null default '',
  created_at timestamptz not null default now()
);
create table if not exists public.komi_friend_requests (
  id bigint generated always as identity primary key,
  sender_id uuid not null references auth.users(id) on delete cascade,
  receiver_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint komi_friend_requests_distinct check (sender_id <> receiver_id)
);
create unique index if not exists komi_pending_friend_pair
  on public.komi_friend_requests (least(sender_id,receiver_id), greatest(sender_id,receiver_id))
  where status = 'pending';
create table if not exists public.komi_friendships (
  user_a uuid not null references auth.users(id) on delete cascade,
  user_b uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_a,user_b),
  constraint komi_friendships_sorted check (user_a < user_b)
);
create table if not exists public.komi_watch_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  anime_id bigint not null,
  season integer not null default 1 check (season >= 1),
  episode_index integer not null default 0 check (episode_index >= 0),
  position_seconds numeric not null default 0 check (position_seconds >= 0),
  duration_seconds numeric not null default 0 check (duration_seconds >= 0),
  updated_at timestamptz not null default now(),
  primary key(user_id,anime_id)
);
create table if not exists public.komi_anime_lists (
  user_id uuid not null references auth.users(id) on delete cascade,
  anime_id bigint not null,
  status text not null check (status in ('Просмотрено','В планах','Смотрю','Отложено','Брошено')),
  updated_at timestamptz not null default now(),
  primary key(user_id,anime_id)
);
create table if not exists public.komi_notifications (
  id bigint generated always as identity primary key,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  kind text not null check (kind in ('friend_request','friend_accepted','system')),
  message text not null default '',
  read_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.komi_profiles enable row level security;
alter table public.komi_friend_requests enable row level security;
alter table public.komi_friendships enable row level security;
alter table public.komi_watch_progress enable row level security;
alter table public.komi_anime_lists enable row level security;
alter table public.komi_notifications enable row level security;
drop policy if exists "komi profiles read" on public.komi_profiles;
create policy "komi profiles read" on public.komi_profiles for select to authenticated using (true);
drop policy if exists "komi profiles insert own" on public.komi_profiles;
create policy "komi profiles insert own" on public.komi_profiles for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "komi profiles update own" on public.komi_profiles;
create policy "komi profiles update own" on public.komi_profiles for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "komi requests read involved" on public.komi_friend_requests;
create policy "komi requests read involved" on public.komi_friend_requests for select to authenticated using (sender_id = (select auth.uid()) or receiver_id = (select auth.uid()));
drop policy if exists "komi requests send own" on public.komi_friend_requests;
create policy "komi requests send own" on public.komi_friend_requests for insert to authenticated with check (sender_id = (select auth.uid()) and status = 'pending' and responded_at is null);
-- Friend acceptance and friendship creation are intentionally server-only.
-- Do not add client INSERT/UPDATE policies to friendships or request status.
drop policy if exists "komi friendships read involved" on public.komi_friendships;
create policy "komi friendships read involved" on public.komi_friendships for select to authenticated using (user_a = (select auth.uid()) or user_b = (select auth.uid()));
drop policy if exists "komi progress own" on public.komi_watch_progress;
create policy "komi progress own" on public.komi_watch_progress for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "komi lists own" on public.komi_anime_lists;
create policy "komi lists own" on public.komi_anime_lists for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "komi notifications read own" on public.komi_notifications;
create policy "komi notifications read own" on public.komi_notifications for select to authenticated using (recipient_id = (select auth.uid()));
drop policy if exists "komi notifications mark read own" on public.komi_notifications;
create policy "komi notifications mark read own" on public.komi_notifications for update to authenticated using (recipient_id = (select auth.uid())) with check (recipient_id = (select auth.uid()));
-- Important: notifications UPDATE policy above is not column-restricted;
-- before enabling client updates, revoke table UPDATE and expose a narrow RPC.
revoke update on public.komi_notifications from authenticated;
-- No automatic migration of legacy username/password records: ownership must be verified.

-- Explicit Data API privileges, with RLS governing row access.
grant usage on schema public to authenticated;
grant select,insert,update on public.komi_profiles to authenticated;
grant select,insert on public.komi_friend_requests to authenticated;
grant select on public.komi_friendships to authenticated;
grant select,insert,update,delete on public.komi_watch_progress to authenticated;
grant select,insert,update,delete on public.komi_anime_lists to authenticated;
grant select on public.komi_notifications to authenticated;
grant usage,select on sequence public.komi_friend_requests_id_seq to authenticated;
revoke all on public.komi_profiles,public.komi_friend_requests,public.komi_friendships,public.komi_watch_progress,public.komi_anime_lists,public.komi_notifications from anon;
revoke update,delete on public.komi_friend_requests from authenticated;
revoke insert,update,delete on public.komi_friendships from authenticated;
revoke insert,update,delete on public.komi_notifications from authenticated;
