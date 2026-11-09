# Reliability contracts

| Capability | Canonical owner | Source of truth | Variants | Verification |
|---|---|---|---|---|
| Select/Listbox | Existing native select | index.html, watch-party.js | Platform popup is accepted | Keyboard/browser checks |
| Form | player-runtime.js validation capture | Required/type constraints in form markup | Static forms opt in via novalidate | Regression browser test |
| Toast | komiStatusFeedback | index.html | Existing status/error message | Regression browser test |
| Media | player-core.js + player-runtime.js | Parsed HTTPS source and per-element episode identity | Direct video, HLS, external embed | Unit + browser regression |
| Persistence | komiProgressWriter | RLS-protected komi_watch_progress | 10-second sampling, immediate pause/seek/close | Ordered writer tests |

Permissions remain owned by Supabase RLS and RPC checks in migrations. Legacy public tables are a documented remaining security issue, not a permission model to extend. No data deletion or ownership migration is part of this patch.

Personal progress is not copied to shared legacy local-storage maps. Pending writes capture the account and are skipped after account changes. Browser shutdown/network loss can still prevent the final request; no offline delivery guarantee is made.
