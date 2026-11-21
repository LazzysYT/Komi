# KomiAnime · Promos and paid referral checkout

Updated 2026-11-21. GitHub PR #175 (feature branch, **not merged into main**).

## Implemented

- Public-but-locked-down tables `promo_codes`, `referral_codes`, `payments`,
  `komi_checkout_bonus_awards`. Browser roles have no direct financial table access.
- Authenticated read-only RPC validation for separate checkout promo and referral codes.
- Admin-only report and paid-order marking backed by
  `komi_admin_members`, not user-editable profile metadata.
- Atomic promo reservation on pending-invoice creation, release on failed payment,
  confirmed-use counter and exact-once AniCoin credit after `paid`.
- Server-side Edge Function `komi-checkout` with authenticated account and
  confirmed email, code validation, self-referral prevention, server-owned USD
  tariff, referral reward rounding, per-user rate limit and invoice association.
- Existing `lava-premium-webhook` extended to reconcile tracked invoices
  by invoice ID and verified buyer email without changing unrelated hosted payments.
- Monochrome responsive checkout modal with independent inputs and referral
  attribution on home, premium, and anime SEO entry pages.

## Deployment state

The migrations have been applied to Supabase project `Komi`.
Edge Functions are deployed there:
- `komi-checkout`, version 2
- `lava-premium-webhook`, version 4

**The checkout feature is intentionally OFF by default.** Both functions
require the project-level Edge Function secret `KOMI_CHECKOUT_ENABLED=true`
before code-attributed invoice creation/settlement is enabled.
The checkout also requires these secrets:
- `LAVA_API_KEY`: outbound Lava.top public API key (NOT the inbound webhook key)
- `KOMI_PREMIUM_MONTHLY_USD`: exact current amount of the existing Lava.top
  monthly subscription; e.g., format `9.99`, not a guessed or client-supplied price.
The original `LAVA_PREMIUM_WEBHOOK_KEY` must remain intact.

Set secrets directly in Supabase Dashboard → Edge Functions → Secrets. Never
paste keys into code, an issue, a PR, or a chat message. **Do not enable** until
the configured monthly price is verified against the actual Lava.top offer and
test charges/webhooks are safely completed.

The checkout endpoint deliberately returns HTTP 503 instead of attempting an
invoice when feature gate/API key/price are unavailable.
Standard direct hosted Lava checkout (without applying codes) remains usable.

## API caveats and financial behavior

The current premium offer is a fixed-price auto-renewing subscription.
Lava.top documents custom `amount` only for *one-time* products configured
with “Price on request via API”. Therefore:
- The checkout endpoint does not send a custom `amount` for Premium.
- Percentage-off promo codes are explicitly rejected on this recurring offer.
- The zero-discount promo option may give a fixed number of AniCoin on
  successful payment.
- Referral codes can attribute a percentage of the payment for reporting;
  **no automated payouts** are made.
- Repeat subscription charges are handled by the existing Premium membership
  flow, but do not automatically generate new referral commissions.
- Refunds and chargebacks remove orders from paid-only payout totals.
  Already consumed AniCoin rewards are not silently clawed back.

The recurring subscription offer cannot provide verified discounted checkout
prices without an appropriate new product/merchant configuration and a
separate reviewed entitlement/renewal policy.

## Test status

- SQL `BEGIN ... ROLLBACK` test asserted promo reservation and max uses,
  payment finalization twice, exactly-once bonus credit and wallet balance.
  Test rows/credits were rolled back; none remain.
- Supabase deployed both functions successfully (valid Deno/TypeScript bundle).
- Vercel builds a preview for the PR's branch; production is unchanged.
- **Not yet tested**: a real authenticated invoice, payment, webhook, or
  on-site checkout completion. Do not claim a working code-attributed
  purchase without this.
- Keep the PR draft until merchant settings, amount verification and E2E
  payments have been reviewed.

Provider docs: https://developers.lava.top/en
Supabase docs: https://supabase.com/docs/guides/functions
