-- REVIEW ONLY. Not a migration; not automatically applied.
-- Before execution, publish and test the isolated admin enrollment page,
-- enroll a primary and independent backup TOTP device for every admin,
-- demonstrate recovery and test this exact change on an isolated database.
-- The role-discovery RPC komi_is_admin() deliberately remains membership-only
-- so AAL1 admins can still reach the second-factor challenge.
BEGIN;
DO $komi_mfa_review$
DECLARE
  target record;
  definition text;
  marker text;
  proposed text;
  gate CONSTANT text := E'  IF (SELECT auth.jwt()->>''aal'') IS DISTINCT FROM ''aal2'' THEN\n    RAISE EXCEPTION ''Administrator MFA required'' USING errcode=''42501'';\n  END IF;\n';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.komi_admin_members)
     OR EXISTS (
       SELECT 1 FROM public.komi_admin_members a
       WHERE (SELECT count(*) FROM auth.mfa_factors f
              WHERE f.user_id=a.user_id AND f.status='verified' AND f.factor_type='totp') < 2
          OR NOT EXISTS (
            SELECT 1 FROM auth.sessions s
            WHERE s.user_id=a.user_id AND s.aal='aal2'
              AND (s.not_after IS NULL OR s.not_after > now())
              AND s.updated_at > now()-interval '1 hour'
          )
     )
  THEN
    RAISE EXCEPTION 'MFA rollout blocked: verify primary and backup factors and recent AAL2 sessions for all administrators';
  END IF;
  -- All identities and expected definitions were captured during read-only review.
  -- Fail closed on schema drift; transaction rolls back all changes.
  FOR target IN SELECT * FROM (VALUES
    ('public.admin_discount_promo_report()', 'a4980b072c01d23f0889c1023c7ba8ff'),
    ('public.admin_referral_report()', 'd37a8e421b4900accddca295c7864030'),
    ('public.admin_save_checkout_code(text,text,integer,integer,text,integer,boolean)', 'b3dc7a439cc0a70fa68ed1b1d1ada2b9'),
    ('public.admin_toggle_referral_entry_mark(text,uuid,boolean,text)', 'dd7fa71d3ba4b7ac73d9f9872da0e18d'),
    ('public.admin_toggle_referral_mark(uuid,boolean,text)', 'c6d85f3625fdfb9c443cdaa5cf2e713e'),
    ('public.komi_admin_premium_grant(uuid,integer,text)', 'e13953e0a924b699ac8f140dd0f40bd3'),
    ('public.komi_admin_premium_history()', '3687b4608cbf1a1416c5b8adb011c016'),
    ('public.komi_admin_premium_revoke(text)', '97b756e7acdb6060580ce24a8b562884'),
    ('public.komi_admin_premium_search(text)', '441d7e79df273a45af15ca7198d51346')
  ) AS t(signature,fingerprint)
  LOOP
    definition := pg_catalog.pg_get_functiondef(pg_catalog.to_regprocedure(target.signature));
    IF definition IS NULL OR md5(definition) IS DISTINCT FROM target.fingerprint THEN
      RAISE EXCEPTION 'MFA rollout blocked: function definition changed: %',target.signature;
    END IF;
    marker := (regexp_match(definition,E'\\n[ \\t]*BEGIN[ \\t]*\\n','i'))[1];
    IF marker IS NULL OR strpos(definition,'komi_admin_members')<=strpos(definition,marker) THEN
      RAISE EXCEPTION 'MFA rollout blocked: unexpected function structure: %',target.signature;
    END IF;
    proposed := overlay(definition placing marker||gate from strpos(definition,marker) for length(marker));
    EXECUTE proposed;
  END LOOP;
END
$komi_mfa_review$;
-- Restrictive policies preserve existing membership checks, not replace them.
-- Ordinary catalogue reads and service-role catalogue sync are unaffected.
CREATE POLICY "Komi admin catalog insert requires AAL2"
ON public.anime_catalog AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK ((SELECT auth.jwt()->>'aal') = 'aal2');
CREATE POLICY "Komi admin catalog update requires AAL2"
ON public.anime_catalog AS RESTRICTIVE FOR UPDATE TO authenticated
USING ((SELECT auth.jwt()->>'aal') = 'aal2')
WITH CHECK ((SELECT auth.jwt()->>'aal') = 'aal2');
COMMIT;
