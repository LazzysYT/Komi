DO $migration$
DECLARE definition text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO definition
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname='komi_party'
    AND pg_get_function_identity_arguments(p.oid)='action text, room_id uuid, args jsonb';
  IF definition IS NULL THEN RAISE EXCEPTION 'komi_party RPC not found'; END IF;
  IF position('select username from public.komi_profiles where user_id = actor' in definition)=0 THEN
    RAISE EXCEPTION 'Expected chat author expression not found; no changes applied';
  END IF;
  definition := replace(definition,
    'select username from public.komi_profiles where user_id = actor',
    'select coalesce(nullif(trim(display_name), ''''), username) from public.komi_profiles where user_id = actor');
  EXECUTE definition;
END
$migration$;