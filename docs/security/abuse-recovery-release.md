# Abuse protection and recovery rollout

## Turnstile (inactive until configured)
1. Create a managed widget at https://dash.cloudflare.com/?to=/:account/turnstile and restrict allowed hostnames to the approved production/preview domains. Do not use test keys in production.
2. Set only the public Sitekey as KOMI_TURNSTILE_SITE_KEY in the Vercel project environment. The build inserts it into a public HTML meta tag; do not put the secret key there. No provider call occurs with an empty key.
3. Confirm all email-password sign-in and registration clients send captchaToken, and test challenge success, invalid/expired tokens, retries, account recovery, Google OAuth and mobile browsers in a separate test project. Configure any other Auth client before enforcement.
4. Set the matching private secret and Turnstile provider in Supabase Auth > Attack Protection (https://supabase.com/dashboard/project/xebglnnpoutmdcgukbxf/auth/protection). Only then enable enforcement. Never enable server CAPTCHA while the deployed browser still lacks a production sitekey. Review Auth rate limits and email/OTP quotas; do not disable email confirmation.
5. Test direct requests without a token in a controlled test project; a client-only widget is not a security control. Review legal disclosures and privacy practices before activating a third-party challenge.

## Backup / recovery
- Check actual subscription, backup history and retention in Database > Backups. On Free, perform regular manual logical exports via authenticated Supabase CLI; scheduled daily managed backups require eligible paid plans. Back up Storage objects separately, not just database metadata.
- On the owner's trusted machine, inspect CLI help and use official role/schema/data export and restore instructions: https://supabase.com/docs/guides/platform/backups and https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore. Keep exports outside the Git checkout, encrypt at rest, restrict access, document retention and store independent copies. Never upload user data, session tokens, passwords or backups to public GitHub or CI artifacts.
- Restore into an isolated environment with appropriate authorization and access controls, disable outbound mail/payments/sync, verify catalog, account isolation, wallet ledger, premium entitlement, storage and admin MFA with synthetic test fixtures. Never restore over production for a drill. Record backup age, recovery duration and validation outcome; until then restoration is unverified.
- Separately back up deployment config, domain/DNS settings, edge function definitions and secrets in a private password manager. Verify GitHub, registrar, Vercel, Supabase and payment account MFA and recovery codes.

## Legal and public reporting
The /security and /copyright pages explain how to request a private contact; they are not a formal statutory notice channel or complete legal compliance. Owner must establish a verified private inbox, operator/seller identity, legal rights inventory, privacy and cookie inventory and actual payment/refund process. See docs/legal-review.md. Do not publish placeholders as operative terms.

## Firewall and repository
Three existing rules are prepared but disabled. Owner activates log-only rules in Vercel; review traffic before blocking in preview, then production. Do not block legitimate crawlers, checkout, or rights-holder notices. Enable required checks/branch protection and private vulnerability reporting in GitHub settings. No new paid products are authorized by this document.
