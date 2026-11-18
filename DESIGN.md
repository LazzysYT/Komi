# Komi Anime

## Context
Russian-language anime catalogue and viewing application with poster-led discovery and compact navigation. The home and catalog use the Premium Dark + Red palette.

## Runtime tokens
`mono-ui.css` owns the shared palette. `cinema-layout-v3.css` owns the watch surfaces, desktop navigation rail, rounded panels and coral current-episode label. The 16:9 video leads the screen, with title and series navigation below it and the episode list alongside it. On narrow screens the episode list stacks below the video. Episode thumbnails use catalog frames when available and display the episode number as a placeholder. `cinema-hud-v4.css` styles the source picker, central play button and circular playback controls. Manual quality appears when the stream provides multiple variants. External sources use an embedded provider player with a recovery link and an advertising notice.

The media hub shell, home and catalog use runtime tokens in `komi-media-hub.css`, loaded after the shared CSS bundle. The page is #0E0F13, panels are #15171E, and #FF454F marks play, progress and the current destination. Floating controls use a 16px glass blur. The 68px rail becomes a bottom tab bar below 768px. The hero radius is 24px, the card radius is 16px, and the catalog uses 16px gutters. The existing drawer, cards, progress and search handlers serve both responsive layouts.

## Behavior
Source URLs are parsed once by player-core.js. player-runtime.js owns media initialization and disposal, HLS loading, saved position and form validation. player-controls.js binds the solo playback bar to the same video element. Watch Party reuses the media runtime and external embeds synchronize episode/source only. Existing komiStatusFeedback owns transient notices and player and form errors appear inline.

## Verification
scripts/player-core.test.cjs checks source parsing and ordered persistence. scripts/regression-browser.cjs covers four viewport widths and deterministic failure/race scenarios. Real provider playback, two authenticated accounts and cross-device synchronization require separate live verification. See AUDIT-2026-11-09.md.
