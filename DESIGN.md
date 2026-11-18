# Komi Anime

## Context
Russian-language anime catalogue and viewing application with dark surfaces, white accents, poster-led cards and compact navigation.

## Runtime tokens
`mono-ui.css` owns the shared palette. `cinema-layout-v3.css` owns the watch mode surfaces, muted text, rounded panels and coral current-episode label. The 16:9 video leads the screen, with the title and series navigation directly below it and the episode list alongside it. On narrow screens the list stacks below the video. List thumbnails use the episode image when present and fall back to the series artwork. `cinema-hud-v4.css` styles the playback timeline and circular overlay controls. Playback settings use a disclosure with native selects for speed and subtitles. Embedded sources use the provider's playback controls.

## Behavior
Source URLs are parsed once by player-core.js. player-runtime.js owns media initialization and disposal, HLS loading, saved position and form validation. player-controls.js binds the solo playback bar to the same video element. Watch Party reuses the media runtime and external embeds synchronize episode/source only. Existing komiStatusFeedback owns transient notices and player and form errors appear inline.

## Verification
scripts/player-core.test.cjs checks source parsing and ordered persistence. scripts/regression-browser.cjs covers four viewport widths and deterministic failure/race scenarios. Real provider playback, two authenticated accounts and cross-device synchronization require separate live verification. See AUDIT-2026-11-09.md.
