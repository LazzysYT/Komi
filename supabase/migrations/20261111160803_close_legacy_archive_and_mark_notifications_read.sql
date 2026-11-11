begin;

-- Serialize with writers while checking the preserved copy against the source.
lock table public.animes in share row exclusive mode;
create schema if not exists komi_private;
revoke all on schema komi_private from public, anon, authenticated;
create table if not exists komi_private.legacy_animes_snapshot_20261110 as table public.animes;
alter table komi_private.legacy_animes_snapshot_20261110 enable row level security;
revoke all on table komi_private.legacy_animes_snapshot_20261110 from public, anon, authenticated;

do $archive$
begin
    if exists (
        select 1
        from public.animes live
        left join komi_private.legacy_animes_snapshot_20261110 archived on archived.id = live.id
        where archived.id is null or archived.content is distinct from live.content
    ) then
        raise exception 'Legacy archive does not contain an exact copy of every live row';
    end if;
end
$archive$;

alter table public.animes enable row level security;
drop policy if exists "Komi legacy settings read only" on public.animes;
drop policy if exists "Legacy public comments and profiles archive" on public.animes;
revoke all on table public.animes from public, anon, authenticated;
revoke all (id, content) on table public.animes from public, anon, authenticated;

-- The existing owner-only SELECT and UPDATE policies restrict recipients.
revoke update on table public.komi_notifications from public, anon, authenticated;
grant update (read_at) on table public.komi_notifications to authenticated;

commit;
