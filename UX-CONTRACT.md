# Reliability contracts

| Capability | Canonical owner | Source of truth | Variants | Verification |
|---|---|---|---|---|
| Select/Listbox | Existing native select | index.html, watch-party.js | Platform popup is accepted | Keyboard/browser checks |
| Form | player-runtime.js validation capture | Required/type constraints in form markup | Static forms opt in via novalidate | Regression browser test |
| Toast | komiStatusFeedback | index.html | Existing status/error message | Regression browser test |
| Media | player-core.js + player-runtime.js | Parsed HTTPS source and per-element episode identity | Direct video, HLS, external embed | Unit + browser regression |
| Persistence | komiProgressWriter | RLS-protected komi_watch_progress | 10-second sampling, immediate pause/seek/close | Ordered writer tests |
| Hero navigation and list actions | `home-discovery.js` plus existing `app-main.js` handlers | Current catalogue ID, `/anime/:id` routes, authenticated list state | Watch, details, add/remove from list | Hero regression + browser navigation checks |
| Hero rotation and pause | `app-main.js` | Seven-second elapsed-time clock and explicit pause state | Manual next/previous/dot selection, pause/resume, hover/focus pause | `tests/hero-v811.test.cjs` + browser timing checks |
| Hero artwork and ambient video | `hero-hd-art.js` | Public catalogue metadata, validated media URLs, active-slide and visibility state | Dedicated banner, screenshot, external HD fallback, contained poster; optional muted MP4/WebM | Hero media regression + failure/reduced-motion checks |

## Hero behaviour

The hero reuses existing SPA watch, details, authentication and list handlers. It does not create a separate route model or maintain a second personal-list state. Visual ownership and monochrome tokens are documented in `DESIGN.md`.

Manual selection resets the slide's seven-second progress cycle. Pausing preserves elapsed time; resuming uses the remaining time. Hidden documents, offscreen heroes and removed home routes must stop unnecessary autoplay and media work. Pauses from focus, pointer interaction and the explicit pause button must compose rather than accidentally resume each other. Reduced motion disables automatic movement; arrow and dot navigation continue to work.

Only active-slide media may play. An optional muted looping MP4/WebM overlays the poster; unavailable media leaves usable artwork underneath. Artwork selection prefers an explicit banner, then a usable screenshot, then the established public HD fallback, with a contained poster as the final fallback. Low-bandwidth and reduced-motion preferences avoid automatic video requests. Media URLs and metadata must not expose personal account data or bypass the existing validation and Supabase permissions.

Continue-watching remains an authenticated shelf. Its title fix is scoped to that shelf and preserves the image's crop and rounded mask. Long labels must not expand the document width, and native keyboard interaction must remain available on all carousel controls.

## Existing data safeguards

Permissions remain owned by Supabase RLS and RPC checks in migrations. Legacy public tables are a documented remaining security issue, not a permission model to extend. No data deletion or ownership migration is part of this patch.

Personal progress is not copied to shared legacy local-storage maps. Pending writes capture the account and are skipped after account changes. Browser shutdown/network loss can still prevent the final request; no offline delivery guarantee is made.
