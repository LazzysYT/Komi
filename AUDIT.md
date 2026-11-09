# Komi improvement audit

## Confirmed findings

- The legacy public.animes table has RLS disabled and INSERT/UPDATE/DELETE privileges for both anon and authenticated. It remains used by legacy profile, notification and friend code. A safe migration must first replace those callers with owner-scoped tables and RPCs. No database records were changed during this audit.
- anime_catalog has RLS enabled and neither visitor role has write privileges. Personal lists and progress have owner policies.
- setAnimeStatus changed the browser state before awaiting persistence and only logged write errors. This branch awaits persistence, prevents overlapping status requests, shows errors and refreshes the profile after successful persistence.
- The previous description sanitizer contained a syntax error. Production hotfix 9fc31dde corrected it.
- Database inventory reported 6700 catalog records, 1791 without episodes, 2 without a poster URL and 6700 without a stored banner. Missing stored banners alone do not establish missing rendered banners, because the page requests AniList artwork.

## Verification

- JavaScript syntax compiled successfully after the status change.
- Vercel preview 68278473 reached READY.
- Authenticated browser status persistence, logout and relogin tests remain required. No success is claimed for them.

## Remaining stages

1. Verify poster responses visually and implement permitted fallbacks.
2. Migrate legacy social callers and then restrict public.animes using a reversible migration.
3. Add consistent design and behavior contracts and consolidate overlapping CSS.
4. Rework source selection, saved voice, player controls and 16:9 mobile sizing.
5. Verify friends, avatars, personal lists and two-client watch rooms.
6. Replace full catalog downloads with server paging and independent detail fetching.
7. Exercise 360,390,768,1024,1440,1920px layouts and complete preview verification before production.
