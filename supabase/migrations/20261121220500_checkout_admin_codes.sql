-- Admin-only issuance for promotion/referral codes. Exposed RPC still checks
-- server-owned komi_admin_members, never client-editable profile metadata.
CREATE OR REPLACE FUNCTION public.admin_save_checkout_code(
  p_kind text,
  p_code text,
  p_bonus_anicoin integer DEFAULT 0,
  p_max_uses integer DEFAULT NULL,
  p_owner_name text DEFAULT NULL,
  p_reward_percent integer DEFAULT 15,
  p_is_active boolean DEFAULT true
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_code text := upper(btrim(coalesce(p_code,'')));
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.komi_admin_members WHERE user_id=auth.uid()
  ) THEN
    RAISE EXCEPTION 'Admin required' USING errcode='42501';
  END IF;
  IF v_code !~ '^[A-Z0-9_-]{3,40}$' THEN
    RAISE EXCEPTION 'Invalid code' USING errcode='22023';
  END IF;
  IF p_kind='promo' THEN
    IF p_bonus_anicoin NOT BETWEEN 0 AND 10000
       OR (p_max_uses IS NOT NULL AND p_max_uses NOT BETWEEN 1 AND 100000)
    THEN RAISE EXCEPTION 'Invalid promo options' USING errcode='22023'; END IF;
    INSERT INTO public.promo_codes(code,bonus_anicoin,max_uses,is_active)
    VALUES(v_code,p_bonus_anicoin,p_max_uses,p_is_active)
    ON CONFLICT(code) DO UPDATE SET
      bonus_anicoin=excluded.bonus_anicoin,
      max_uses=excluded.max_uses,
      is_active=excluded.is_active
    WHERE public.promo_codes.uses_count<=coalesce(excluded.max_uses,2147483647)
      AND public.promo_codes.uses_count+public.promo_codes.reserved_uses
       <=coalesce(excluded.max_uses,2147483647)
      AND public.promo_codes.discount_percent=0;
    IF NOT FOUND THEN RAISE EXCEPTION 'Promo already used or incompatible' USING errcode='22023'; END IF;
    RETURN jsonb_build_object('kind','promo','code',v_code,'bonus_anicoin',p_bonus_anicoin);
  ELSIF p_kind='referral' THEN
    IF coalesce(length(btrim(p_owner_name)),0) NOT BETWEEN 1 AND 120
      OR p_reward_percent NOT BETWEEN 0 AND 50
    THEN RAISE EXCEPTION 'Invalid referral options' USING errcode='22023'; END IF;
    INSERT INTO public.referral_codes(code,owner_name,reward_percent,is_active)
    VALUES(v_code,btrim(p_owner_name),p_reward_percent,p_is_active)
    ON CONFLICT(code) DO UPDATE SET
      owner_name=excluded.owner_name,reward_percent=excluded.reward_percent,is_active=excluded.is_active;
    RETURN jsonb_build_object('kind','referral','code',v_code,'owner_name',btrim(p_owner_name));
  END IF;
  RAISE EXCEPTION 'Unknown code kind' USING errcode='22023';
END $$;
REVOKE ALL ON FUNCTION public.admin_save_checkout_code(text,text,integer,integer,text,integer,boolean)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_save_checkout_code(text,text,integer,integer,text,integer,boolean)
 TO authenticated;
