begin;

create table komi_private.friend_request_limits (
    sender_id uuid primary key references auth.users(id) on delete cascade,
    window_started_at timestamptz not null,
    last_sent_at timestamptz not null,
    sent_count integer not null check (sent_count between 1 and 10)
);
alter table komi_private.friend_request_limits enable row level security;
revoke all on table komi_private.friend_request_limits from public, anon, authenticated;

create function komi_private.enforce_friend_request_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $body$
declare
    actor uuid := auth.uid();
    requested_at timestamptz := clock_timestamp();
    cooldown constant interval := interval '10 seconds';
    quota_window constant interval := interval '1 hour';
begin
    if actor is null then return new; end if;
    if actor is distinct from new.sender_id then
        raise insufficient_privilege using message = 'Отправляйте заявки от своего аккаунта.';
    end if;

    insert into komi_private.friend_request_limits as quota
        (sender_id, window_started_at, last_sent_at, sent_count)
    values (actor, requested_at, requested_at, 1)
    on conflict (sender_id) do update
    set window_started_at = case
            when quota.window_started_at <= excluded.last_sent_at - quota_window then excluded.last_sent_at
            else quota.window_started_at
        end,
        last_sent_at = excluded.last_sent_at,
        sent_count = case
            when quota.window_started_at <= excluded.last_sent_at - quota_window then 1
            else quota.sent_count + 1
        end
    where quota.last_sent_at <= excluded.last_sent_at - cooldown
      and (quota.sent_count < 10 or quota.window_started_at <= excluded.last_sent_at - quota_window);

    if not found then
        raise sqlstate 'PT429' using
            message = 'Заявки можно отправлять раз в 10 секунд, до 10 заявок за час. Попробуйте позже.';
    end if;
    return new;
end
$body$;
revoke all on function komi_private.enforce_friend_request_limit() from public, anon, authenticated;

create trigger komi_rate_limit_friend_requests
before insert on public.komi_friend_requests
for each row execute function komi_private.enforce_friend_request_limit();

-- Browser requests already supply these two fields. Postgres owns the rest.
revoke insert on table public.komi_friend_requests from public, anon, authenticated;
grant insert (sender_id, receiver_id) on table public.komi_friend_requests to authenticated;

commit;
