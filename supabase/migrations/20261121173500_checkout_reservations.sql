-- Reserve limited promo activations at invoice creation, not only after payment.
ALTER TABLE public.promo_codes
  ADD COLUMN IF NOT EXISTS reserved_uses integer NOT NULL DEFAULT 0
    CHECK(reserved_uses >= 0);

CREATE OR REPLACE FUNCTION komi_private.reserve_checkout_coupon()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_discount integer;
BEGIN
  IF NEW.promo_code IS NOT NULL THEN
    UPDATE public.promo_codes pc SET reserved_uses=reserved_uses+1
      WHERE pc.code=NEW.promo_code
        AND pc.is_active
        AND (pc.expires_at IS NULL OR pc.expires_at>now())
        AND (pc.max_uses IS NULL OR pc.uses_count+pc.reserved_uses<pc.max_uses)
        AND NEW.base_amount>=pc.min_amount
      RETURNING pc.discount_percent INTO v_discount;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Promo code unavailable or exhausted' USING errcode='22023';
    END IF;
    IF NEW.tariff_id='premium_monthly' AND v_discount>0 THEN
      RAISE EXCEPTION 'Recurring Premium cannot use custom-price discounts'
        USING errcode='22023';
    END IF;
  END IF;
  IF NEW.referral_code IS NOT NULL AND NOT EXISTS(
    SELECT 1 FROM public.referral_codes r
    WHERE r.code=NEW.referral_code AND r.is_active
      AND (r.owner_user_id IS NULL OR r.owner_user_id<>NEW.user_id)
  ) THEN
    RAISE EXCEPTION 'Invalid or self referral' USING errcode='22023';
  END IF;
  RETURN NEW;
END $function$;
REVOKE ALL ON FUNCTION komi_private.reserve_checkout_coupon()
 FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS trg_komi_checkout_reserve_coupon ON public.payments;
CREATE TRIGGER trg_komi_checkout_reserve_coupon
BEFORE INSERT ON public.payments
FOR EACH ROW EXECUTE FUNCTION komi_private.reserve_checkout_coupon();

-- Idempotent credit and lifecycle: a paid invoice consumes exactly one reserved use.
CREATE OR REPLACE FUNCTION komi_private.checkout_paid_bonus()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF OLD.status='pending' AND NEW.promo_code IS NOT NULL THEN
      UPDATE public.promo_codes
        SET reserved_uses=greatest(0,reserved_uses-1)
        WHERE code=NEW.promo_code;
    END IF;
    IF NEW.status='paid' AND OLD.status IS DISTINCT FROM 'paid' THEN
      IF NEW.promo_code IS NOT NULL THEN
        UPDATE public.promo_codes
          SET uses_count=uses_count+1 WHERE code=NEW.promo_code;
      END IF;
      IF NEW.bonus_anicoin>0 THEN
        INSERT INTO public.komi_checkout_bonus_awards(payment_id,user_id,amount)
          VALUES(NEW.id,NEW.user_id,NEW.bonus_anicoin)
          ON CONFLICT(payment_id) DO NOTHING;
        IF FOUND THEN
          INSERT INTO public.komi_anicoin_wallets(user_id,balance)
            VALUES(NEW.user_id,NEW.bonus_anicoin)
            ON CONFLICT(user_id) DO UPDATE SET
              balance=public.komi_anicoin_wallets.balance+excluded.balance;
          INSERT INTO public.komi_anicoin_ledger(user_id,delta,reason)
            VALUES(NEW.user_id,NEW.bonus_anicoin,'promo_checkout');
        END IF;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $function$;
REVOKE ALL ON FUNCTION komi_private.checkout_paid_bonus()
 FROM PUBLIC,anon,authenticated;

-- An authenticated webhook may finalize only by the correct stored invoice.
-- Protect against finalizing an invoice belonging to a different buyer.
CREATE OR REPLACE FUNCTION public.komi_finalize_checkout_payment(
 p_invoice_id text,p_status text,p_buyer_email text DEFAULT NULL
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_payment public.payments%ROWTYPE;
BEGIN
 IF current_setting('request.jwt.claim.role',true) IS DISTINCT FROM 'service_role'
 THEN RAISE EXCEPTION 'Trusted service only' USING errcode='42501'; END IF;
 IF p_status NOT IN ('paid','failed','refunded','chargeback')
    OR length(coalesce(p_invoice_id,''))<5
 THEN RAISE EXCEPTION 'Invalid payment update' USING errcode='22023'; END IF;
 SELECT * INTO v_payment FROM public.payments
 WHERE provider_invoice_id=p_invoice_id FOR UPDATE;
 IF NOT FOUND THEN RETURN false; END IF;
 IF p_buyer_email IS NOT NULL AND lower(btrim(p_buyer_email))<>v_payment.buyer_email
 THEN RAISE EXCEPTION 'Buyer mismatch' USING errcode='42501'; END IF;
 IF v_payment.status IN ('refunded','chargeback') THEN RETURN true; END IF;
 IF v_payment.status='paid' AND p_status='failed' THEN RETURN true; END IF;
 IF v_payment.status=p_status THEN RETURN true; END IF;
 UPDATE public.payments SET status=p_status,updated_at=now(),
   paid_at=CASE WHEN p_status='paid' THEN coalesce(paid_at,now()) ELSE paid_at END
 WHERE id=v_payment.id;
 RETURN true;
END $function$;
REVOKE ALL ON FUNCTION public.komi_finalize_checkout_payment(text,text,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.komi_finalize_checkout_payment(text,text,text)
 TO service_role;
-- Retire the legacy two-argument variant; callers use the verified buyer email.
DROP FUNCTION IF EXISTS public.komi_finalize_checkout_payment(text,text);
