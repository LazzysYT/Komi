# Komi Premium automatic activation

## Secure design

- Public `komi_premium_badges` shows only verified user IDs of currently active subscribers.
- Payment details, buyer emails, contract IDs and webhook history live in separate protected tables.
- Browser code reads badges only. A purchase click, redirect or editable profile cannot grant Premium.
- Membership ends at expiry. Renewals extend expiry, cancellation retains an already-paid period.
- Unique event keys prevent duplicate processing. Refund/chargeback requires additional provider testing.

## To enable real payments (required)

1. Apply migration `20261119130000_komi_premium_memberships.sql`.
2. Deploy Edge Function `lava-premium-webhook` with `verify_jwt=false`.
3. Generate a random **32 to 80-character** webhook-only secret yourself.
   Set `LAVA_PREMIUM_WEBHOOK_KEY` in **Supabase Edge Function Secrets**.
4. In your Lava.top Integrations > API, create **two** webhook subscriptions:
   **Payment result** (first subscription payment) and **Recurring payment** (renewals
   and cancellations). Both target:
   `https://xebglnnpoutmdcgukbxf.supabase.co/functions/v1/lava-premium-webhook`
   Authentication method: **Your service's API key**; enter exactly the same secret.
5. Use the same *verified email* for the subscription and KomiAnime account. This is
   how a paid purchase is safely matched to the correct existing profile.
6. Test an allowed provider checkout, verify a 2xx webhook response and status/expiry
   in Supabase and view a Premium badge in a real signed-in browser. Verify retries,
   double deliveries, cancellation, renewal and refunds. Do not fabricate payments.
7. If the real webhook field names differ, use a **redacted** event sample from the
   webhook history to adapt parsing. Never weaken signature validation.

No provider webhook key or Supabase secret may be sent in chat, placed in GitHub,
client code, environment variables prefixed NEXT_PUBLIC, or public URL params.
Until the secret and Lava webhooks are configured, activation stays DISABLED
and webhook returns HTTP 503.
