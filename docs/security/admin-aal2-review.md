# Mandatory administrator MFA — release checklist (not active)

This review-only SQL is intentionally outside `supabase/migrations`. Do not apply automatically. Before creating an actual migration:

1. Publish and verify the isolated enrollment UI. The administrator must register two independently accessible authenticators and test a fresh login with each. Never share the setup secret or verification code with support.
2. Verify the existing Supabase Auth MFA settings and recovery procedure. Confirm every administrator has two verified TOTP factors and a recent AAL2 session.
3. Test a local/staging database with synthetic users and data. Obtain production schema definitions and inspect for changes, including any new privileged RPCs or write policies. The included fingerprint preconditions are deliberately strict. Do not bypass them.
4. Test guest, ordinary AAL1 and AAL2, administrator AAL1 and administrator AAL2. Only the latter may read privileged reports or change catalogue entries, promo/referral records or Premium. Membership discovery must remain available to the actual administrator at AAL1, for enrollment and verification. Confirm the ordinary public catalogue, login, payment webhook and service-role sync are unchanged. Verify rejection before writes; no real payments or grants.
5. Prepare reviewed rollback SQL from the original exact function definitions and remove only the two new restrictive policies if rollback is necessary. Keep that rollback private and available in the authenticated project dashboard. Do not store account data or session tokens in GitHub.
6. When approved, create a migration with Supabase tooling, verify in staging, apply transactionally and run readback and advisors. Test the owner login and a backup device again. Verify administrative audit events. Revert if access or user functionality regresses.

The included SQL covers the nine currently reviewed administrative RPCs and two catalogue write policies. It does not claim comprehensive coverage of future RPCs, other projects, provider accounts, account takeover, or legal compliance. Review the inventory whenever privileged functionality changes.

Reference: https://supabase.com/docs/guides/auth/auth-mfa
