-- Komi Premium billing data is isolated from user-editable profiles.
CREATE TABLE IF NOT EXISTS public.komi_premium_badges (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  active_until timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.komi_premium_badges ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.komi_premium_badges FROM PUBLIC, anon, authenticated;
GRANT SELECT(user_id) ON public.komi_premium_badges TO anon, authenticated;
GRANT ALL ON public.komi_premium_badges TO service_role;
DROP POLICY IF EXISTS "verified active komi premium" ON public.komi_premium_badges;
CREATE POLICY "verified active komi premium" ON public.komi_premium_badges
  FOR SELECT TO anon, authenticated USING (active_until > now());

CREATE TABLE IF NOT EXISTS public.komi_premium_contracts (
  contract_id text PRIMARY KEY CHECK(length(contract_id) BETWEEN 5 AND 160),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  buyer_email text NOT NULL,
  offer_id text NOT NULL,
  paid_until timestamptz NOT NULL,
  last_event_at timestamptz NOT NULL,
  canceled_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS komi_premium_contract_user_idx ON public.komi_premium_contracts(user_id);
ALTER TABLE public.komi_premium_contracts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.komi_premium_contracts FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.komi_premium_contracts TO service_role;

CREATE TABLE IF NOT EXISTS public.komi_premium_events (
  event_key text PRIMARY KEY CHECK(length(event_key) BETWEEN 5 AND 240),
  contract_id text NOT NULL,
  event_type text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.komi_premium_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.komi_premium_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.komi_premium_events TO service_role;

-- This atomic RPC is never accessible to public/anon/authenticated browser roles.
CREATE OR REPLACE FUNCTION public.komi_apply_lava_premium_event(
  p_event_key text,
  p_event_type text,
  p_contract_id text,
  p_buyer_email text,
  p_offer_id text,
  p_event_at timestamptz,
  p_expiry timestamptz DEFAULT NULL
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE
  v_contract public.komi_premium_contracts%ROWTYPE;
  v_existing boolean;
  v_user uuid;
  v_until timestamptz;
  v_now timestamptz := now();
  v_result text;
BEGIN
  IF p_event_type NOT IN (
    'payment.success','payment.failed',
    'subscription.recurring.payment.success','subscription.recurring.payment.failed',
    'subscription.cancelled','refund.success','chargeback.initiated'
  ) THEN RETURN 'ignored_event'; END IF;
  IF length(coalesce(p_event_key,'')) NOT BETWEEN 5 AND 240
     OR length(coalesce(p_contract_id,'')) NOT BETWEEN 5 AND 160
     OR p_event_at IS NULL OR p_event_at > v_now + interval '1 day'
     OR p_event_at < v_now - interval '2 years'
  THEN RETURN 'invalid_event'; END IF;
  IF p_offer_id IS NOT NULL AND p_offer_id <> 'f1b11818-74d5-4e94-a013-15d89a545cdd'
  THEN RETURN 'unrecognized_offer'; END IF;
  IF p_event_type='payment.success' AND p_offer_id IS NULL
  THEN RETURN 'missing_offer'; END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(p_contract_id));
  SELECT * INTO v_contract FROM public.komi_premium_contracts
    WHERE contract_id=p_contract_id FOR UPDATE;
  v_existing := FOUND;
  IF v_existing THEN
    v_user:=v_contract.user_id;
    IF trim(coalesce(p_buyer_email,'')) <> ''
       AND lower(trim(p_buyer_email)) <> v_contract.buyer_email
    THEN RETURN 'email_conflict'; END IF;
    IF p_event_at < v_contract.last_event_at
       AND p_event_type NOT IN ('refund.success','chargeback.initiated')
    THEN RETURN 'stale_event'; END IF;
  ELSE
    IF p_event_type <> 'payment.success' THEN RETURN 'unknown_contract'; END IF;
    IF coalesce(trim(p_buyer_email),'')=''
       OR length(p_buyer_email)>320 THEN RETURN 'missing_email'; END IF;
    SELECT id INTO v_user FROM auth.users
      WHERE lower(email)=lower(trim(p_buyer_email))
        AND email_confirmed_at IS NOT NULL ORDER BY created_at DESC LIMIT 1;
    IF v_user IS NULL THEN RETURN 'unmatched_verified_email'; END IF;
  END IF;

  INSERT INTO public.komi_premium_events(event_key,contract_id,event_type)
    VALUES(p_event_key,p_contract_id,p_event_type)
    ON CONFLICT(event_key) DO NOTHING;
  IF NOT FOUND THEN RETURN 'duplicate_event'; END IF;

  IF p_event_type IN ('payment.success','subscription.recurring.payment.success') THEN
    v_until := (CASE WHEN v_existing
      THEN greatest(v_contract.paid_until,p_event_at)
      ELSE p_event_at END) + interval '1 month';
    IF NOT v_existing AND p_expiry IS NOT NULL
       AND p_expiry>p_event_at AND p_expiry<p_event_at+interval '40 days'
    THEN v_until:=p_expiry; END IF;
    IF v_existing THEN
      UPDATE public.komi_premium_contracts SET
        paid_until=v_until, last_event_at=p_event_at, revoked_at=NULL,
        canceled_at=NULL WHERE contract_id=p_contract_id;
    ELSE
      INSERT INTO public.komi_premium_contracts
        (contract_id,user_id,buyer_email,offer_id,paid_until,last_event_at)
      VALUES(p_contract_id,v_user,lower(trim(p_buyer_email)),
        p_offer_id,v_until,p_event_at);
    END IF;
    v_result:='activated';
  ELSIF p_event_type='subscription.cancelled' THEN
    -- The remaining purchased period stays valid.
    UPDATE public.komi_premium_contracts SET
      canceled_at=p_event_at, last_event_at=p_event_at,
      paid_until=CASE
        WHEN p_expiry IS NOT NULL AND p_expiry>p_event_at
        THEN least(paid_until,p_expiry) ELSE paid_until END
    WHERE contract_id=p_contract_id;
    v_result:='canceled_at_period_end';
  ELSIF p_event_type IN ('refund.success','chargeback.initiated') THEN
    UPDATE public.komi_premium_contracts SET
      revoked_at=p_event_at,paid_until=least(paid_until,p_event_at),
      last_event_at=greatest(last_event_at,p_event_at)
    WHERE contract_id=p_contract_id;
    v_result:='revoked';
  ELSE
    UPDATE public.komi_premium_contracts SET last_event_at=p_event_at
      WHERE contract_id=p_contract_id;
    v_result:='payment_failed';
  END IF;

  SELECT max(paid_until) INTO v_until FROM public.komi_premium_contracts
    WHERE user_id=v_user AND revoked_at IS NULL AND paid_until>v_now;
  IF v_until IS NULL THEN
    DELETE FROM public.komi_premium_badges WHERE user_id=v_user;
  ELSE
    INSERT INTO public.komi_premium_badges(user_id,active_until)
      VALUES(v_user,v_until)
      ON CONFLICT(user_id) DO UPDATE
      SET active_until=excluded.active_until,updated_at=now();
  END IF;
  RETURN v_result;
END
$function$;
REVOKE ALL ON FUNCTION public.komi_apply_lava_premium_event(
  text,text,text,text,text,timestamptz,timestamptz
) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.komi_apply_lava_premium_event(
  text,text,text,text,text,timestamptz,timestamptz
) TO service_role;
