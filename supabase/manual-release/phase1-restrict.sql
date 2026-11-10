-- Phase 1B / RESTRICT (MANUAL production gate).
-- APPLY ONLY AFTER:
--  1. Phase 1A RPC was installed and verified.
--  2. The codex/completion-stages frontend is live on production.
--  3. Guests and signed-in users were checked against production.
--  4. An up-to-date backup and rollback plan exist.
-- Never execute automatically as part of a generic "apply all migrations".
-- Current client still reads legacy row IDs 2 (public comments archive)
-- and 4 (legacy public profile archive); review content before rollout.
begin;

do $$
begin
  if to_regprocedure('public.komi_site_presence(uuid)') is null
     or to_regclass('komi_private.site_presence') is null
     or to_regclass('komi_private.legacy_animes_snapshot_20261110') is null then
    raise exception 'Phase 1A presence RPC/backup not installed; aborting';
  end if;
end
$$;

alter table public.animes enable row level security;
revoke all privileges on table public.animes from public, anon, authenticated;
drop policy if exists "Legacy public comments and profiles archive" on public.animes;
create policy "Legacy public comments and profiles archive"
  on public.animes for select to anon, authenticated
  using (id in (2,4));
grant select on table public.animes to anon, authenticated;

alter table public.online_users enable row level security;
revoke all privileges on table public.online_users from public, anon, authenticated;
-- No direct session read or write policies: the new private RPC replaces this API.

-- Anonymous root-level avatar upload allowed any visitor to create shared objects.
-- Only the owner-folder policy for authenticated users is retained.
drop policy if exists "Komi public avatar uploads" on storage.objects;

commit;

-- POST-APPLY CHECKS (run separately, read-only):
-- select relname,relrowsecurity from pg_class
--   where oid in ('public.animes'::regclass,'public.online_users'::regclass);
-- select schemaname,tablename,policyname,cmd
--   from pg_policies where schemaname='public'
--   and tablename in ('animes','online_users');
-- select has_table_privilege('anon','public.animes','UPDATE'),
--        has_table_privilege('anon','public.online_users','INSERT');
