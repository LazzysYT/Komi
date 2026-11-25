# Reliability contracts

| Capability | Canonical owner | Source of truth | Variants | Verification |
|---|---|---|---|---|
| Select/Listbox | Existing native select | index.html, watch-party.js | Platform popup is accepted | Keyboard/browser checks |
| Form | player-runtime.js validation capture | Required/type constraints in form markup | Static forms opt in via novalidate | Regression browser test |
| Toast | komiStatusFeedback | index.html | Existing status/error message | Regression browser test |
| Media | player-core.js + player-runtime.js | Parsed HTTPS source and per-element episode identity | Direct video, HLS, external embed | Unit + browser regression |
| Watch presentation and episode artwork | `komi-watch-compact-v6.js/.css`, `cinema-layout-v3.js` | Existing player context and actual episode metadata | Desktop rail; phone sheets; frame/poster/unavailable labels | `tests/cinema-thumbnails.test.cjs`, watch browser checks |
| Voice-over continuity | `app-main.js`, `KomiSourcePrefs.match` | Explicit source intent for the open title | Carry across episodes, normalized label matching, recover intended voice after temporary fallback | `tests/watch-experience.test.cjs` |
| Episode discussion | `komi-comments.js` | `komi_comments` anime_id + season + episode_number, existing RLS | Per-episode thread; general thread has both fields NULL | `tests/episode-comments.test.cjs`, live filtered read |
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

The first video pilot is one explicitly branded promotional slide appended to the home carousel, also available in the isolated `hero-video-preview.html`. A `data-komi-promo` slide reuses the same media runtime and skips anime metadata queries. Its catalogue link carries no anime/list action, and the first anime slide keeps its existing preload and render priority. The promo poster is deferred until the slide is active. At widths up to 767px or without hover/fine-pointer input, no video source is attached, including landscape phones. Changing the slide or enabling reduced motion, Save Data or 2G removes the video source and cancels its download. Pausing, focus/hover, a hidden document or offscreen hero pauses playback without discarding the user's explicit pause intent. The underlying decoded first frame remains visible until playback actually starts.

## Watch screen and episode identity

The existing media runtime, provider iframe, progress slots and Watch Party source indices remain authoritative. Episode navigation carries the selected voice-over when available. A temporary unavailable source uses the normal source-selection fallback and displays an explanation; the original intention remains available for the next episode and is not overwritten in persistent source preferences. Equivalent labels are matched through the existing source preference normalizer. Strict ad-free restrictions remain enforced by `KomiPlayerCore`.

The list remains complete. For verified title 5114, season 1, numbers 65–68 with only STEPonee are labelled additional releases; the 64-episode main-series count is sourced from TBS and Aniplex, recorded in `docs/watch-experience-v9.md`. Original array indices, source URLs, season and progress slots are unchanged. No inference is made about their OVA identity. Other titles have no fixed-count rule.

Desktop number search filters locally, has a visible clear control and keeps the current episode identity. The existing phone sheet moves the original episode rail rather than cloning it. Background siblings become inert while a sheet is open; Escape/backdrop/close restore their prior state and keyboard focus. Selecting the already active voice simply closes the sheet and restores focus.

Recovery is hidden initially for both native and external media. A native media error or observed iframe error reveals retry/source choices. Because cross-origin iframe playback failures are not reliably observable, the existing overflow menu also exposes «Видео не работает?» for a viewer-reported failure. No timeout declares a still-loading provider to be broken.

## Episode comments

New episode messages use `(anime_id, season, episode_number)` rather than a player/source index. Existing comments without episode identity stay under «Об аниме». Switching voice-over keeps the same discussion; switching episode changes the query and cache key. Older requests cannot overwrite a later thread or refresh, and submission captures the selected thread/account before awaiting the server. User text remains DOM-rendered, and public comments retain their existing RLS author, rate-limit and deletion policies. General-thread timecodes do not seek an arbitrary open episode.

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

Keep existing shared links, collection searches and folder CRUD, settings/privacy, watch history privacy, wallet/purchase actions, profile music and animated cosmetics. Overview and rewards are distinct navigation destinations; only a verified owner can access reward controls. Guest access to the own-profile route shows only sign-in and catalog actions, never cached identity data. The single Edit action retains both existing settings hooks and the panel's expanded state; the separate Appearance link opens the existing studio.

Primary profile controls are navigation buttons with an explicit pressed state. The native More disclosure owns supplementary sections; Escape and outside click close it. On section changes, keyboard focus returns to the selected primary button or the More summary when the destination is supplementary. The full document remains the vertical scroll owner. Collection shortcuts clear the old search and open the selected status through the same renderer; the search clear button reuses `updateProfileCollectionSearch`, including caret/focus restoration. Moving to another user's profile resets the previous query, private folder selection and active section.

The overview's resume selection reuses `KomiHomeDiscovery.unfinished` before the two-card limit, and authenticated progress must match `komiResumeReadyUid`. `resumeKomiAnime` remains the sole click path and rechecks ownership during hydration. History can show zero/completed records with truthful start/replay labels; public profiles never render owner history. Stored source indices resolve to actual episode numbers through `KomiPlayerCore.seasonEpisodes`. Unknown episode/time metrics and unavailable public friend counts display an em dash; saved positions are never summed into fictional total watch time. Full favorite capacity and all achievements are preserved, while the overview displays only populated favorites and a compact achievement sample.

History load errors are scoped to the verified UID and username. The retry action consumes the error once, joins the existing restore queue, rechecks account ownership and retains an already verified history when a refresh fails. Both profile logout controls use exact allowlisted local/global actions.
