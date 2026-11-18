# Komi Anime

## Context
Russian-language anime catalogue and viewing application with dark surfaces, white accents, poster-led cards and compact navigation.

## Runtime tokens
`mono-ui.css` owns the shared palette. `cinema-layout-v3.css` owns the watch surfaces, desktop navigation rail, rounded panels and coral current-episode label. The 16:9 video leads the screen, with title and series navigation below it and the episode list alongside it. On narrow screens the episode list stacks below the video. Episode thumbnails use catalog frames when available and display the episode number as a placeholder. `cinema-hud-v4.css` styles the source picker, central play button and circular playback controls. Manual quality appears when the stream provides multiple variants. External sources use an embedded provider player with a recovery link and an advertising notice.

## Behavior
Source URLs are parsed once by player-core.js. player-runtime.js owns media initialization and disposal, HLS loading, saved position and form validation. player-controls.js binds the solo playback bar to the same video element. Watch Party reuses the media runtime and external embeds synchronize episode/source only. Existing komiStatusFeedback owns transient notices and player and form errors appear inline.

## Verification
scripts/player-core.test.cjs checks source parsing and ordered persistence. scripts/regression-browser.cjs covers four viewport widths and deterministic failure/race scenarios. Real provider playback, two authenticated accounts and cross-device synchronization require separate live verification. See AUDIT-2026-11-09.md.
