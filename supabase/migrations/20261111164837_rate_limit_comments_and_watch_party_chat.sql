begin;

create table komi_private.social_write_cooldowns (
    user_id uuid not null references auth.users(id) on delete cascade,
    surface text not null check (surface in ('komi_comments', 'komi_party_rooms')),
    last_write_at timestamptz not null,
    primary key (user_id, surface)
);
alter table komi_private.social_write_cooldowns enable row level security;
revoke all on table komi_private.social_write_cooldowns from public, anon, authenticated;

create function komi_private.enforce_social_write_cooldown()
returns trigger
language plpgsql
security definer
set search_path = ''
as $body$
declare
    actor uuid := auth.uid();
    requested_at timestamptz := clock_timestamp();
    cooldown interval := tg_argv[0]::interval;
begin
    if actor is null then return new; end if;

    insert into komi_private.social_write_cooldowns as previous (user_id, surface, last_write_at)
    values (actor, tg_table_name, requested_at)
    on conflict (user_id, surface) do update
    set last_write_at = excluded.last_write_at
    where previous.last_write_at <= excluded.last_write_at - cooldown;

    if not found then
        raise sqlstate 'PT429' using message = tg_argv[1];
    end if;
    return new;
end
$body$;
revoke all on function komi_private.enforce_social_write_cooldown() from public, anon, authenticated;

create trigger komi_rate_limit_comments
before insert on public.komi_comments
for each row execute function komi_private.enforce_social_write_cooldown(
    '10 seconds', 'Подождите 10 секунд перед следующим комментарием.'
);

create trigger komi_rate_limit_party_chat
before update of messages on public.komi_party_rooms
for each row execute function komi_private.enforce_social_write_cooldown(
    '2 seconds', 'Подождите 2 секунды перед следующим сообщением.'
);

commit;
