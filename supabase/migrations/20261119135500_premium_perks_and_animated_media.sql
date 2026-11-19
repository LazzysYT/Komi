-- Komi Premium perks. Non-destructive: separate immutable bonus ledger and premium-only media.
-- 2000 XP corresponds to level 5 under the revised 500 XP/level progression.
-- Welcome rewards are granted ONCE per user ID, not on each payment or renewal.

CREATE TABLE IF NOT EXISTS public.komi_premium_rewards (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  xp_awarded integer NOT NULL DEFAULT 2000 CHECK (xp_awarded = 2000),
  coins_awarded integer NOT NULL DEFAULT 500 CHECK (coins_awarded = 500),
  granted_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.komi_premium_rewards ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.komi_premium_rewards FROM PUBLIC, anon, authenticated;
GRANT SELECT(user_id,xp_awarded) ON public.komi_premium_rewards TO anon, authenticated;
GRANT ALL ON public.komi_premium_rewards TO service_role;
DROP POLICY IF EXISTS "public can see awarded premium XP" ON public.komi_premium_rewards;
CREATE POLICY "public can see awarded premium XP" ON public.komi_premium_rewards
 FOR SELECT TO anon, authenticated USING (true);

-- Preserve the existing watch ledger; extend only its reason constraint.
ALTER TABLE public.komi_anicoin_ledger
 DROP CONSTRAINT IF EXISTS komi_anicoin_ledger_reason_check;
ALTER TABLE public.komi_anicoin_ledger
 ADD CONSTRAINT komi_anicoin_ledger_reason_check
 CHECK (reason IN ('watch','premium_welcome'));

CREATE OR REPLACE FUNCTION public.komi_credit_premium_welcome()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.komi_anicoin_wallets (user_id, balance)
    VALUES (NEW.user_id, NEW.coins_awarded)
  ON CONFLICT (user_id) DO UPDATE
    SET balance = public.komi_anicoin_wallets.balance + EXCLUDED.balance;
  INSERT INTO public.komi_anicoin_ledger (user_id, delta, reason)
    VALUES (NEW.user_id, NEW.coins_awarded, 'premium_welcome');
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.komi_credit_premium_welcome() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_credit_premium_welcome ON public.komi_premium_rewards;
CREATE TRIGGER trg_credit_premium_welcome
 AFTER INSERT ON public.komi_premium_rewards
 FOR EACH ROW EXECUTE FUNCTION public.komi_credit_premium_welcome();

CREATE OR REPLACE FUNCTION public.komi_award_premium_once()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NEW.active_until > now() THEN
    INSERT INTO public.komi_premium_rewards(user_id)
      VALUES (NEW.user_id) ON CONFLICT (user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.komi_award_premium_once() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_award_premium_once ON public.komi_premium_badges;
CREATE TRIGGER trg_award_premium_once
 AFTER INSERT OR UPDATE OF active_until ON public.komi_premium_badges
 FOR EACH ROW EXECUTE FUNCTION public.komi_award_premium_once();

-- Backfill users who already have a valid paid or owner-issued Premium badge.
-- Unique key + INSERT trigger guarantee exactly one lifetime credit.
INSERT INTO public.komi_premium_rewards (user_id)
 SELECT user_id FROM public.komi_premium_badges
 WHERE active_until > now()
 ON CONFLICT (user_id) DO NOTHING;

-- Active badge SELECT policy filters expired rows. No direct SELECT privilege for active_until is exposed.
-- Animated GIFs are a paid entitlement; storage and metadata are separately secured.
-- Existing JPEG avatar upload policy remains unchanged.
UPDATE storage.buckets SET
  allowed_mime_types = ARRAY['image/jpeg','image/gif']::text[],
  file_size_limit = 6291456
 WHERE id = 'avatars';
DROP POLICY IF EXISTS "Komi premium own animated avatar" ON storage.objects;
CREATE POLICY "Komi premium own animated avatar" ON storage.objects
 FOR INSERT TO authenticated WITH CHECK (
   bucket_id = 'avatars' AND storage.extension(name) = 'gif'
   AND cardinality(storage.foldername(name)) = 1
   AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
   AND EXISTS (
     SELECT 1 FROM public.komi_premium_badges b
     WHERE b.user_id = (SELECT auth.uid())
   )
 );

INSERT INTO storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
 VALUES ('premium-profile-backgrounds','premium-profile-backgrounds',true,
 8388608,ARRAY['image/gif']::text[])
 ON CONFLICT (id) DO NOTHING;
DROP POLICY IF EXISTS "Komi premium own animated profile background" ON storage.objects;
CREATE POLICY "Komi premium own animated profile background" ON storage.objects
 FOR INSERT TO authenticated WITH CHECK (
   bucket_id = 'premium-profile-backgrounds'
   AND storage.extension(name) = 'gif'
   AND cardinality(storage.foldername(name)) = 1
   AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
   AND EXISTS (
     SELECT 1 FROM public.komi_premium_badges b
     WHERE b.user_id = (SELECT auth.uid())
   )
 );

CREATE TABLE IF NOT EXISTS public.komi_premium_media (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 avatar_path text,
 background_path text,
 updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT premium_avatar_path_own CHECK (
   avatar_path IS NULL OR (
     avatar_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f-]{36}\.gif$'
     AND split_part(avatar_path,'/',1) = user_id::text
   )
 ),
 CONSTRAINT premium_background_path_own CHECK (
   background_path IS NULL OR (
     background_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f-]{36}\.gif$'
     AND split_part(background_path,'/',1) = user_id::text
   )
 )
);
ALTER TABLE public.komi_premium_media ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.komi_premium_media FROM PUBLIC,anon,authenticated;
GRANT SELECT(user_id,avatar_path,background_path) ON public.komi_premium_media TO anon,authenticated;
GRANT INSERT(user_id,avatar_path,background_path) ON public.komi_premium_media TO authenticated;
GRANT UPDATE(avatar_path,background_path) ON public.komi_premium_media TO authenticated;
GRANT ALL ON public.komi_premium_media TO service_role;

DROP POLICY IF EXISTS "public read active premium media" ON public.komi_premium_media;
CREATE POLICY "public read active premium media" ON public.komi_premium_media
 FOR SELECT TO anon,authenticated USING (
  EXISTS (SELECT 1 FROM public.komi_premium_badges b
   WHERE b.user_id=komi_premium_media.user_id )
 );
DROP POLICY IF EXISTS "premium user inserts own media" ON public.komi_premium_media;
CREATE POLICY "premium user inserts own media" ON public.komi_premium_media
 FOR INSERT TO authenticated WITH CHECK (
  user_id=(SELECT auth.uid())
  AND EXISTS (SELECT 1 FROM public.komi_premium_badges b
   WHERE b.user_id=(SELECT auth.uid()) )
 );
DROP POLICY IF EXISTS "premium user updates own media" ON public.komi_premium_media;
CREATE POLICY "premium user updates own media" ON public.komi_premium_media
 FOR UPDATE TO authenticated
 USING (
  user_id=(SELECT auth.uid())
  AND EXISTS (SELECT 1 FROM public.komi_premium_badges b
   WHERE b.user_id=(SELECT auth.uid()) )
 )
 WITH CHECK (
  user_id=(SELECT auth.uid())
  AND EXISTS (SELECT 1 FROM public.komi_premium_badges b
   WHERE b.user_id=(SELECT auth.uid()) )
 );
