# Komi Anime

## Context
Russian-language anime catalogue and viewing application. Existing visual identity is retained: dark surfaces, red Komi accent, poster-led cards, compact navigation. No Japanese-market workflow is implied by anime content.

## Runtime tokens
The final :root declarations and component CSS in index.html own existing colors, type and spacing. This reliability patch does not introduce a second theme. Native video controls own playback, volume, captions, keyboard access and fullscreen. The media viewport retains the site's 16:9 layout.

## Behavior
Source URLs are parsed once by player-core.js. player-runtime.js owns media initialization and disposal, HLS loading, saved position and form validation. Watch Party reuses that media owner; external embeds synchronize episode/source only. Existing komiStatusFeedback owns transient notices; player and form errors remain inline.

## Verification
scripts/player-core.test.cjs checks source parsing and ordered persistence. scripts/regression-browser.cjs covers four viewport widths and deterministic failure/race scenarios. Real provider playback, two authenticated accounts and cross-device synchronization require separate live verification. See AUDIT-2026-11-09.md.
