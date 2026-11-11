# Komi release gates — Nov 10, 2026

This is the **manual** second half of a two-phase security rollout. Do not add
`phase1-restrict.sql` to an automatic database migration batch.

## Phase 1A — completed

Database migration registered as `20261110105211_secure_presence_and_legacy_archive`.
It creates the read-only aggregate presence RPC and a private snapshot of
`public.animes`. It does **not** alter either legacy public table's RLS.
Verified:
- 7 legacy rows preserved in private snapshot with identical total content bytes
- `anon` can execute the aggregate presence function
- `anon` cannot access `komi_private` directly
- An anonymous-role RPC call succeeded in a rollback transaction

## Update: November 11, 2026 — partial Phase 1B released

- A separate, CI-tested PR #47 replaced the production client's public
  `online_users` queries with `komi_site_presence(uuid)`, preserving legacy
  notifications and friends refresh.
- Production frontend release `04798400e59e7316e309d4abc2accbde696c7253`
  is confirmed READY on `komianime.online`.
- Supabase migration `20261111135055_restrict_legacy_online_users_after_rpc_release`
  **was applied and verified**: RLS ON, anon SELECT/INSERT and authenticated
  UPDATE revoked; the aggregate guest RPC still works. Existing session rows
  were not deleted.
- `public.animes` remains RLS OFF and is the **only** currently reported
  public-table RLS-disabled finding. It still serves production legacy
  comments, profiles, notifications, friends and some local account flows.
- Do **not** apply the remainder of Phase 1B until a compatible frontend
  passes real-account E2E. The existing `phase1-restrict.sql` has redundant,
  idempotent statements for already-protected `online_users`.

## Phase 1B — pending / release-blocking

1. Verify PR #45 automatic tests, and the deployed Preview against a test
   Supabase environment / approved test accounts.
2. Test signed-out browsing, Google/email auth, logout/relogin, favorites,
   lists, profile avatars, comments, friends and two-client Watch Party.
3. Make sure existing local-only users can clearly import their own archived
   lists into a verified Supabase account. Do not infer identity from nickname.
4. Confirm an up-to-date backup and rollback plan before any production change.
5. Release the verified client first; ensure it no longer writes
   `public.animes` or `public.online_users`, and its online counter uses
   `public.komi_site_presence`.
6. Review legacy archive rows 2/4 for display-only public data. Then apply
   `phase1-restrict.sql` in Supabase as an explicitly approved migration.
7. Check RLS, privileges and storage policies, re-run browser checks with
   two accounts, and inspect Supabase security advisors and production errors.

## SQL verification queries (read-only)
```sql
select relname,relrowsecurity
from pg_class
where oid in ('public.animes'::regclass,'public.online_users'::regclass);

select has_table_privilege('anon','public.animes','INSERT') as legacy_anon_write,
       has_table_privilege('anon','public.online_users','INSERT') as online_anon_write;

select to_regprocedure('public.komi_site_presence(uuid)') is not null as rpc_exists,
       has_schema_privilege('anon','komi_private','USAGE') as private_exposed;

select (select count(*) from public.animes) as live_count,
       (select count(*) from komi_private.legacy_animes_snapshot_20261110) as snapshot_count;
```

If a check fails, stop the release and investigate rather than reopening
unrestricted anonymous write access. No user records or catalog rows should be
deleted or rewritten as part of this security migration.

## Outstanding stages
- Authenticated account migration and real session E2E
- Anime episode availability, posters and player source health
- Friends, comments, notifications, avatars and Watch Party sync
- Catalog server-side paging and SEO pre-rendering
- Verified AniCoin rewards, achievements and Premium (no paid checkout yet)
- Final accessibility/mobile/privacy/load test
