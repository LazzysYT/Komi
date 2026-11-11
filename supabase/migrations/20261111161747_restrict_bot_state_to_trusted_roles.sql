begin;

alter table public.bot_state enable row level security;
revoke all on table public.bot_state from public, anon, authenticated;
revoke all (key, value) on table public.bot_state from public, anon, authenticated;

commit;
