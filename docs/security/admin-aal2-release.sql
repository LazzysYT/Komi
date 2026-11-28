-- Admin-only MFA enforcement. Membership discovery remains available at AAL1.
-- All schema changes and assertions run in one statement/transaction.
DO $komi_admin_mfa$
DECLARE
 target record;
 definition text;
 marker text;
 proposed text;
 gate text;
 actor uuid;
 old_claims text:=current_setting('request.jwt.claims',true);
 old_claim text:=current_setting('request.jwt.claim',true);
 old_sub text:=current_setting('request.jwt.claim.sub',true);
 claims text;
 test_call text;
 err text;
 denied boolean;
 patched integer:=0;
BEGIN
 PERFORM set_config('lock_timeout','3s',true);
 IF NOT EXISTS (SELECT 1 FROM public.komi_admin_members)
 OR EXISTS (
   SELECT 1 FROM public.komi_admin_members a
   WHERE NOT EXISTS (SELECT 1 FROM auth.mfa_factors f
       WHERE f.user_id=a.user_id AND f.factor_type='totp' AND f.status='verified')
     OR NOT EXISTS (SELECT 1 FROM auth.sessions s
       WHERE s.user_id=a.user_id AND s.aal='aal2'
         AND (s.not_after IS NULL OR s.not_after>now())
         AND s.updated_at>now()-interval '1 hour')
 ) THEN RAISE EXCEPTION 'MFA rollout blocked: an administrator lacks verified TOTP or recent AAL2 session'; END IF;
 -- Existing definitions and grants are preserved; any schema drift aborts.
 FOR target IN SELECT * FROM (VALUES
 ('public.admin_discount_promo_report()','a4980b072c01d23f0889c1023c7ba8ff',false),
 ('public.admin_referral_report()','d37a8e421b4900accddca295c7864030',false),
 ('public.admin_save_checkout_code(text,text,integer,integer,text,integer,boolean)','b3dc7a439cc0a70fa68ed1b1d1ada2b9',false),
 ('public.admin_toggle_referral_entry_mark(text,uuid,boolean,text)','dd7fa71d3ba4b7ac73d9f9872da0e18d',false),
 ('public.admin_toggle_referral_mark(uuid,boolean,text)','c6d85f3625fdfb9c443cdaa5cf2e713e',false),
 ('public.komi_admin_premium_grant(uuid,integer,text)','e13953e0a924b699ac8f140dd0f40bd3',false),
 ('public.komi_admin_premium_history()','3687b4608cbf1a1416c5b8adb011c016',false),
 ('public.komi_admin_premium_revoke(text)','97b756e7acdb6060580ce24a8b562884',false),
 ('public.komi_admin_premium_search(text)','441d7e79df273a45af15ca7198d51346',false),
 ('komi_anicoin_code_private.verified_actor(boolean)','564a4a05723ac302ea65ef0dcbfc35f2',true)
 ) AS t(signature,fingerprint,conditional_gate)
 LOOP
  definition:=pg_get_functiondef(to_regprocedure(target.signature));
  IF definition IS NULL OR md5(definition) IS DISTINCT FROM target.fingerprint
     OR strpos(definition,'Administrator MFA required')>0
  THEN RAISE EXCEPTION 'Unexpected function definition: %',target.signature; END IF;
  marker:=(regexp_match(definition,E'\\n[ \\t]*BEGIN[ \\t]*\\n','i'))[1];
  IF marker IS NULL OR (NOT target.conditional_gate AND strpos(definition,'komi_admin_members')<=strpos(definition,marker))
  THEN RAISE EXCEPTION 'Unexpected function body: %',target.signature; END IF;
  gate:=CASE WHEN target.conditional_gate THEN
   E'  IF p_admin_required AND (SELECT auth.jwt()->>''aal'') IS DISTINCT FROM ''aal2'' THEN\n    RAISE EXCEPTION ''Administrator MFA required'' USING errcode=''42501'';\n  END IF;\n'
  ELSE E'  IF (SELECT auth.jwt()->>''aal'') IS DISTINCT FROM ''aal2'' THEN\n    RAISE EXCEPTION ''Administrator MFA required'' USING errcode=''42501'';\n  END IF;\n' END;
  proposed:=overlay(definition placing marker||gate from strpos(definition,marker) for length(marker));
  EXECUTE proposed;
  patched:=patched+1;
 END LOOP;
 IF patched<>10 THEN RAISE EXCEPTION 'Incorrect protected function count'; END IF;
 EXECUTE 'CREATE POLICY "Komi admin catalog insert requires AAL2" ON public.anime_catalog AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK ((SELECT auth.jwt()->>''aal'') = ''aal2'')';
 EXECUTE 'CREATE POLICY "Komi admin catalog update requires AAL2" ON public.anime_catalog AS RESTRICTIVE FOR UPDATE TO authenticated USING ((SELECT auth.jwt()->>''aal'') = ''aal2'') WITH CHECK ((SELECT auth.jwt()->>''aal'') = ''aal2'')';
 -- Verify all 12 RPCs reject AAL1 before any write. Claims are transaction-local
 -- SQL fixtures, never signed or issued as actual Auth sessions.
 SELECT user_id INTO STRICT actor FROM public.komi_admin_members LIMIT 1;
 claims:=jsonb_build_object('sub',actor,'aal','aal1','role','authenticated','is_anonymous',false)::text;
 PERFORM set_config('request.jwt.claims',claims,true);
 PERFORM set_config('request.jwt.claim',claims,true);
 PERFORM set_config('request.jwt.claim.sub',actor::text,true);
 IF auth.uid() IS DISTINCT FROM actor OR (auth.jwt()->>'aal') IS DISTINCT FROM 'aal1'
    OR public.komi_is_admin() IS DISTINCT FROM true
 THEN RAISE EXCEPTION 'AAL1 test fixture or membership discovery invalid'; END IF;
 FOREACH test_call IN ARRAY ARRAY[
  'SELECT public.admin_discount_promo_report()',
  'SELECT public.admin_referral_report()',
  'SELECT public.admin_save_checkout_code(NULL::text,NULL::text,NULL::integer,NULL::integer,NULL::text,NULL::integer,NULL::boolean)',
  'SELECT public.admin_toggle_referral_entry_mark(NULL::text,NULL::uuid,NULL::boolean,NULL::text)',
  'SELECT public.admin_toggle_referral_mark(NULL::uuid,NULL::boolean,NULL::text)',
  'SELECT public.komi_admin_premium_grant(NULL::uuid,NULL::integer,NULL::text)',
  'SELECT public.komi_admin_premium_history()',
  'SELECT public.komi_admin_premium_revoke(NULL::text)',
  'SELECT public.komi_admin_premium_search('''')',
  'SELECT public.komi_admin_anicoin_code_create(0)',
  'SELECT public.komi_admin_anicoin_code_list()',
  'SELECT public.komi_admin_anicoin_code_revoke(NULL::uuid)'
 ] LOOP
  denied:=false;
  BEGIN
   EXECUTE test_call;
  EXCEPTION WHEN SQLSTATE '42501' THEN
   GET STACKED DIAGNOSTICS err=MESSAGE_TEXT;
   IF err='Administrator MFA required' THEN denied:=true; ELSE RAISE; END IF;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Admin AAL1 denial assertion failed'; END IF;
 END LOOP;
 -- Normal coin redemption's shared identity check is not MFA-gated.
 IF komi_anicoin_code_private.verified_actor(false) IS DISTINCT FROM actor
 THEN RAISE EXCEPTION 'Non-admin coin path regression'; END IF;
 claims:=jsonb_build_object('sub',actor,'aal','aal2','role','authenticated','is_anonymous',false)::text;
 PERFORM set_config('request.jwt.claims',claims,true);
 PERFORM set_config('request.jwt.claim',claims,true);
 IF (auth.jwt()->>'aal') IS DISTINCT FROM 'aal2'
    OR komi_anicoin_code_private.verified_actor(true) IS DISTINCT FROM actor
    OR public.komi_is_admin() IS DISTINCT FROM true
 THEN RAISE EXCEPTION 'AAL2 administrator assertion failed'; END IF;
 PERFORM public.komi_admin_premium_search('');
 -- AAL2 alone does not grant admin rights: synthetic nonmember only.
 actor:=gen_random_uuid();
 claims:=jsonb_build_object('sub',actor,'aal','aal2','role','authenticated','is_anonymous',false)::text;
 PERFORM set_config('request.jwt.claims',claims,true);
 PERFORM set_config('request.jwt.claim',claims,true);
 PERFORM set_config('request.jwt.claim.sub',actor::text,true);
 IF public.komi_is_admin() IS DISTINCT FROM false THEN RAISE EXCEPTION 'Nonmember assertion failed'; END IF;
 denied:=false;
 BEGIN
  PERFORM public.komi_admin_premium_search('');
 EXCEPTION WHEN SQLSTATE '42501' THEN denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'Nonmember AAL2 denial assertion failed'; END IF;
 PERFORM set_config('request.jwt.claims',coalesce(old_claims,''),true);
 PERFORM set_config('request.jwt.claim',coalesce(old_claim,''),true);
 PERFORM set_config('request.jwt.claim.sub',coalesce(old_sub,''),true);
END
$komi_admin_mfa$;