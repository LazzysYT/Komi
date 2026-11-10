-- Additive account-owned folder storage. Safe to apply before client rollout:
-- no old tables, records, grants or storage policies are changed.
begin;

create table if not exists public.komi_custom_folders (
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, name),
  constraint komi_custom_folder_name_check
    check (char_length(name) between 1 and 40 and name = btrim(name)
      and name !~ '[[:cntrl:]]'
      and lower(name) not in ('__proto__','constructor','prototype'))
);

create table if not exists public.komi_folder_items (
  user_id uuid not null,
  folder_name text not null,
  anime_id bigint not null check (anime_id > 0),
  created_at timestamptz not null default now(),
  primary key (user_id, folder_name, anime_id),
  foreign key (user_id, folder_name)
    references public.komi_custom_folders(user_id, name) on delete cascade
);

create index if not exists komi_folder_items_owner_idx
  on public.komi_folder_items(user_id);

alter table public.komi_custom_folders enable row level security;
alter table public.komi_folder_items enable row level security;

revoke all on public.komi_custom_folders from public, anon, authenticated;
revoke all on public.komi_folder_items from public, anon, authenticated;
grant select, insert, delete on public.komi_custom_folders to authenticated;
grant select, insert, delete on public.komi_folder_items to authenticated;

create policy "folders read own"
  on public.komi_custom_folders for select to authenticated
  using (user_id = (select auth.uid()));
create policy "folders insert own"
  on public.komi_custom_folders for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "folders delete own"
  on public.komi_custom_folders for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "folder items read own"
  on public.komi_folder_items for select to authenticated
  using (user_id = (select auth.uid()));
create policy "folder items insert own"
  on public.komi_folder_items for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "folder items delete own"
  on public.komi_folder_items for delete to authenticated
  using (user_id = (select auth.uid()));

commit;
