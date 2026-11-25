---
version: alpha
name: "Komi Anime"
description: "A Russian-language anime catalogue with monochrome controls and cinematic, artwork-led discovery."
colors:
  primary: "#FFFFFF"
  background: "#09090B"
  surface: "#16161A"
  active: "#1C1C21"
  segment: "#242429"
  muted: "#8E8E93"
typography:
  display:
    fontFamily: "Inter, Manrope, sans-serif"
  controls:
    fontFamily: "Manrope, Inter, sans-serif"
  body:
    fontFamily: "Inter, sans-serif"
rounded:
  hero: "0px"
  card: "16px"
  pill: "999px"
spacing:
  catalog-gap: "16px"
  rail-width: "72px"
components:
  hero: {}
  button: {}
  continue-card: {}
---

# Komi Anime

## Overview

Komi Anime is a Russian-language anime catalogue and viewing application. Discovery should feel like browsing a cinema programme: a readable title on the left, clear anime artwork on the right, then compact shelves and familiar controls. The requested reference is the composition of `senku.one`; Komi's own monochrome controls, routing and personal lists remain its product identity.

The home page is a storefront for choosing what to watch; the catalogue owns the full grid and precise search filters. A guest sees the hero, recommendations, genres, confirmed recent episodes and upcoming dates. A viewer with unfinished progress sees one compact continue-watching rail immediately after the hero. Empty history creates no section and no sign-in prompt. Text, controls and badges use white and neutral greys. Artwork keeps its original colours. Avoid coloured UI accents, a blurred portrait stretched across the viewport, or motion that interferes with choosing a title. Russian interface copy and Cyrillic-capable font fallbacks are required; anime subject matter does not imply a Japanese UI locale or target market.

## Colors

The current approved interface uses `#09090B` for the hero and navigation, `#16161A` for matte controls, `#1C1C21` for the active rail surface, and `#FFFFFF` for primary actions, ratings and progress. Recessed segments use `#242429`; inactive control labels use `#8E8E93`. The artwork remains bright to the right, with dark gradients concentrated behind text and at the bottom.

This file mirrors the established runtime token system; it does not generate CSS. `komi-pill-system.css` owns `--komi-pill-*`, `komi-icon-rail.css` owns `--rail-*`, and `button-animations.css` owns motion aliases. `komi-black-white.css` overrides the older red media-hub palette inside the production bundle; its retained shell values are `#090909`, `#151515` and white-grey text. The current feature layers deliberately use the more specific colours above. Old red declarations in earlier sources are legacy cascade inputs, not a direction to restore.

## Typography

Inter carries body copy and hero titles; Manrope/Inter at weight 700–800 carries pill controls. The hero title uses weight 800 and a two-line clamp. Descriptions use a 1.5 line height, up to three lines on desktop and two on narrow phones. Numeric slide counters use tabular figures. Continue-watching titles allow two complete lines with bottom padding so Cyrillic descenders remain visible; the full title stays in the card's accessible name.

## Layout

The desktop navigation rail is 72px and becomes the existing mobile bottom navigation below 768px. The hero spans its content area without a frame or rounded outer edge. Desktop height is `clamp(500px, 68vh, 660px)`; mobile height is `clamp(430px, 62svh, 470px)`, shared by the boot, static and hydrated surfaces. Title and description rows reserve their space to prevent a late artwork or metadata response from shifting the next shelf. Search keeps its established overlay position; continue-watching appears below the hero instead of adding another overlay.

Hero counter, dots and arrows sit together on larger screens. At widths up to 640px, counter and playback controls occupy the first row and slide dots occupy a second row. Dots retain at least 24px-wide targets, and arrow/pause controls are 44px square. Extra bottom space keeps these controls clear of the two hero actions: a white «Смотреть» link and a secondary «В список» button. Missing descriptions remain empty, with no «Аниме» filler.

Catalogue gutters and cards retain the existing 16px geometry. Storefront recommendations use vertical 2:3 posters, a single rating overlay, a two-line title and a quiet year/format/episode-count row. The label «Рекомендуем» and subtitle disclose Shikimori score and freshness as the selection principle. Continue-watching uses a separate 16:9 preview, title, season, episode, timecode and a thin white progress bar. Mobile cards are at most 310px or 82vw so a complete card and the next card's edge remain visible. Each rail owns its horizontal scrolling; the document keeps natural vertical scrolling.

Recent/upcoming episodes are compact horizontal rows with a small 2:3 thumbnail, title, episode and date. A confirmed-release rail is omitted when there is no qualifying data. Upcoming dates retain a clear empty/error state and refresh action, with the notice that voice-over availability may be later. Watch Party, shop and Premium remain navigation destinations rather than extra first-screen panels.

## Elevation & Depth

Use neutral translucent glass only behind controls, subtle white borders, and a restrained glow on the primary watch action. Gradients provide legibility without applying blur or brightness filters to artwork. Dedicated landscapes fill the hero. Portrait fallback artwork is contained to the right on desktop and at the top on phones instead of being enlarged into a blurred background.

## Shapes

Primary and secondary actions are pills with a 999px radius. Carousel arrows and pause are circles. Catalogue cards retain a 16px radius; the full-width hero is intentionally square-edged. SVG icons keep consistent optical size and must have Russian accessible labels when used without visible text.

## Components

| Visual role | Runtime owner | Consumers |
|---|---|---|
| Base, matte, recessed and white controls | `komi-pill-system.css` (`--komi-pill-base`, `--komi-pill-matte`, `--komi-pill-graphite`, `--komi-pill-white`) | Shared pills and segments |
| Rail background and active surface | `komi-icon-rail.css` (`--rail-bg`, `--rail-active`) | Desktop rail and mobile navigation |
| Hero composition and artwork treatment | `komi-hero-senku.css`, loaded after the production bundle | Carousel and matching first-paint surfaces |
| Hover/press easing | `button-animations.css` (`--ease-spring`, `--ease-press`) | Existing interactive controls |
| Catalogue geometry | `komi-media-hub.css` (`--hub-grid-gap`, `--hub-card-radius`) | Catalogue and continue-watching shelves |
| Storefront shelves and card variants | `home-discovery.css`, scoped to `.komi-home-storefront` | Recommendations, continue-watching and release rails |
| Storefront rendering | `home-discovery.js`; `app-main.js` `renderCard(..., { variant: 'discovery' })` | Native detail links and the existing catalogue card owner |
| Release selection and markup | `home-release-shelves.js` | Recent confirmed episodes and existing upcoming schedule |

Hero controls have explicit hover, pressed, disabled and visible keyboard-focus states. The pause button shows the current rotation action through its icon and accessible label. Motion uses a seven-second Ken Burns cycle and a short slide fade; text and the watch action are visible immediately without a staged reveal. Runtime pause/visibility state pauses ambient movement; reduced motion removes autoplay, zoom and parallax while manual navigation remains available. Actual video playback belongs to the media runtime described in `UX-CONTRACT.md`.

The 16:9 watch player, source selector and central play action retain their existing runtime owners. `komi-watch-compact-v6.css` owns the final watch composition and maps `--watch-bg`, `--watch-panel`, `--watch-raised` and `--watch-current` to the shared `--komi-pill-*` tokens. The former red current-episode outline and purple Party action were drift; both now follow the approved monochrome palette. The current row has a white outline and the text «Сейчас смотришь».

Desktop keeps a compact episode rail to the right of the player, with number search and a clear button. The title and episode number sit below the video alongside labelled «Предыдущая» / «Следующая» buttons. On phones the player reaches the content edges; immediately below are two equal pills, «Серии» and «Озвучка», which open the existing bottom sheet. The title, episode navigation, list/Party actions and comments follow in that order. Each panel owns its own scrolling; the watch page remains vertically scrollable.

Episode thumbnails explicitly distinguish «Кадр серии», «Постер тайтла» and «Нет изображения». A title-wide screenshot cannot stand in for a verified episode frame. A large number badge survives every image failure. Verified supplemental entries carry their original public numbers and a text label; they are not silently dropped or renamed as OVA. Comments have neutral pills for the current episode and the general discussion. Retry/source recovery appears after a media error or the viewer's «Видео не работает?» action, rather than occupying space on every embedded-player visit.

The single video pilot is an explicitly branded KomiAnime slide at the end of the home carousel, made from the owner's existing promotional clip. It reuses `hero-hd-art.js` and `komi-hero-senku.css`, with a six-second monochrome loop, its exact first frame, the existing pause control and a catalogue link. It has no anime identity, rating or list action. The first anime slide and its high-priority artwork are preserved; the brand poster and video are deferred until their slide becomes active. Phone, reduced-motion and data-saving states stay on the still image. `hero-video-preview.html` offers the same media in an isolated, labelled noindex preview.

## Do's and Don'ts

- Keep watch/list actions and detail-card links tied to the current real catalogue record.
- Use one pause state for progress, autoplay and ambient media; respect reduced motion.
- Keep landscape media unblurred and fall back to a contained portrait when needed.
- Do not restore the old red palette or give the rating a gold accent.
- Do not shrink carousel targets or clip text to make a narrow layout fit.

## Reconciled context

The earlier document described a red palette, 68px rail and 24px-radius hero. The user's approved monochrome work is already implemented in `komi-black-white.css`, `komi-pill-system.css`, `komi-icon-rail.css` and `komi-hero-senku.css`; this update records those decisions rather than introducing another rebrand. The legacy watch/player contracts below remain unchanged.

## Behavior
Source URLs are parsed once by player-core.js. player-runtime.js owns media initialization and disposal, HLS loading, saved position and form validation. player-controls.js binds the solo playback bar to the same video element. Watch Party reuses the media runtime and external embeds synchronize episode/source only. Existing komiStatusFeedback owns transient notices and player and form errors appear inline.

## Verification
`tests/home-storefront.test.cjs`, `tests/home-release-shelves.test.cjs` and `scripts/resume-open-hydration.test.cjs` cover storefront order, ownership of unfinished history, native links, truthful releases and the early-click resume guard. `scripts/build-home-shell.cjs --check` verifies the first-paint hero matches the live renderer. The hero suites retain motion, artwork and hydration checks; `scripts/player-core.test.cjs` retains source parsing and ordered persistence checks. Browser verification covers guest/history layouts on desktop and 375/390px, keyboard controls and filtered genre navigation. A layout fixture does not establish live provider seeking, real two-account or cross-device synchronization; those still require separate live verification. See AUDIT-2026-11-09.md for older runtime limitations.

### AniCoin shop

The shop uses the same matte neutrals and white primary controls as discovery. The weekly collection is a single editorial feature with a monochrome texture and live samples; cosmetic items themselves retain their intended colors. Tiles separate preview, title, price and action so the price stays readable when an account cannot afford a purchase. Desktop keeps the fitting room beside the catalog; narrow views use the existing anchored sheet and two columns where labels and actions fit. Keep account states and server-backed operations intact: preview is free, actual purchasing uses the AniCoin ledger, and the redesigned shop does not change Premium pricing.
