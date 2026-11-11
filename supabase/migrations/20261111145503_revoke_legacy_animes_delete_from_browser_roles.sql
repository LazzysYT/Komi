-- Applied to production Supabase on 2026-11-11.
-- Temporary defense-in-depth while public.animes legacy JSON blob is migrated.
-- Current production only SELECTs and UPSERTs these rows; no legitimate
-- browser client is expected to DELETE a shared archive row.
-- Do not confuse this with completed RLS: public.animes still needs a safe,
-- separate migration after verified account/social E2E.
begin;
revoke delete on table public.animes from public, anon, authenticated;
commit;

-- Post-apply verification:
-- select has_table_privilege('anon','public.animes','DELETE') as guest_delete,
--        has_table_privilege('authenticated','public.animes','DELETE') as member_delete,
--        has_table_privilege('anon','public.animes','SELECT') as guest_read,
--        (select count(*) from public.animes) as preserved_rows;
-- Verified: false, false, true, 7. Existing records were not deleted.
