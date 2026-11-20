-- Public, read-only community badge for both recipients of a completed referral.
-- Internal referral relationships remain private; only awarded users' badge flags are visible.
create table if not exists public.komi_referral_badges (
 user_id uuid primary key references auth.users(id) on delete cascade,
 granted_at timestamptz not null default now()
);
alter table public.komi_referral_badges enable row level security;
revoke all on public.komi_referral_badges from public,anon,authenticated;
grant select(user_id,granted_at) on public.komi_referral_badges to anon,authenticated;
create policy "referral badges visible" on public.komi_referral_badges
 for select to anon,authenticated using (true);
create or replace function komi_private.publish_referral_badges()
returns trigger language plpgsql security definer set search_path=''
as $fn$
begin
 if new.rewarded_at is not null and old.rewarded_at is null then
   insert into public.komi_referral_badges(user_id,granted_at)
   values(new.invitee_id,new.rewarded_at),(new.inviter_id,new.rewarded_at)
   on conflict(user_id) do nothing;
 end if;
 return new;
end $fn$;
revoke all on function komi_private.publish_referral_badges() from public,anon,authenticated;
drop trigger if exists trg_publish_komi_referral_badges on komi_private.referrals;
create trigger trg_publish_komi_referral_badges
 after update of rewarded_at on komi_private.referrals
 for each row execute function komi_private.publish_referral_badges();
insert into public.komi_referral_badges(user_id,granted_at)
select u.id,min(u.awarded_at)
from (
 select inviter_id as id,rewarded_at as awarded_at from komi_private.referrals where rewarded_at is not null
 union all
 select invitee_id as id,rewarded_at as awarded_at from komi_private.referrals where rewarded_at is not null
) u
group by u.id
on conflict (user_id) do nothing;
