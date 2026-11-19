-- Owner-only, optional daily activity check-in. No XP, AniCoin, or Premium changes.
-- UTC calendar boundaries are deterministic and cannot be spoofed by browser input.
begin;

create table if not exists komi_private.daily_activity_checkins (
    user_id uuid not null references auth.users(id) on delete cascade,
    activity_day date not null,
    created_at timestamptz not null default now(),
    primary key (user_id, activity_day)
);
alter table komi_private.daily_activity_checkins enable row level security;
revoke all on table komi_private.daily_activity_checkins from public, anon, authenticated;

create or replace function public.komi_daily_activity(p_action text default 'read')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
    actor uuid := auth.uid();
    today_utc date := (clock_timestamp() at time zone 'UTC')::date;
    last_day date;
    day_count integer := 0;
    streak integer := 0;
begin
    if actor is null or not exists (
        select 1 from auth.users u
        where u.id = actor and u.deleted_at is null and u.is_anonymous is not true
    ) then
        raise exception 'Authenticated account required' using errcode = '42501';
    end if;
    if p_action is null or p_action not in ('read','checkin') then
        raise exception 'Invalid activity action' using errcode = '22023';
    end if;

    if p_action = 'checkin' then
        insert into komi_private.daily_activity_checkins (user_id, activity_day)
        values (actor, today_utc)
        on conflict (user_id, activity_day) do nothing;
    end if;

    select count(*)::integer, max(c.activity_day)
    into day_count, last_day
    from komi_private.daily_activity_checkins c
    where c.user_id = actor;

    if last_day >= today_utc - 1 and last_day <= today_utc then
        select count(*)::integer into streak
        from (
            select c.activity_day,
                   row_number() over(order by c.activity_day desc) as ordinal
            from komi_private.daily_activity_checkins c
            where c.user_id = actor and c.activity_day <= last_day
        ) ordered_days
        where ordered_days.activity_day =
              last_day - (ordered_days.ordinal - 1)::integer;
    end if;

    return jsonb_build_object(
        'server_day', today_utc,
        'checked_today', (last_day = today_utc),
        'streak_days', streak,
        'total_days', day_count
    );
end
$body$;

revoke all on function public.komi_daily_activity(text) from public, anon, authenticated;
grant execute on function public.komi_daily_activity(text) to authenticated;
comment on function public.komi_daily_activity(text) is
    'Optional verified-user daily activity check-in, idempotent once per UTC day; no currency rewards.';

commit;
