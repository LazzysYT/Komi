-- Automatic, single-award referral credit after server evidence changes.
-- No anonymous access; invitation codes remain private and cannot be searched from the browser.
create or replace function komi_private.award_referral_if_ready(p_invitee uuid)
returns void language plpgsql security definer set search_path = ''
as $fn$
declare v_inviter uuid; v_joined timestamptz; v_watched integer; v_pulses integer;
begin
 if p_invitee is null then return; end if;
 select r.inviter_id,r.joined_at into v_inviter,v_joined
 from komi_private.referrals r
 where r.invitee_id=p_invitee and r.rewarded_at is null
 for update;
 if not found then return; end if;
 select count(distinct (w.anime_id,w.season,w.episode_index))::integer
 into v_watched
 from public.komi_watched_episodes w
 where w.user_id=p_invitee and w.watched_at>=v_joined;
 if v_watched<3 then return; end if;
 select count(*)::integer into v_pulses
 from public.komi_anicoin_ledger l
 where l.user_id=p_invitee and l.reason='watch' and l.created_at>=v_joined;
 if v_pulses<3 then return; end if;
 update komi_private.referrals
 set rewarded_at=now()
 where invitee_id=p_invitee and rewarded_at is null;
 if not found then return; end if;
 insert into public.komi_anicoin_wallets(user_id,balance)
 select person,50 from (values (p_invitee),(v_inviter)) as parties(person)
 on conflict (user_id) do update
 set balance=public.komi_anicoin_wallets.balance+excluded.balance;
 insert into public.komi_anicoin_ledger(user_id,delta,reason)
 values(p_invitee,50,'referral'),(v_inviter,50,'referral');
end $fn$;
revoke all on function komi_private.award_referral_if_ready(uuid) from public,anon,authenticated;

create or replace function komi_private.referral_watch_marker()
returns trigger language plpgsql security definer set search_path=''
as $fn$
begin
 perform komi_private.award_referral_if_ready(new.user_id);
 return new;
end $fn$;
revoke all on function komi_private.referral_watch_marker() from public,anon,authenticated;
drop trigger if exists trg_komi_referral_watched_marker on public.komi_watched_episodes;
create trigger trg_komi_referral_watched_marker
 after insert on public.komi_watched_episodes
 for each row execute function komi_private.referral_watch_marker();

create or replace function komi_private.referral_verified_watch_pulse()
returns trigger language plpgsql security definer set search_path=''
as $fn$
begin
 if new.reason='watch' then
  perform komi_private.award_referral_if_ready(new.user_id);
 end if;
 return new;
end $fn$;
revoke all on function komi_private.referral_verified_watch_pulse() from public,anon,authenticated;
drop trigger if exists trg_komi_referral_ledger_watch on public.komi_anicoin_ledger;
create trigger trg_komi_referral_ledger_watch
 after insert on public.komi_anicoin_ledger
 for each row when (new.reason='watch')
 execute function komi_private.referral_verified_watch_pulse();
