-- Komi Premium checkout attribution. Independent from komi_private signup referrals.
-- No browser writes to payment/coupon tables; server-issued invoices only.
CREATE TABLE IF NOT EXISTS public.promo_codes (
  code text PRIMARY KEY CHECK (code ~ '^[A-Z0-9_-]{3,40}$'),
  discount_percent integer NOT NULL DEFAULT 0 CHECK (discount_percent BETWEEN 0 AND 90),
  bonus_anicoin integer NOT NULL DEFAULT 0 CHECK (bonus_anicoin BETWEEN 0 AND 100000),
  min_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (min_amount >= 0),
  max_uses integer CHECK (max_uses IS NULL OR max_uses > 0),
  uses_count integer NOT NULL DEFAULT 0 CHECK (uses_count >= 0),
  expires_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.referral_codes (
  code text PRIMARY KEY CHECK (code ~ '^[A-Z0-9_-]{3,40}$'),
  owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  owner_name text NOT NULL CHECK (length(btrim(owner_name)) BETWEEN 1 AND 120),
  reward_percent integer NOT NULL DEFAULT 15 CHECK (reward_percent BETWEEN 0 AND 100),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  buyer_email text NOT NULL,
  tariff_id text NOT NULL DEFAULT 'premium_monthly',
  provider text NOT NULL DEFAULT 'lava',
  provider_invoice_id text UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','paid','failed','refunded','chargeback')),
  currency text NOT NULL CHECK(currency IN ('USD','EUR','RUB')),
  base_amount numeric(12,2) NOT NULL CHECK(base_amount > 0),
  final_amount numeric(12,2) NOT NULL CHECK(final_amount > 0),
  discount_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK(discount_amount >= 0),
  promo_code text REFERENCES public.promo_codes(code) ON DELETE SET NULL,
  referral_code text REFERENCES public.referral_codes(code) ON DELETE SET NULL,
  referrer_reward numeric(12,2) NOT NULL DEFAULT 0 CHECK(referrer_reward >= 0),
  bonus_anicoin integer NOT NULL DEFAULT 0 CHECK(bonus_anicoin BETWEEN 0 AND 100000),
  is_referral_marked boolean NOT NULL DEFAULT false,
  marked_at timestamptz,
  admin_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK(final_amount + discount_amount = base_amount)
);
CREATE INDEX IF NOT EXISTS idx_payments_referral_tracking ON public.payments(referral_code,status,is_referral_marked) WHERE referral_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payments_user_checkout ON public.payments(user_id,created_at DESC);
CREATE TABLE IF NOT EXISTS public.komi_checkout_bonus_awards(
  payment_id uuid PRIMARY KEY REFERENCES public.payments(id),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  amount integer NOT NULL CHECK(amount > 0),
  credited_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.komi_checkout_bonus_awards ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.promo_codes,public.referral_codes,public.payments,public.komi_checkout_bonus_awards FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.promo_codes,public.referral_codes,public.payments,public.komi_checkout_bonus_awards TO service_role;
-- Preserve the existing ledger reasons, adding a specifically auditable checkout promo reason.
ALTER TABLE public.komi_anicoin_ledger DROP CONSTRAINT IF EXISTS komi_anicoin_ledger_reason_check;
ALTER TABLE public.komi_anicoin_ledger ADD CONSTRAINT komi_anicoin_ledger_reason_check
  CHECK(reason IN ('watch','premium_welcome','quest_daily','referral','promo_checkout'));

CREATE OR REPLACE FUNCTION public.validate_checkout_codes(
 p_promo_code text DEFAULT NULL,p_referral_code text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_user uuid:=auth.uid(); v_promo public.promo_codes%ROWTYPE;
        v_ref public.referral_codes%ROWTYPE;
        v_pc text:=nullif(upper(btrim(p_promo_code)),'');
        v_rc text:=nullif(upper(btrim(p_referral_code)),'');
        v_out jsonb:='{"promo_valid":false,"ref_valid":false}'::jsonb;
BEGIN
 IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required' USING errcode='42501'; END IF;
 IF v_pc IS NOT NULL THEN
   SELECT * INTO v_promo FROM public.promo_codes WHERE code=v_pc AND is_active
     AND (expires_at IS NULL OR expires_at>now())
     AND (max_uses IS NULL OR uses_count<max_uses);
   IF FOUND THEN
     v_out:=v_out||jsonb_build_object('promo_valid',true,'promo_code',v_pc,
       'discount_percent',v_promo.discount_percent,'bonus_anicoin',v_promo.bonus_anicoin,
       'min_amount',v_promo.min_amount);
   ELSE v_out:=v_out||jsonb_build_object('promo_error','Промокод не найден или недействителен');
   END IF;
 END IF;
 IF v_rc IS NOT NULL THEN
   SELECT * INTO v_ref FROM public.referral_codes WHERE code=v_rc AND is_active;
   IF NOT FOUND THEN v_out:=v_out||jsonb_build_object('ref_error','Реферальный код не найден');
   ELSIF v_ref.owner_user_id=v_user THEN
     v_out:=v_out||jsonb_build_object('ref_error','Нельзя использовать свой код');
   ELSE
     v_out:=v_out||jsonb_build_object('ref_valid',true,'referral_code',v_rc,
       'owner_name',v_ref.owner_name);
   END IF;
 END IF;
 RETURN v_out;
END $$;
REVOKE ALL ON FUNCTION public.validate_checkout_codes(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.validate_checkout_codes(text,text) TO authenticated;

-- Transactions update the ledger only after a verified provider event sets 'paid'.
CREATE OR REPLACE FUNCTION komi_private.checkout_paid_bonus()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
BEGIN
 IF NEW.status='paid' AND OLD.status IS DISTINCT FROM 'paid' THEN
   IF NEW.promo_code IS NOT NULL THEN
     UPDATE public.promo_codes SET uses_count=uses_count+1 WHERE code=NEW.promo_code;
   END IF;
   IF NEW.bonus_anicoin>0 THEN
     INSERT INTO public.komi_checkout_bonus_awards(payment_id,user_id,amount)
     VALUES(NEW.id,NEW.user_id,NEW.bonus_anicoin) ON CONFLICT(payment_id) DO NOTHING;
     IF FOUND THEN
       INSERT INTO public.komi_anicoin_wallets(user_id,balance)
       VALUES(NEW.user_id,NEW.bonus_anicoin)
       ON CONFLICT(user_id) DO UPDATE SET balance=public.komi_anicoin_wallets.balance+EXCLUDED.balance;
       INSERT INTO public.komi_anicoin_ledger(user_id,delta,reason)
       VALUES(NEW.user_id,NEW.bonus_anicoin,'promo_checkout');
     END IF;
   END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION komi_private.checkout_paid_bonus() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS trg_komi_checkout_paid_bonus ON public.payments;
CREATE TRIGGER trg_komi_checkout_paid_bonus AFTER UPDATE OF status ON public.payments
FOR EACH ROW EXECUTE FUNCTION komi_private.checkout_paid_bonus();

-- Only trusted webhook service_role can finalize a payment, matching the issued invoice.
CREATE OR REPLACE FUNCTION public.komi_finalize_checkout_payment(
 p_invoice_id text,p_status text
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_before text; v_after text;
BEGIN
 IF current_setting('request.jwt.claim.role',true) IS DISTINCT FROM 'service_role'
 THEN RAISE EXCEPTION 'Trusted service only' USING errcode='42501'; END IF;
 IF p_status NOT IN ('paid','failed','refunded','chargeback') OR length(coalesce(p_invoice_id,''))<5
 THEN RAISE EXCEPTION 'Invalid payment update' USING errcode='22023'; END IF;
 SELECT status INTO v_before FROM public.payments WHERE provider_invoice_id=p_invoice_id FOR UPDATE;
 IF NOT FOUND THEN RETURN false; END IF;
 IF v_before='paid' AND p_status='failed' THEN RETURN true; END IF;
 IF v_before IN ('refunded','chargeback') THEN RETURN true; END IF;
 UPDATE public.payments SET status=p_status,updated_at=now(),
 paid_at=CASE WHEN p_status='paid' THEN coalesce(paid_at,now()) ELSE paid_at END
 WHERE provider_invoice_id=p_invoice_id;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.komi_finalize_checkout_payment(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.komi_finalize_checkout_payment(text,text) TO service_role;

CREATE OR REPLACE FUNCTION public.admin_toggle_referral_mark(
 p_payment_id uuid,p_marked boolean,p_note text DEFAULT NULL
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(
   SELECT 1 FROM public.komi_admin_members WHERE user_id=auth.uid()
 ) THEN RAISE EXCEPTION 'Access denied' USING errcode='42501'; END IF;
 IF p_note IS NOT NULL AND length(p_note)>240 THEN RAISE EXCEPTION 'Note too long' USING errcode='22023'; END IF;
 UPDATE public.payments SET is_referral_marked=p_marked,
   marked_at=CASE WHEN p_marked THEN now() ELSE NULL END,
   admin_note=CASE WHEN p_note IS NULL THEN admin_note ELSE nullif(btrim(p_note),'') END,
   updated_at=now()
 WHERE id=p_payment_id AND status='paid' AND referral_code IS NOT NULL;
 RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION public.admin_toggle_referral_mark(uuid,boolean,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_toggle_referral_mark(uuid,boolean,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_referral_report()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_codes jsonb; v_orders jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(
   SELECT 1 FROM public.komi_admin_members WHERE user_id=auth.uid()
 ) THEN RAISE EXCEPTION 'Access denied' USING errcode='42501'; END IF;
 SELECT coalesce(jsonb_agg(row_to_json(q) ORDER BY q.code),'[]'::jsonb) INTO v_codes FROM (
  SELECT r.code,r.owner_name,r.reward_percent,
    count(p.id)::int AS entered,
    count(p.id) FILTER(WHERE p.status='paid')::int AS paid,
    coalesce(sum(p.final_amount) FILTER(WHERE p.status='paid'),0) AS turnover,
    coalesce(sum(p.referrer_reward) FILTER(WHERE p.status='paid' AND NOT p.is_referral_marked),0) AS unpaid
  FROM public.referral_codes r LEFT JOIN public.payments p ON p.referral_code=r.code
  GROUP BY r.code,r.owner_name,r.reward_percent
 ) q;
 SELECT coalesce(jsonb_agg(row_to_json(q) ORDER BY q.created_at DESC),'[]'::jsonb)
 INTO v_orders FROM (
  SELECT p.id,p.created_at,p.buyer_email,p.tariff_id,p.currency,
    p.base_amount,p.final_amount,p.referrer_reward,p.referral_code,p.promo_code,
    p.status,p.is_referral_marked,p.marked_at,p.admin_note
  FROM public.payments p WHERE p.referral_code IS NOT NULL
  ORDER BY p.created_at DESC LIMIT 300
 ) q;
 RETURN jsonb_build_object('codes',v_codes,'orders',v_orders);
END $$;
REVOKE ALL ON FUNCTION public.admin_referral_report() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_referral_report() TO authenticated;
