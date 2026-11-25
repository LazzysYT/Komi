# Reliability contracts

| Capability | Canonical owner | Source of truth | Variants | Verification |
|---|---|---|---|---|
| Select/Listbox | Existing native select | index.html, watch-party.js | Platform popup is accepted | Keyboard/browser checks |
| Form | player-runtime.js validation capture | Required/type constraints in form markup | Static forms opt in via novalidate | Regression browser test |
| Toast | komiStatusFeedback | index.html | Existing status/error message | Regression browser test |
| Media | player-core.js + player-runtime.js | Parsed HTTPS source and per-element episode identity | Direct video, HLS, external embed | Unit + browser regression |
| Persistence | komiProgressWriter | RLS-protected komi_watch_progress | 10-second sampling, immediate pause/seek/close | Ordered writer tests |
| Hero navigation and list actions | `home-discovery.js` plus existing `app-main.js` handlers | Current catalogue ID, `/anime/:id` routes, authenticated list state | Watch link, add/remove from list button | Hero regression + browser navigation checks |
| Hero rotation and pause | `app-main.js` | Seven-second elapsed-time clock and explicit pause state | Manual next/previous/dot selection, pause/resume, hover/focus pause | `tests/hero-v811.test.cjs` + browser timing checks |
| Hero artwork and ambient video | `hero-hd-art.js` | Public catalogue metadata, validated media URLs, active-slide and visibility state | Dedicated banner, screenshot, external HD fallback, contained poster; optional muted MP4/WebM | Hero media regression + failure/reduced-motion checks |
| Home discovery and catalogue navigation | `home-discovery.js`, `KomiGenreMoods`, existing router and `renderCard` | Public catalogue records and `genre` URL parameter | 2:3 discovery links, native genre links, full grid/filters only in catalogue | `tests/home-storefront.test.cjs` + browser genre checks |
| Continue-watching | `recentProgress` and `resumeKomiAnime` in existing home/app owners | Current user's hydrated `komi_watch_progress` and owner-verified preview | 16:9 native button; no empty or login placeholder | Resume hydration, account-race and early-click suites |
| Recent and upcoming episodes | `home-release-shelves.js` plus existing schedule loader | Synced playable-release metadata and existing schedule map | Confirmed recent availability; future broadcast dates with voice-over caveat | `tests/home-release-shelves.test.cjs` + public-cache tests |

## Hero behaviour

The hero reuses existing SPA watch, details, authentication and list handlers. It does not create a separate route model or maintain a second personal-list state. Visual ownership and monochrome tokens are documented in `DESIGN.md`.

Manual selection resets the slide's seven-second progress cycle. Pausing preserves elapsed time; resuming uses the remaining time. Hidden documents, offscreen heroes and removed home routes must stop unnecessary autoplay and media work. Pauses from focus, pointer interaction and the explicit pause button must compose rather than accidentally resume each other. Reduced motion disables automatic movement; arrow and dot navigation continue to work.

Only active-slide media may play. An optional muted looping MP4/WebM overlays the poster; unavailable media leaves usable artwork underneath. Artwork selection prefers an explicit banner, then a usable screenshot, then the established public HD fallback, with a contained poster as the final fallback. Low-bandwidth and reduced-motion preferences avoid automatic video requests. Media URLs and metadata must not expose personal account data or bypass the existing validation and Supabase permissions.

Continue-watching remains an authenticated shelf. It appears only for owned entries with a valid episode identity and a finite saved position greater than zero. A known-duration episode with five seconds or less remaining is complete and omitted, matching the existing restore boundary; an unknown duration may still be resumed. Filtering precedes the shelf limit. Empty or unverified history remains absent, with no sign-in or loading card replacing it.

Selecting a continue card waits for the existing session/progress restoration queue, rechecks the account after asynchronous work and waits for an already-running catalogue hydration when necessary. It then opens the existing watch flow, which owns season, episode and time restoration. Preview history is never promoted to authoritative progress, and this action creates no new table or persistence model. No «Убрать» action is introduced; hiding a home card and deleting progress remain separate future product decisions. Long labels must not expand the document width, and native keyboard interaction remains available on cards and carousel controls.

## Storefront and catalogue

The hero is followed by optional continue-watching, «Рекомендуем», «Жанры», then recent and upcoming release rails. Guest and account-without-history use the same sequence without continue-watching. Recommendations disclose their basis in Shikimori scores and recent updates; the UI does not imply measured view popularity. Full search filters, pagination and the catalogue grid belong to `/catalog`.

Genre cards have ordinary `/catalog?genre=…` links, so copying a link or opening it in another tab preserves the choice. An unmodified click uses the existing SPA route, selects that genre and resets catalogue pagination. Recommendation cards link to title details and expose no nested list/Watch Party controls. Existing generic catalogue cards retain their original actions.

The first hero artwork retains high fetch priority and explicit geometry. Inactive slide images and shelves remain deferred; late media cannot delay the watch link. The static and boot home mirror the storefront hierarchy instead of flashing an old full grid before hydration.

## Release truth and recovery

«Свежие серии» requires a positive newly added episode number and a recent non-future timestamp. Loaded episode details must contain a validated playable source for that exact episode; summary-only records must be synced and report available episodes. If the season is unambiguous the link targets that episode, otherwise it opens title details rather than guessing a season. Empty recent results are omitted. Existing source validation establishes a confirmed catalogue entry, not a guarantee of current provider network reachability.

«Скоро выйдут» uses explicit future dates within the next 14 days, preferring the existing schedule map over a stored date. It does not extrapolate weekly recurrence. Dates use the viewer's timezone and explicitly do not promise voice-over availability. The existing refresh action is disabled and marked busy while loading, then exposes data or an honest empty/error state; replacing the section preserves keyboard focus. Release metadata survives the public cache, while personal progress and stream source URLs remain excluded.

## Existing data safeguards

Permissions remain owned by Supabase RLS and RPC checks in migrations. Legacy public tables are a documented remaining security issue, not a permission model to extend. No data deletion or ownership migration is part of this patch.

Personal progress is not copied to shared legacy local-storage maps. Pending writes capture the account and are skipped after account changes. Browser shutdown/network loss can still prevent the final request; no offline delivery guarantee is made.

### Profile navigation

Keep existing shared links, collection searches and folder CRUD, settings/privacy, watch history privacy, wallet/purchase actions, profile music and animated cosmetics. Overview and rewards are distinct navigation destinations; only a verified owner can access reward controls. Guest access to the own-profile route shows only sign-in and catalog actions, never cached identity data. On section changes, keep keyboard focus on the selected navigation button. Both header controls for the one settings panel show the same expanded state.
