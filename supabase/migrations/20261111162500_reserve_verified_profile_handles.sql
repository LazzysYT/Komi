-- Keep verified account identity namespaces server-owned.
-- Applied only after the matching signup validation is published.
-- Existing verified profiles are checked before enabling.
begin;

alter table public.komi_profiles
  add constraint komi_profiles_reserved_handle_check
  check (
    lower(username) not in
      ('admin','administrator','moderator','mod','staff','support','system',
       'owner','komianime','komi_anime')
    and (
      username !~* '^google_'
      or username = 'google_' || replace(user_id::text,'-','')
    )
  ) not valid;

alter table public.komi_profiles
  validate constraint komi_profiles_reserved_handle_check;

commit;
