-- Additive Premium badge appearance only; no payment, entitlement or bonus changes.
create table if not exists public.komi_premium_badge_styles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  style smallint not null default 0 check (style between 0 and 19),
  updated_at timestamptz not null default now()
);
alter table public.komi_premium_badge_styles enable row level security;
revoke all on public.komi_premium_badge_styles from anon, authenticated;
grant select on public.komi_premium_badge_styles to anon, authenticated;
grant insert, update on public.komi_premium_badge_styles to authenticated;
create policy "Anyone can see Premium badge appearance"
  on public.komi_premium_badge_styles for select to anon, authenticated using (true);
create policy "Active Premium can choose own badge"
  on public.komi_premium_badge_styles for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (
    select 1 from public.komi_premium_badges p
    where p.user_id = (select auth.uid()) and p.active_until > now()
  ));
create policy "Active Premium can update own badge"
  on public.komi_premium_badge_styles for update to authenticated
  using (user_id = (select auth.uid()) and exists (
    select 1 from public.komi_premium_badges p
    where p.user_id = (select auth.uid()) and p.active_until > now()
  ))
  with check (user_id = (select auth.uid()) and exists (
    select 1 from public.komi_premium_badges p
    where p.user_id = (select auth.uid()) and p.active_until > now()
  ));
