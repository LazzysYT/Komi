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

The home page combines an expressive hero with functional catalogue navigation. Text, controls and badges use white and neutral greys. Artwork keeps its original colours. Avoid coloured UI accents, a blurred portrait stretched across the viewport, or motion that interferes with choosing a title. Russian interface copy and Cyrillic-capable font fallbacks are required; anime subject matter does not imply a Japanese UI locale or target market.

## Colors

The current approved interface uses `#09090B` for the hero and navigation, `#16161A` for matte controls, `#1C1C21` for the active rail surface, and `#FFFFFF` for primary actions, ratings and progress. Recessed segments use `#242429`; inactive control labels use `#8E8E93`. The artwork remains bright to the right, with dark gradients concentrated behind text and at the bottom.

This file mirrors the established runtime token system; it does not generate CSS. `komi-pill-system.css` owns `--komi-pill-*`, `komi-icon-rail.css` owns `--rail-*`, and `button-animations.css` owns motion aliases. `komi-black-white.css` overrides the older red media-hub palette inside the production bundle; its retained shell values are `#090909`, `#151515` and white-grey text. The current feature layers deliberately use the more specific colours above. Old red declarations in earlier sources are legacy cascade inputs, not a direction to restore.

## Typography

Inter carries body copy and hero titles; Manrope/Inter at weight 700–800 carries pill controls. The hero title uses weight 800 and a two-line clamp. Descriptions use a 1.5 line height, up to three lines on desktop and two on narrow phones. Numeric slide counters use tabular figures. Continue-watching titles allow two complete lines with bottom padding so Cyrillic descenders remain visible; the full title stays in the card's accessible name.

## Layout

The desktop navigation rail is 72px and becomes the existing mobile bottom navigation below 768px. The hero spans its content area without a frame or rounded outer edge. Desktop height is `clamp(500px, 68vh, 660px)`; mobile content may grow naturally when long titles or wrapped metadata need more room. Search and resume surfaces keep their established overlay positions.

Hero counter, dots and arrows sit together on larger screens. At widths up to 640px, counter and playback controls occupy the first row and slide dots occupy a second row. Dots retain at least 24px-wide targets, and arrow/pause controls are 44px square. Extra bottom space keeps these controls clear of the watch/list/details actions.

Catalogue gutters and cards retain the existing 16px geometry. Continue-watching cards grow with their text; their image wrappers keep a 16:9 ratio and clipped rounded corners. Do not change generic catalogue card overflow to fix this shelf.

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

Hero controls have explicit hover, pressed, disabled and visible keyboard-focus states. The pause button shows the current rotation action through its icon and accessible label. Motion uses a seven-second Ken Burns cycle, a short slide fade and a staggered text reveal. Runtime pause/visibility state pauses ambient movement; reduced motion removes autoplay, zoom, parallax and reveal animation while manual navigation remains available. Actual video playback belongs to the media runtime described in `UX-CONTRACT.md`.

The 16:9 watch player, source selector, central play action and episode navigation retain their existing runtime owners: `cinema-layout-v3.css`, `cinema-hud-v4.css` and the later compact-watch layer. Episode thumbnails use available frames; manual quality appears when the stream has multiple variants. External sources retain their embedded-player recovery link and advertising notice.

## Do's and Don'ts

- Keep watch, list and details actions tied to the current real catalogue record.
- Use one pause state for progress, autoplay and ambient media; respect reduced motion.
- Keep landscape media unblurred and fall back to a contained portrait when needed.
- Do not restore the old red palette or give the rating a gold accent.
- Do not shrink carousel targets or clip text to make a narrow layout fit.

## Reconciled context

The earlier document described a red palette, 68px rail and 24px-radius hero. The user's approved monochrome work is already implemented in `komi-black-white.css`, `komi-pill-system.css`, `komi-icon-rail.css` and `komi-hero-senku.css`; this update records those decisions rather than introducing another rebrand. The legacy watch/player contracts below remain unchanged.

## Behavior
Source URLs are parsed once by player-core.js. player-runtime.js owns media initialization and disposal, HLS loading, saved position and form validation. player-controls.js binds the solo playback bar to the same video element. Watch Party reuses the media runtime and external embeds synchronize episode/source only. Existing komiStatusFeedback owns transient notices and player and form errors appear inline.

## Verification
scripts/player-core.test.cjs checks source parsing and ordered persistence. scripts/regression-browser.cjs covers four viewport widths and deterministic failure/race scenarios. Real provider playback, two authenticated accounts and cross-device synchronization require separate live verification. See AUDIT-2026-11-09.md.
