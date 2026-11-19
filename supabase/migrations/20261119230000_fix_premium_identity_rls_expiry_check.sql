-- Fix Premium style saves without exposing subscription expiry timestamps.
-- Badge rows are already filtered to active_until > now() by
-- public.komi_premium_badges SELECT RLS, and browsers can SELECT(user_id) only.
-- Subqueries in other RLS policies must NOT read active_until directly;
-- otherwise the invoker receives 42501 permission denied for komi_premium_badges.
-- Keep entitlements, payments and private subscription data server-controlled.

alter policy "Active Premium identity visible to community"
  on public.komi_premium_profile_prefs
  using (
    exists (
      select 1 from public.komi_premium_badges b
      where b.user_id = komi_premium_profile_prefs.user_id
    )
  );

alter policy "Active Premium can create own identity"
  on public.komi_premium_profile_prefs
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.komi_premium_badges b
      where b.user_id = (select auth.uid())
    )
  );

alter policy "Active Premium can edit own identity"
  on public.komi_premium_profile_prefs
  using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.komi_premium_badges b
      where b.user_id = (select auth.uid())
    )
  )
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.komi_premium_badges b
      where b.user_id = (select auth.uid())
    )
  );

alter policy "Active Premium cosmetics public display"
  on public.komi_premium_cosmetic_equips
  using (
    exists (
      select 1 from public.komi_premium_badges b
      where b.user_id = komi_premium_cosmetic_equips.user_id
    )
  );

-- Never GRANT SELECT(active_until): the badge table's own RLS enforces expiry.
-- Never grant badge INSERT/UPDATE/DELETE to a browser role.
