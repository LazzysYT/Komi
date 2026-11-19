-- Daily quests: server evidence, one claim per UTC day and quest, atomic wallet credit.
-- Premium multiplier applies to quest XP only; existing XP, gifts and subscriptions untouched.
create table if not exists komi_private.daily_quest_claims (
  user_id uuid not null references auth.users(id) on delete cascade,
  quest_day date not null,
  quest_id text not null check(quest_id in ('checkin','watch','comment')),
  xp_awarded integer not null check(xp_awarded between 10 and 45),
  coins_awarded integer not null check(coins_awarded between 0 and 1),
  created_at timestamptz not null default now(),
  primary key(user_id,quest_day,quest_id)
);
alter table komi_private.daily_quest_claims enable row level security;
revoke all on komi_private.daily_quest_claims from public,anon,authenticated;
alter table public.komi_anicoin_ledger
  drop constraint if exists komi_anicoin_ledger_reason_check;
alter table public.komi_anicoin_ledger
  add constraint komi_anicoin_ledger_reason_check
  check(reason in ('watch','premium_welcome','quest_daily'));

create or replace function public.komi_daily_quests(
  p_action text default 'read',
  p_quest text default null
)
returns jsonb language plpgsql security definer set search_path = ''
as $fn$
declare
  v_user uuid := auth.uid();
  v_day date := (now() at time zone 'UTC')::date;
  v_today_start timestamptz := ((now() at time zone 'UTC')::date::timestamp at time zone 'UTC');
  v_premium boolean;
  v_checkin boolean; v_watch boolean; v_comment boolean;
  v_eligible boolean := false;
  v_base_xp integer; v_xp integer; v_coins integer;
  v_awarded boolean := false;
  v_claims jsonb; v_total_xp integer;
begin
  if v_user is null or not exists(
    select 1 from auth.users u where u.id=v_user and u.deleted_at is null
      and u.is_anonymous is not true
  ) then
    raise exception 'Verified user required' using errcode='42501';
  end if;
  if p_action not in ('read','claim') or p_action is null
     or (p_action='claim' and (p_quest is null or p_quest not in ('checkin','watch','comment'))) then
    raise exception 'Unsupported quest action' using errcode='22023';
  end if;
  v_premium := exists(
    select 1 from public.komi_premium_badges b
    where b.user_id=v_user and b.active_until>now()
  );
  v_checkin := exists(
    select 1 from komi_private.daily_activity_checkins c
    where c.user_id=v_user and c.activity_day=v_day
  );
  v_watch := exists(
    select 1 from public.komi_anicoin_ledger l
    where l.user_id=v_user and l.reason='watch'
      and l.created_at>=v_today_start and l.created_at<v_today_start+interval '1 day'
  );
  v_comment := exists(
    select 1 from public.komi_comments c
    where c.user_id=v_user and c.created_at>=v_today_start
      and c.created_at<v_today_start+interval '1 day'
      and length(btrim(c.body))>=10
  );
  if p_action='claim' then
    v_eligible := case p_quest
      when 'checkin' then v_checkin
      when 'watch' then v_watch
      when 'comment' then v_comment else false end;
    if not v_eligible then
      raise exception 'Quest evidence is not verified' using errcode='22023';
    end if;
    v_base_xp := case p_quest when 'checkin' then 20 when 'watch' then 30 else 10 end;
    v_xp := case when v_premium then v_base_xp*3/2 else v_base_xp end;
    v_coins := case when p_quest in ('checkin','watch') then 1 else 0 end;
    insert into komi_private.daily_quest_claims(user_id,quest_day,quest_id,xp_awarded,coins_awarded)
      values(v_user,v_day,p_quest,v_xp,v_coins)
      on conflict(user_id,quest_day,quest_id) do nothing;
    v_awarded := found;
    if v_awarded and v_coins>0 then
      insert into public.komi_anicoin_wallets(user_id,balance)
        values(v_user,v_coins)
        on conflict(user_id) do update
          set balance=public.komi_anicoin_wallets.balance+excluded.balance;
      insert into public.komi_anicoin_ledger(user_id,delta,reason)
        values(v_user,v_coins,'quest_daily');
    end if;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',c.quest_id,'xp',c.xp_awarded,'coins',c.coins_awarded,
    'day',c.quest_day) order by c.quest_day desc),'[]'::jsonb),
    coalesce(sum(c.xp_awarded),0)::integer
  into v_claims,v_total_xp
  from komi_private.daily_quest_claims c where c.user_id=v_user;
  return jsonb_build_object(
    'server_day',v_day,
    'premium_xp_multiplier',case when v_premium then 1.5 else 1 end,
    'available',jsonb_build_object('checkin',v_checkin,'watch',v_watch,'comment',v_comment),
    'claims',v_claims,'quest_xp_total',v_total_xp,
    'awarded_now',v_awarded
  );
end
$fn$;
revoke all on function public.komi_daily_quests(text,text) from public,anon,authenticated;
grant execute on function public.komi_daily_quests(text,text) to authenticated;
comment on function public.komi_daily_quests(text,text) is
  'Owner-only idempotent UTC daily quest claim with verified server activity and Premium XP on quest rewards.';
