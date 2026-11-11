-- Applied to Supabase production on 2026-11-11, after QA-verified
-- release of the new aggregate site-presence RPC frontend (main 0479840).
-- Do not delete legacy session records or disable the aggregate RPC.
begin;

do $$
begin
  if to_regprocedure('public.komi_site_presence(uuid)') is null then
    raise exception 'Private presence RPC is missing; aborting RLS restriction';
  end if;
end
$$;

alter table public.online_users enable row level security;
revoke all on table public.online_users from public, anon, authenticated;

commit;

-- Verified after apply:
-- relrowsecurity = true
-- anon SELECT / INSERT = false, authenticated UPDATE = false
-- anonymous role can execute public.komi_site_presence(uuid).
-- Existing online_users session rows remain intact.
