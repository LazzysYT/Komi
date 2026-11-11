begin;

-- Keep the existing RPC signature for already deployed clients. The client
-- session identifier no longer controls the presence record or the count.
create or replace function public.komi_site_presence(p_session uuid)
returns bigint
language plpgsql
security definer
set search_path = ''
as $body$
declare
    actor uuid := auth.uid();
    observed_at timestamptz := clock_timestamp();
    active_count bigint;
begin
    if p_session is null then
        raise exception 'Session required' using errcode = '22023';
    end if;

    if actor is not null and exists (
        select 1 from auth.users u
        where u.id = actor and u.deleted_at is null and u.is_anonymous is not true
          and (u.email_confirmed_at is not null or u.phone_confirmed_at is not null)
    ) and not exists (
        select 1 from komi_private.site_presence p
        where p.session_id = actor and p.user_id = actor
          and p.last_seen > observed_at - interval '6 seconds'
    ) then
        insert into komi_private.site_presence as p(session_id, user_id, last_seen)
        values (actor, actor, observed_at)
        on conflict (session_id) do update
        set user_id = excluded.user_id, last_seen = excluded.last_seen
        where p.user_id is distinct from actor
           or p.last_seen <= observed_at - interval '6 seconds';
    end if;

    select count(*) into active_count
    from komi_private.site_presence p
    where p.session_id = p.user_id and p.last_seen > observed_at - interval '30 seconds';
    return active_count;
end
$body$;

revoke all on function public.komi_site_presence(uuid) from public;
grant execute on function public.komi_site_presence(uuid) to anon, authenticated;
comment on function public.komi_site_presence(uuid) is
    'Returns aggregate online accounts. Guests can read only. Verified accounts heartbeat at most once per six seconds, keyed by Auth UID.';

commit;
