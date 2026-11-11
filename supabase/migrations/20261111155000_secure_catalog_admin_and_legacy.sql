-- Secure catalog administration without changing any stored anime or account data.
-- Never grant administrator rights by username or editable user_metadata.
create table if not exists public.komi_admin_members (
    user_id uuid primary key references auth.users(id) on delete cascade,
    granted_at timestamptz not null default now()
);
alter table public.komi_admin_members enable row level security;
revoke all on table public.komi_admin_members from public, anon, authenticated;
grant select on table public.komi_admin_members to service_role;

create or replace function public.komi_is_admin()
returns boolean language sql stable security definer
set search_path = ''
as $function$
    select (select auth.uid()) is not null
       and exists (
           select 1 from public.komi_admin_members m
           where m.user_id = (select auth.uid())
       )
$function$;
revoke all on function public.komi_is_admin() from public, anon;
grant execute on function public.komi_is_admin() to authenticated;

alter table public.anime_catalog enable row level security;
-- Existing SELECT policy "Public anime catalog read" stays unchanged.
grant insert (shikimori_id, data, updated_at) on public.anime_catalog to authenticated;
grant update (data, updated_at) on public.anime_catalog to authenticated;
revoke delete, truncate, trigger, references on public.anime_catalog from anon, authenticated;
drop policy if exists "Komi verified admin insert anime" on public.anime_catalog;
create policy "Komi verified admin insert anime"
    on public.anime_catalog for insert to authenticated
    with check ((select public.komi_is_admin()));
drop policy if exists "Komi verified admin update anime" on public.anime_catalog;
create policy "Komi verified admin update anime"
    on public.anime_catalog for update to authenticated
    using ((select public.komi_is_admin()))
    with check ((select public.komi_is_admin()));

-- The archived legacy animes table stays intact, but anonymous writers lose access.
-- Only the small legacy settings records still used by existing clients remain readable.
alter table public.animes enable row level security;
revoke insert, update, delete, truncate, trigger, references on public.animes from anon, authenticated;
grant select on public.animes to anon, authenticated;
drop policy if exists "Komi legacy settings read only" on public.animes;
create policy "Komi legacy settings read only"
    on public.animes for select to anon, authenticated
    using (id in (2, 3, 4, 5, 7));

comment on table public.komi_admin_members is
    'Membership is granted only by a project owner through the trusted Supabase dashboard, never a browser.';
