# KomiAnime · Promo and paid-referral checkout

## Current rollout status (2026-11-21)

**Supabase migration is applied** to project `xebglnnpoutmdcgukbxf`.
The GitHub UI and admin-panel changes are on
`feature/promo-referral-checkout-20261121` for review and are **not deployed**.

### Completed

- Separate `public.promo_codes` and `public.referral_codes` tables; existing
  `komi_private.referral_codes` signup-invitation system is unchanged.
- New `public.payments` ledger for verified, attributable invoices.
- RLS and privileges deny direct browser reads and writes to financial tables.
- Authenticated `validate_checkout_codes` RPC validates codes independently,
  including self-referral protection.
- Protected administrator RPC for purchase journal and payment marks with notes.
- Idempotent AniCoin bonus ledger on transitions to `paid`, with checkout-specific
  reward reason, and promo use counter increment only after confirmed payment.
- Responsive monochrome two-code checkout UI and referral-source capture via
  `?ref=CODE` / localStorage.
- Lazy admin interface for referral summary and paid-order marking.

### Payment activation remains blocked

Komi Premium currently uses a **direct hosted Lava.top subscription URL**, and
the project has **no server-side invoice creator**. The current branch's checkout
modal intentionally does NOT pretend to apply financial discounts at a hosted
checkout. Codes submitted there cannot yet produce a tracked invoice, so they
must not be advertised as an active purchase benefit.

Lava.top's API permits caller-supplied `amount` for specifically configured
**one-time, custom-price products**. This does not apply to the current
automatically-renewing subscription. The actual checkout amount must always
come from a server-owned tariff and be honored by Lava.top itself.

Before enabling referral or bonus-code purchases:
1. Implement, review and deploy an authenticated server invoice-creation route.
   Validate the Supabase session, email, code validity, price and product on the
   server; never accept a client-supplied amount, reward or user ID.
2. Ensure the provider returns both a checkout URL and a stable invoice ID.
   Atomically bind that invoice ID to the verified account and code snapshot in
   `public.payments` before returning its URL.
3. Match signed/authenticated `payment.success` webhook events by the actual
   invoice ID and update payment status to `paid` through the trusted service
   RPC. Retry safely when processing fails. Reconcile failed, refunded and
   chargeback events.
4. For percentage money discounts, configure a separate compatible product
   and explicitly decide how Premium access/renewal is handled. Never silently
   change or replace the existing auto-renewing subscription.
5. Run real end-to-end purchases in a suitable test environment; verify
   exact-once bonus credit, promo-use limits, self-referral refusal, and
   no cross-account admin read.
6. Set required payment service credentials only in trusted secrets, not in Git
   or client JavaScript. Maintain the working direct checkout until verified.

**Privacy:** Paid-referral purchase data is available only through the
admin-membership-checked RPC. Do not expose buyer emails in client analytics.

**Admin stats:** `entered` counts invoices that were created with a referral
code, not every field validation or typing event.

No sample promo or partner codes have been activated; all reward percentages and
usage limits must be configured by the project owner.
