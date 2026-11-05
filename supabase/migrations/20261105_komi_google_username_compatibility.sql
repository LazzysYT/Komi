-- Google Auth IDs are represented by google_ followed by 32 hexadecimal chars in legacy UI.
-- Preserve that stable mapping while retaining constrained usernames.
alter table public.komi_profiles drop constraint if exists komi_profiles_username_check;
alter table public.komi_profiles add constraint komi_profiles_username_check
check (username ~ '^[A-Za-z0-9_]{3,48}$');
