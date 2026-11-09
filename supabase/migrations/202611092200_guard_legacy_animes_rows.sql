-- Non-destructive interim hardening for legacy public.animes.
-- The old table is still used for guest statuses / legacy social data, so
-- enabling RLS globally without migrating readers would break existing flows.
-- Protect legacy catalog/configuration rows from public DML and prohibit
-- client-side deletion of any shared legacy row while migration is in progress.
-- Supabase service_role and trusted migrations can still maintain the records.
create or replace function public.komi_guard_legacy_animes_rows()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
    if current_user in ('anon', 'authenticated') then
        if tg_op = 'DELETE' then
            raise exception 'Shared legacy records cannot be deleted by public clients'
                using errcode = '42501';
        end if;
        if (tg_op = 'UPDATE' and old.id in (1, 2, 6))
           or new.id in (1, 2, 6) then
            raise exception 'Server-managed catalog and settings cannot be modified by public clients'
                using errcode = '42501';
        end if;
    end if;

    if tg_op = 'DELETE' then
        return old;
    end if;
    return new;
end;
$$;

drop trigger if exists komi_guard_legacy_animes_dml on public.animes;
create trigger komi_guard_legacy_animes_dml
before insert or update or delete on public.animes
for each row execute function public.komi_guard_legacy_animes_rows();

comment on function public.komi_guard_legacy_animes_rows() is
'Interim protection for rows 1/2/6 and deletes in public.animes. Full RLS needs guest/social migration.';
