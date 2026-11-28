# Security rollout and acceptance checklist

This document records the intended rollout, not a claim that all controls are already active. Never commit real credentials, personal records or private incident evidence.

## 1. Vercel Firewall
- Keep platform DDoS mitigation enabled. Use Attack Challenge mode only for a verified incident and with the owner's explicit action.
- The three prepared rules must be inspected and activated in observation mode by the owner. Open project Firewall → Configure → review and enable the rules with log actions → Review Changes → Publish. No active blocking until traffic has been reviewed.
- Monitor sensitive-path probes, unexpected methods on read-only API routes and bursts of requests to public catalogue/poster endpoints. Initial burst threshold is deliberately generous. Validate against actual traffic, shared IPs, browser loading, verified crawlers and integrations. No country/UA-wide bans. Do not use rules to impede lawful notices or rights-holder access.
- After observing production traffic, enforce only the validated rule in Preview; verify expected block and normal navigation. Owner publishes final production enforcement. Keep rollback to log mode available. Review the actual project plan/quotas before changing paid features.
- Vercel only protects requests to its endpoints. Supabase Auth/Data API, external media services and payment webhooks need separate protections.

## 2. Identity and data access
- Enable MFA on the GitHub, domain registrar, Vercel, Supabase and payment provider accounts; store recovery codes offline. Enroll admin TOTP in the app and confirm recovery first. Enforce AAL2 on privileged server operations only after login/recovery flow passes. Avoid relying on browser-only hiding of controls or user-editable metadata.
- Review Auth settings: email verification, safe redirect allowlist, password minimum and password change/recovery flow; rate limits for sign-in, registration and reset. Test normal email/Google login before/after. Enable leaked-password prevention only if plan supports it; no unapproved paid upgrades.
- Register a Turnstile site key for the verified domain and preview environment; securely store the matching secret in Supabase. Implement frontend captchaToken for signup/sign-in/recovery, CSP allowlist for the provider, failure/retry and accessibility. Test preview first; then enable server enforcement. Do not turn CAPTCHA on before all affected clients support tokens.
- Retest RLS as anonymous, ordinary authenticated account A, account B, and administrator; never use production personal data as test fixtures. Verify users cannot write other accounts, balances, entitlements, roles, payments or private media. Review SECURITY DEFINER functions, storage policies and column grants.
- Verify payment signature and replay/idempotency checks against provider documentation, amount/currency/product matching, and test successful payment, repeated webhook, invalid signature, cancellation/refund and expired entitlements in test mode. Never expose payment secrets.

## 3. Repository, deployment and recovery
- Security guard on PR checks high-confidence credential patterns, tracked credential files and baseline HTTP headers. It is not a comprehensive secret scanner. Add a dedicated history scan and dependency scanner, review findings in private, and rotate any exposed secret rather than merely deleting it. Enable GitHub secret scanning/push protection where available and require passing checks via branch protection.
- Verify sensitive files and internal build/audit artifacts cannot be served on Preview. Check only owned paths and do not download potentially exposed secrets. Ensure .vercelignore and actual output match. Review CSP in report-only mode, including legitimate external video, image and payment sources before enforcing tighter policies.
- Inventory backups and storage objects; confirm actual plan, retention and restore procedures. Store encrypted backups in access-controlled storage, not GitHub or public buckets. Restore to an isolated environment and test integrity; never restore over production during a drill.
- Incident process: isolate affected feature, revoke exposed keys/sessions, preserve relevant evidence in private, assess affected users and legal notification obligations, restore from a verified backup, document actions. Never delete evidence to avoid accountability.

## 4. Release gate
- GitHub CI green, no unresolved confirmed security defects.
- Preview checks: guest catalogue/search/anime pages, viewing with authorized sources, account creation/login/logout/recovery, ordinary and admin access, profile and privacy, friends, Watch Party, AniCoin/collections, checkout in test mode, mobile and desktop.
- Do not perform production flood or stress tests. Test rate-limit behavior against a controlled isolated environment and observe legitimate traffic.
- Confirm lawful content sources, actual operator and seller details, verified support and rights contact, data inventory and legal policies in docs/legal-review.md before publishing them. For unverified content rights or hosting/payment terms, suspend the affected offering rather than relying on disclaimers.
- Release in stages, monitor errors and security events, maintain rollback. No claim of absolute security or immunity from legal complaints.
