-- Repair review-vote owner comparison: explicit outer table reference.
-- An unqualified user_id inside the EXISTS resolves to the inner review's user_id.
drop policy if exists "review vote own insert" on public.komi_review_votes;
create policy "review vote own insert"
on public.komi_review_votes for insert to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.komi_reviews r
    where r.id = komi_review_votes.review_id
      and r.user_id <> komi_review_votes.user_id
  )
);
