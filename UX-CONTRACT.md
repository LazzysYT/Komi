# Reliability contracts

| Capability | Canonical owner | Source of truth | Variants | Verification |
|---|---|---|---|---|
| Select/Listbox | Existing native select | index.html, watch-party.js | Platform popup is accepted | Keyboard/browser checks |
| Form | player-runtime.js validation capture | Required/type constraints in form markup | Static forms opt in via novalidate | Regression browser test |
| Toast | komiStatusFeedback | index.html | Existing status/error message | Regression browser test |
| Media | player-core.js + player-runtime.js | Parsed HTTPS source and per-element episode identity | Direct video, HLS, external embed | Unit + browser regression |
| Watch presentation and episode artwork | `komi-watch-compact-v6.js/.css`, `cinema-layout-v3.js` | Existing player context and actual episode metadata | Desktop rail; phone sheets; frame/numbered-empty states | `tests/cinema-thumbnails.test.cjs`, watch browser checks |
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

`anime-description.js` owns plain-text description cleanup for first paint, hydration and title details. It preserves supplied linked names, removes markup and incomplete trailing tags, and normalizes punctuation. Hero excerpts end at a whole-word boundary within 320 characters and use `…` when shortened; detail pages retain the full cleaned text. Metadata uses an actual ` · ` text separator between rating and year, including for text extraction and assistive technology.

The early public hero is prepared by `KomiHeroDaily.firstImage` and mounted only after the whole document is parsed and that day's artwork has decoded. It never paints a fixed title while waiting for a different daily image. `KomiHomeDiscovery.adoptBootHero` verifies the ordered title identities and artwork URL, retains the mounted image, then updates text and authenticated list controls through the normal renderer. The preview never reads private account data. Native watch and catalogue links work if later application scripts fail; JS-only actions remain disabled until hydration. Background catalogue scanning waits for the same image readiness, with an 1800 ms maximum head start and immediate bypass for user input or catalogue/deep-link navigation. Failure, timeout and route changes cannot leave the catalogue blocked or overwrite a newer screen.

Web-font activation yields to the first daily hero paint on the home route, using the existing font fallbacks in the meantime. It releases on failed image startup or route changes and cannot remain waiting indefinitely. Direct section and watch routes keep normal font activation. Optional motion and cosmetic styles do not block the home image, retain their cascade position and activate when loaded; direct shop/profile routes promote cosmetics before displaying those views. The critical mobile dock and hero layout styles remain blocking.

The advertising loader preserves the existing SDK URL, publisher and asynchronous/cross-origin settings. It starts once after DOMContentLoaded and the daily image have settled, yields to a paint frame and uses a bounded idle callback. Independent failure bounds prevent a missing application event or suspended frame from suppressing the SDK forever. It does not inspect the visitor's browser identity, benchmark environment or performance score, and does not change CSP or advertising eligibility.

Daily title/artwork identity uses five explicitly mapped bundled WebP paths. Their source images, native dimensions and quality are unchanged, and they share the page's origin and immutable cache. Media validation accepts only those mapped local stills; generic relative or traversing paths are not admitted. Critical CSS may omit only known feature families absent from the initial home, preserving closed-surface hiding rules and mixed/global selectors. The full stylesheet remains authoritative for later interactions and direct feature routes.

The public footer remains available in normal flow. Reserve a viewport minimum on the main layout throughout startup so mounting the early hero and later content shelves does not move a visible footer across the first screen. Cold and cached first-paint fixtures verify this at desktop and mobile widths, including the minified build.

The production startup script preserves the source order of daily boot, legacy Premium entry and shop first-paint setup. Combining their delivery must retain early native navigation, route handling and classic-script globals. A usable daily lineup must bypass full-catalog featured fallback computation; incomplete daily data retains the existing fallback behavior.

Release-card date/time formatting may be reused only within the current render. Keep the existing Russian labels and the visitor's local timezone; a subsequent render must resolve its timezone again.

Bounded recommendation selection must return the same ordered twelve titles as the existing stable freshness/rating sort, including ties and invalid-data filtering. It must not mutate the shared catalog or change the daily/legacy hero fallback behavior.

Manual selection resets the slide's seven-second progress cycle. Pausing preserves elapsed time; resuming uses the remaining time. Hidden documents, offscreen heroes and removed home routes must stop unnecessary autoplay and media work. Pauses from focus, pointer interaction and the explicit pause button must compose rather than accidentally resume each other. Reduced motion disables automatic movement; arrow and dot navigation continue to work.

Only active-slide media may play. An optional muted looping MP4/WebM overlays the poster; unavailable media leaves usable artwork underneath. Artwork selection prefers an explicit banner, then a usable screenshot, then the established public HD fallback, with a contained poster as the final fallback. Low-bandwidth and reduced-motion preferences avoid automatic video requests. Media URLs and metadata must not expose personal account data or bypass the existing validation and Supabase permissions.

The first video pilot is one explicitly branded promotional slide appended to the home carousel, also available in the isolated `hero-video-preview.html`. A `data-komi-promo` slide reuses the same media runtime and skips anime metadata queries. Its catalogue link carries no anime/list action, and the first anime slide keeps its existing preload and render priority. The promo poster is deferred until the slide is active. At widths up to 767px or without hover/fine-pointer input, no video source is attached, including landscape phones. Changing the slide or enabling reduced motion, Save Data or 2G removes the video source and cancels its download. Pausing, focus/hover, a hidden document or offscreen hero pauses playback without discarding the user's explicit pause intent. The underlying decoded first frame remains visible until playback actually starts.

## Watch screen and episode identity

The episode list never reuses title artwork. It prefers valid, distinct catalog episode frames, then an already-playing native-video frame, then public TMDB episode stills indexed by [media-index](https://github.com/anilifecommunity/media-index). The optional index is resolved by the existing Shikimori/MAL identity on the first catalog season with explicit episode numbering; ambiguous, supplemental and unmatched entries remain numbered. It uses at most two cached metadata requests for an opened title, does not block playback, and never modifies the catalog.

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

«Скоро выйдут» uses explicit future dates within the next 14 days, preferring the existing schedule map over a stored date. It does not extrapolate weekly recurrence. Dates use the viewer's timezone and explicitly do not promise voice-over availability. The section is absent when no qualifying dates exist, including initial loading and failure without cached dates. It is inserted in the existing storefront order when dates arrive and removed when none remain. The refresh action is disabled and marked busy while loading; a failed refresh retains qualifying dates with an inline explanation. Replacing the section preserves keyboard focus, or returns it to the catalogue link if the section disappears. Release metadata survives the public cache, while personal progress and stream source URLs remain excluded.

## Guest shell and community

Closed dialogs, the community drawer and the mobile overflow menu are hidden by the inline initial-visibility guard before external styles load. The guard follows the existing `.active`, `.open`, `hidden` and native disclosure state; existing owners still control opening, Escape and focus restoration. The mobile overflow is absent on desktop, and closing it synchronizes `hidden`, `inert` and `aria-hidden`.

The community drawer presents a sign-in action immediately for guests, matching the authenticated user-search flow. It does not render legacy cached profile names or request the profile directory before a verified session exists. Authenticated directory reads use the existing `komi_profiles` projection and RLS, share an in-flight request, and leave loading within eight seconds. Empty, error and retry states are distinct; a failed refresh can retain the same account's already loaded public directory. Account changes cancel/invalidate old reads before they can replace current results. No online status or activity ranking is inferred from this directory.

## Existing data safeguards

Permissions remain owned by Supabase RLS and RPC checks in migrations. Legacy public tables are a documented remaining security issue, not a permission model to extend. No data deletion or ownership migration is part of this patch.

Personal progress is not copied to shared legacy local-storage maps. Pending writes capture the account and are skipped after account changes. Browser shutdown/network loss can still prevent the final request; no offline delivery guarantee is made.

### Profile navigation

In Overview, list rows delegate to the existing Lists controller. Viewing genres deduplicate explicit completed titles; the verified owner also sees recent completion marks from the existing private owner-scoped table. The Activity card reads the count of episode marks since Monday UTC and the existing daily check-in streak, never wallet progress or resume timestamps as viewing time. Public profiles cannot request or display these private values. A failed refresh leaves existing known values intact and exposes a retry; a missing value stays a dash rather than zero. No personal rating chart is shown without real personal ratings.

Keep existing shared links, collection searches and folder CRUD, settings/privacy, watch history privacy, wallet/purchase actions, profile music and animated cosmetics. Overview and rewards are distinct navigation destinations; only a verified owner can access reward controls. Guest access to the own-profile route shows only sign-in and catalog actions, never cached identity data. The single Edit action retains both existing settings hooks and the panel's expanded state; the separate Appearance link opens the existing studio.

Primary profile controls are navigation buttons with an explicit pressed state. The native More disclosure owns supplementary sections; Escape and outside click close it. On section changes, keyboard focus returns to the selected primary button or the More summary when the destination is supplementary. The full document remains the vertical scroll owner. Collection shortcuts clear the old search and open the selected status through the same renderer; the search clear button reuses `updateProfileCollectionSearch`, including caret/focus restoration. Moving to another user's profile resets the previous query, private folder selection and active section.

The overview's resume selection reuses `KomiHomeDiscovery.unfinished` before the two-card limit, and authenticated progress must match `komiResumeReadyUid`. `resumeKomiAnime` remains the sole click path and rechecks ownership during hydration. History can show zero/completed records with truthful start/replay labels; public profiles never render owner history. Stored source indices resolve to actual episode numbers through `KomiPlayerCore.seasonEpisodes`. Unknown episode/time metrics and unavailable public friend counts display an em dash; saved positions are never summed into fictional total watch time. Full favorite capacity and all achievements are preserved, while the overview displays only populated favorites and a compact achievement sample.

History load errors are scoped to the verified UID and username. The retry action consumes the error once, joins the existing restore queue, rechecks account ownership and retains an already verified history when a refresh fails. Both profile logout controls use exact allowlisted local/global actions.


## AniCoin shop studio

| Capability | Canonical owner | Source of truth | Variants | Verification |
|---|---|---|---|---|
| Catalogue/filtering | `KomiShopV3`, `KomiShopCatalog` | Shared product metadata and current account's verified store | Catalog/My items; local search; native category/sort selects; 24-item Load more | `scripts/shop-studio.test.cjs` and browser checks |
| Purchase confirmation | `KomiShopV3.confirmPurchase` | Verified quote supplied by `anicoin.js` or the cart owner | Single item or multi-slot cart | `scripts/shop-purchase-flow.test.cjs`; native dialog keyboard checks |
| Wallet and ownership | `anicoin.js`, existing Supabase RPCs | `komi_private.shop_item_prices`, purchases and equips; V7 migration | Atomic buy/equip, owned apply, unequip; apply-only recovery | Purchase flow and catalog parity tests |
| Shared cosmetic rendering | `komi-premium-store.js`, `komi-shop-v6-goods.css` | Same catalog appearance classes in preview and public profile | Frame, cover, title, name, shape, plate, XP, overlay and icon | `scripts/shop-v7-catalog.test.cjs` |

Committed browsing state uses `shop_*` URL parameters; it includes view, category, query, collection, sort, availability, hidden ownership and the number of rendered pages. Filtering resets paging but preserves try-on selections. Search clears immediately, preserves input focus and ignores incomplete IME composition. Browser history restores the same filters. My items is scoped to the current verified account; switching accounts clears the fitting room and closes any pending purchase confirmation. Guests can browse and preview, with no invented balance or owned items.

Trying on is local and free. One selected cosmetic occupies each supported slot, with the current equipped item retained in untouched slots. Reactions are previewed separately and purchased through their existing card action. Collections are permanent product groupings, not timed offers or discounted bundles. The selected three-item combination uses the real per-item prices and excludes already owned items from the total.

Paid operations require the shared app-owned native dialog with named products, verified total, balance before/after, Cancel and explicit Buy. Cancellation preserves the trial. Direct purchases hold the existing busy lock throughout authentication, quote confirmation and mutation; account, price, ownership and affordability are rechecked after asynchronous boundaries. An item received during confirmation is applied through the owned path without a second purchase. The existing SQL transactions and wallet locks remain authoritative. A lost response is reconciled with a read, never an automatic repeat of payment. If ownership is confirmed but application is missing, a persistent message and apply-only retry remain beside checkout. Free application does not require payment confirmation.

The desktop fitting rail and mobile expandable sheet are non-modal. Profile/Comment buttons expose exactly one preview panel and preserve selected products and prices. Trying a plate selects Comment; another slot selects Profile. Header, scroll region and checkout footer occupy separate rows, so the last selected item can be reached without being obscured. The empty checkout action is hidden, while status and apply-only recovery remain available even with no trial items. Removing the last item or completing a purchase restores focus to an available fitting control. A direct desktop purchase whose card disappears through Hide purchased restores focus to the fitting heading. The sheet does not claim focus trapping or inert background; Escape/collapse returns focus to the sheet header. Desktop collection try-on focuses the fitting heading and scrolls its panel into view; normal single-item previews do not scroll the page. The compact community entry has separate space beside a collapsed sheet and is hidden while the sheet is expanded, then restored on collapse. The payment dialog is modal and owns focus, inert background, Escape and restoration. Trial-changing controls are disabled while an operation is pending. Purchase feedback lives next to the checkout action and in an accessible live region. Social gifts keep the existing server owner and are remounted after catalogue replacement. No live user's coins are spent for validation.

Business sources: `supabase/migrations/20261122081500_shop_cart_charge_only_inserted.sql` owns cart concurrency behavior; `20261125122924_anicoin_shop_v7_collections.sql` expands only catalog rows and explicit equip allowlists, preserving existing prices, wallets, ownership and permissions. Premium pricing is outside this change.


## Discovery comfort revision (26 November 2026)

The layout changes in DESIGN.md do not introduce state owners. app-main.js keeps
catalogue filtering, search/caret restoration, category and route state. Native
select ownership remains accepted for the existing mobile-bottom-sheets.js filter
sheet and inline advanced filters; the operating system owns popup geometry.
komi-genre-moods.js keeps quick sort/year disclosures and genre selection. Catalogue
genres follow search in the DOM; no CSS ordering changes keyboard traversal.
On phones the duplicate inline advanced-filter action is hidden, while the same
sheet trigger, fields and Apply/Reset actions remain available. Desktop navigation
keeps a 72px icon rail; visual labels appear on hover and keyboard focus while
accessible names and authenticated visibility are unchanged. Catalogue search
uses the existing route state, prioritises exact title matches with the default
sort, and clears text without resetting other filters. The player, purchases and persistence are unchanged.
