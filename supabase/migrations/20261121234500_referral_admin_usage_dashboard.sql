-- Track unique signed-in people who successfully validate a referral code.
-- Payment settlement and commission marking remain separate.
CREATE TABLE IF NOT EXISTS public.komi_referral_code_entries (
  code text NOT NULL REFERENCES public.referral_codes(code) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  is_reviewed boolean NOT NULL DEFAULT false,
  reviewed_at timestamptz,
  admin_note text CHECK (admin_note IS NULL OR length(admin_note) <= 240),
  PRIMARY KEY (code,user_id)
);
CREATE INDEX IF NOT EXISTS idx_komi_referral_entries_recent
  ON public.komi_referral_code_entries(first_seen_at DESC);
ALTER TABLE public.komi_referral_code_entries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.komi_referral_code_entries FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.komi_referral_code_entries TO service_role;

-- Valid referral checks create one entry per signed-in user and code. Repeats
-- update the last-seen time but do not inflate the number of people.
CREATE OR REPLACE FUNCTION public.validate_checkout_codes(
 p_promo_code text DEFAULT NULL, p_referral_code text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_user uuid := auth.uid();
        v_promo public.promo_codes%ROWTYPE;
        v_ref public.referral_codes%ROWTYPE;
        v_pc text := nullif(upper(btrim(p_promo_code)),'');
        v_rc text := nullif(upper(btrim(p_referral_code)),'');
        v_out jsonb := '{"promo_valid":false,"ref_valid":false}'::jsonb;
BEGIN
 IF v_user IS NULL THEN
   RAISE EXCEPTION 'Authentication required' USING errcode='42501';
 END IF;
 IF v_pc IS NOT NULL THEN
   SELECT * INTO v_promo FROM public.promo_codes
     WHERE code=v_pc AND is_active
       AND (expires_at IS NULL OR expires_at>now())
       AND (max_uses IS NULL OR uses_count<max_uses);
   IF FOUND THEN
     v_out := v_out || jsonb_build_object(
       'promo_valid',true,'promo_code',v_pc,
       'discount_percent',v_promo.discount_percent,
       'bonus_anicoin',v_promo.bonus_anicoin,'min_amount',v_promo.min_amount);
   ELSE
     v_out := v_out || jsonb_build_object('promo_error','Промокод не найден или недействителен');
   END IF;
 END IF;
 IF v_rc IS NOT NULL THEN
   SELECT * INTO v_ref FROM public.referral_codes WHERE code=v_rc AND is_active;
   IF NOT FOUND THEN
     v_out := v_out || jsonb_build_object('ref_error','Реферальный код не найден');
   ELSIF v_ref.owner_user_id=v_user THEN
     v_out := v_out || jsonb_build_object('ref_error','Нельзя использовать свой код');
   ELSE
     INSERT INTO public.komi_referral_code_entries(code,user_id)
       VALUES (v_rc,v_user)
       ON CONFLICT (code,user_id) DO UPDATE
       SET last_seen_at=now();
     v_out := v_out || jsonb_build_object(
       'ref_valid',true,'referral_code',v_rc,'owner_name',v_ref.owner_name);
   END IF;
 END IF;
 RETURN v_out;
END $$;
REVOKE ALL ON FUNCTION public.validate_checkout_codes(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.validate_checkout_codes(text,text) TO authenticated;

-- Admin-scoped report. Code totals are aggregate counts, independent of
-- the capped activity lists. No personal data is exposed to ordinary users.
CREATE OR REPLACE FUNCTION public.admin_referral_report()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_codes jsonb; v_entries jsonb; v_orders jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS (
   SELECT 1 FROM public.komi_admin_members WHERE user_id=auth.uid()
 ) THEN RAISE EXCEPTION 'Access denied' USING errcode='42501'; END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY q.code),'[]'::jsonb)
 INTO v_codes FROM (
   SELECT r.code,r.owner_name,r.reward_percent,r.is_active,r.created_at,
     coalesce(e.checked,0) AS checked,
     coalesce(e.reviewed,0) AS reviewed,
     e.last_checked,
     coalesce(p.entered,0) AS entered,
     coalesce(p.paid,0) AS paid,
     coalesce(p.turnover,0) AS turnover,
     coalesce(p.unpaid,0) AS unpaid
   FROM public.referral_codes r
   LEFT JOIN LATERAL (
     SELECT count(*)::int AS checked,
       count(*) FILTER (WHERE x.is_reviewed)::int AS reviewed,
       max(x.last_seen_at) AS last_checked
     FROM public.komi_referral_code_entries x WHERE x.code=r.code
   ) e ON true
   LEFT JOIN LATERAL (
     SELECT count(*)::int AS entered,
       count(*) FILTER (WHERE x.status='paid')::int AS paid,
       coalesce(sum(x.final_amount) FILTER (WHERE x.status='paid'),0) AS turnover,
       coalesce(sum(x.referrer_reward) FILTER (
         WHERE x.status='paid' AND NOT x.is_referral_marked),0) AS unpaid
     FROM public.payments x WHERE x.referral_code=r.code
   ) p ON true
 ) q;
 SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY q.first_seen_at DESC),'[]'::jsonb)
 INTO v_entries FROM (
   SELECT e.code,e.user_id,e.first_seen_at,e.last_seen_at,
     e.is_reviewed,e.reviewed_at,e.admin_note,
     coalesce(nullif(pr.display_name,''),nullif(pr.username,''),u.email,'Пользователь') AS display_name,
     pr.username,u.email,
     EXISTS (SELECT 1 FROM public.payments p
             WHERE p.user_id=e.user_id AND p.referral_code=e.code
               AND p.status='paid') AS has_paid
   FROM public.komi_referral_code_entries e
   LEFT JOIN public.komi_profiles pr ON pr.user_id=e.user_id
   LEFT JOIN auth.users u ON u.id=e.user_id
   ORDER BY e.first_seen_at DESC LIMIT 500
 ) q;
 SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY q.created_at DESC),'[]'::jsonb)
 INTO v_orders FROM (
   SELECT p.id,p.created_at,p.buyer_email,p.tariff_id,p.currency,
     p.base_amount,p.final_amount,p.referrer_reward,p.referral_code,p.promo_code,
     p.status,p.is_referral_marked,p.marked_at,p.admin_note
   FROM public.payments p WHERE p.referral_code IS NOT NULL
   ORDER BY p.created_at DESC LIMIT 300
 ) q;
 RETURN jsonb_build_object('codes',v_codes,'entries',v_entries,'orders',v_orders);
END $$;
REVOKE ALL ON FUNCTION public.admin_referral_report() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_referral_report() TO authenticated;

-- The user review flag does not imply a payout. Paid-order payout marking
-- remains in the existing admin_toggle_referral_mark RPC.
CREATE OR REPLACE FUNCTION public.admin_toggle_referral_entry_mark(
 p_code text,p_user_id uuid,p_marked boolean,p_note text DEFAULT NULL
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS (
   SELECT 1 FROM public.komi_admin_members WHERE user_id=auth.uid()
 ) THEN RAISE EXCEPTION 'Access denied' USING errcode='42501'; END IF;
 IF p_marked IS NULL OR (p_note IS NOT NULL AND length(p_note)>240) THEN
   RAISE EXCEPTION 'Invalid review update' USING errcode='22023';
 END IF;
 UPDATE public.komi_referral_code_entries e SET
   is_reviewed=p_marked,
   reviewed_at=CASE
     WHEN NOT p_marked THEN NULL
     WHEN e.is_reviewed THEN e.reviewed_at
     ELSE now() END,
   admin_note=CASE WHEN p_note IS NULL THEN e.admin_note
                   ELSE nullif(btrim(p_note),'') END
 WHERE e.code=upper(btrim(coalesce(p_code,''))) AND e.user_id=p_user_id;
 RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION public.admin_toggle_referral_entry_mark(text,uuid,boolean,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_toggle_referral_entry_mark(text,uuid,boolean,text)
 TO authenticated;
