begin;

create schema if not exists komi_private;
revoke all on schema komi_private from public, anon, authenticated;

create table komi_private.catalog_admin_revisions (
    id bigint generated always as identity primary key,
    anime_id integer not null,
    actor_id uuid,
    actor_role name not null,
    operation text not null check (operation in ('insert', 'update', 'restore')),
    changed_fields text[] not null,
    previous_data jsonb,
    result_data jsonb not null,
    result_updated_at timestamptz,
    recorded_at timestamptz not null default now()
);
create index catalog_admin_revisions_anime_idx
    on komi_private.catalog_admin_revisions (anime_id, id desc);
alter table komi_private.catalog_admin_revisions enable row level security;
revoke all on komi_private.catalog_admin_revisions from public, anon, authenticated;

create function komi_private.log_catalog_admin_revision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $body$
declare
    actor uuid := auth.uid();
    before_data jsonb;
    fields text[];
begin
    if actor is null or not public.komi_is_admin() then
        return new;
    end if;
    if tg_op = 'UPDATE' then
        before_data := old.data;
        if before_data is not distinct from new.data then return new; end if;
    end if;

    select coalesce(array_agg(field order by field), array[]::text[]) into fields
    from (
        select jsonb_object_keys(case when jsonb_typeof(before_data) = 'object' then before_data else '{}'::jsonb end) as field
        union
        select jsonb_object_keys(case when jsonb_typeof(new.data) = 'object' then new.data else '{}'::jsonb end)
    ) keys
    where (before_data -> field) is distinct from (new.data -> field);

    insert into komi_private.catalog_admin_revisions
        (anime_id, actor_id, actor_role, operation, changed_fields, previous_data, result_data, result_updated_at)
    values (new.shikimori_id, actor, 'authenticated', lower(tg_op), fields, before_data, new.data, new.updated_at);
    return new;
end
$body$;
revoke all on function komi_private.log_catalog_admin_revision() from public, anon, authenticated;

create trigger komi_log_catalog_admin_revision
after insert or update of data on public.anime_catalog
for each row execute function komi_private.log_catalog_admin_revision();

-- Trusted operators can restore an edit only while the recorded result is
-- still current. Restoring an insertion never deletes a catalog title.
create function komi_private.restore_catalog_admin_revision(p_revision_id bigint)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $body$
declare
    revision komi_private.catalog_admin_revisions;
    restored_at timestamptz;
begin
    select * into revision
    from komi_private.catalog_admin_revisions
    where id = p_revision_id and operation = 'update' and previous_data is not null;
    if not found then return false; end if;

    update public.anime_catalog
    set data = revision.previous_data, updated_at = clock_timestamp()
    where shikimori_id = revision.anime_id
      and data is not distinct from revision.result_data
      and updated_at is not distinct from revision.result_updated_at
    returning updated_at into restored_at;
    if not found then return false; end if;

    insert into komi_private.catalog_admin_revisions
        (anime_id, actor_id, actor_role, operation, changed_fields, previous_data, result_data, result_updated_at)
    values (revision.anime_id, auth.uid(), current_user, 'restore', revision.changed_fields,
            revision.result_data, revision.previous_data, restored_at);
    return true;
end
$body$;
revoke all on function komi_private.restore_catalog_admin_revision(bigint) from public, anon, authenticated;

commit;
