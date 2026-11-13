# Komi Anime

## Context
Russian-language anime catalogue and viewing application with dark surfaces, white accents, poster-led cards and compact navigation.

## Runtime tokens
`mono-ui.css` owns the shared palette. `cinema-layout-v3.css` and `cinema-hud-v4.css` style the full-window viewer, with compact title information above the 16:9 player and a light selection in the episode panel. Browser and provider video controls handle playback, volume and captions. Komi's player controls handle source selection and fullscreen.

## Behavior
Source URLs are parsed once by player-core.js. player-runtime.js owns media initialization and disposal, HLS loading, saved position and form validation. Watch Party reuses that media owner; external embeds synchronize episode/source only. Existing komiStatusFeedback owns transient notices; player and form errors remain inline.

## Verification
scripts/player-core.test.cjs checks source parsing and ordered persistence. scripts/regression-browser.cjs covers four viewport widths and deterministic failure/race scenarios. Real provider playback, two authenticated accounts and cross-device synchronization require separate live verification. See AUDIT-2026-11-09.md.
