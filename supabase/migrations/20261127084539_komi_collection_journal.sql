-- Read-only journal for the signed-in owner, backed by confirmed unlocks.
-- The legacy ledger includes earned free cards. These are openings, not purchases.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create function komi_collection_private.journal_read(p_series_id text)
returns jsonb language plpgsql stable security definer set search_path = '' set timezone = 'UTC'
as $$
declare
  v_actor uuid := auth.uid();
  v_rows jsonb;
begin
  if v_actor is null or coalesce(auth.jwt()->>'is_anonymous', 'false') = 'true'
     or not exists (
       select 1 from auth.users u
       where u.id = v_actor and u.deleted_at is null and u.is_anonymous is not true
     ) then
    raise exception 'Verified account required' using errcode = '42501';
  end if;
  if p_series_id is null or p_series_id not in ('ghoul','jujutsu','frieren','alchemist') then
    raise exception 'Unknown collection series' using errcode = '22023';
  end if;

  if p_series_id = 'ghoul' then
    -- The exact server timestamp is created_at, not the UTC-day opened_on key.
    select pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object('character_id', x.character_id, 'opened_at', x.created_at)
      order by x.created_at desc, x.character_id
    ) into v_rows
    from (
      select u.character_id, u.created_at
      from komi_collection_private.unlocks u where u.user_id = v_actor
      order by u.created_at desc, u.character_id limit 20
    ) x;
  else
    select pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object('character_id', x.character_id, 'opened_at', x.created_at)
      order by x.created_at desc, x.character_id
    ) into v_rows
    from (
      select u.character_id, u.created_at
      from komi_collection_private.series_unlocks u where u.user_id = v_actor and u.series_id = p_series_id
      order by u.created_at desc, u.character_id limit 20
    ) x;
  end if;
  return coalesce(v_rows, '[]'::jsonb);
end;
$$;
revoke all on function komi_collection_private.journal_read(text) from public, anon, authenticated, service_role;
grant execute on function komi_collection_private.journal_read(text) to authenticated;

create function public.komi_collection_journal_read(p_series_id text)
returns jsonb language sql stable security invoker set search_path = ''
as $$ select komi_collection_private.journal_read(p_series_id) $$;
revoke all on function public.komi_collection_journal_read(text) from public, anon, authenticated, service_role;
grant execute on function public.komi_collection_journal_read(text) to authenticated;
commit;
