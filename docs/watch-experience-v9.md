# Watch experience v9

Date: 2026-11-25. Scope: watch presentation, episode identity, episode comments and one isolated hero-video pilot. The existing player engines and provider embeds remain in place.

## Episode audit: anime 5114

The public `anime_catalog` record contains 68 season-one entries. Entries 1–64 have multiple voice sources; entries 65–68 contain only `Озвучка STEPonee`. These are real provider entries: Kodik season 36476 maps episode numbers 65–68 to videos 514003–514006. The provider also advertises 68 for STEPonee and 64 for AniDUB, AniLibria.TV, MiraiDUB, СВ-Дубль and subtitles. Available metadata does not identify the additional entries by name or as OVA.

The television series has 64 main episodes: [TBS programme record](https://www.tbs.co.jp/tbs-ch/item/a0188/) lists 64, and [Aniplex volume 16](https://www.aniplex.co.jp/lineup/hagarenfa/products/detail/?id=2238) includes episode 64 as the final episode.

The display therefore says **64 серии + 4 дополнительных выпуска STEPonee**. This label applies conservatively only to the audited anime, season and source pattern. All 68 original array slots, URLs, player sources, progress identities and watch-party indices are retained. The catalog data is not truncated or reordered. Provider pages were verified; availability is not a promise that every third-party stream will remain playable.

None of the 68 entries has an episode-specific image. The UI labels the title poster **Постер тайтла**, with a prominent number. Episode-specific metadata or a successfully captured native frame can be labelled **Кадр серии**. A title-wide screenshot is never presented as an episode frame. If images fail, the number and accessible title remain available.

## Watch behavior

- Desktop: existing 16:9 player, compact searchable rail, white current-episode outline and `Сейчас смотришь` label.
- Below the player: episode heading, labelled Previous/Next actions, List and Watch Party; neutral watch controls follow shared monochrome tokens.
- Recovery is initially hidden and is revealed by a supported media error or the explicit `Видео не работает?` menu action. Cross-origin iframe failures that the browser cannot observe are handled through that manual action.
- Phone: full-width player followed immediately by Episodes and Voice buttons. Both use the existing bottom-sheet mechanism, including background inertness, keyboard dismissal and focus restoration.
- Voice intent persists across episode and season changes for the same open anime. If temporarily absent, a fallback is explained and does not overwrite the intended choice. When available again, the intended voice is restored. Explicitly closing the watch view clears that session intent.

## Comments and migration

Comments are scoped by `(anime_id, season, episode_number)`. `NULL`/`NULL` continues to identify the existing anime-wide discussion. Users can switch between the current episode and `Об аниме`. Fetch, decoration, cache and post completions use scope-aware stale-response guards. General-thread timecodes do not seek an arbitrary episode.

Migration `20261125095727_episode_scoped_comments.sql` adds the two nullable fields, a paired-scope CHECK and an index supporting scoped newest-first queries. It preserves author/RLS policies and rate-limit triggers. The hosted migration was applied and inspected; the CHECK is validated, RLS and the two existing triggers remain active, and EXPLAIN uses the new index without a separate sort. No test comments were posted to the live community.

## One-slide video pilot

The homepage appends one explicitly branded promotional slide to its existing anime carousel. It links to the catalogue and has no anime ID, rating or list action. The original first anime slide and its priority image remain unchanged. The promotional poster is deferred until its slide becomes active, followed by eligible desktop video. `/hero-video-preview.html` provides an isolated noindex preview of the same media. Both reuse `hero-hd-art.js`.

Source: the user's existing `KomiAnime_Ad_6s_1080p60.mp4`, a brand-only promo. A quiet segment was converted into a six-second forward/reverse loop, desaturated to match the current interface. No anime episode footage is attributed to a title.

| Asset | Size | Format |
| --- | ---: | --- |
| Video | 144,362 bytes (141 KiB) | 1280×720, H.264, 24 fps, 6 seconds, no audio, fast-start MP4 |
| Immediate poster | 13,214 bytes (12.9 KiB) | WebP, exact first frame of the final loop |

The original promo is 3,557,648 bytes, so the optimized video is about 96% smaller. This is a payload comparison, not a network-latency claim. Video attaches only to the active visible desktop slide when motion and data preferences permit it. Inactive slides release their source; phones, reduced-motion and Save-Data use the static poster. Explicit pause is preserved through visibility and layout changes.

## Verification

Automated regression coverage checks source continuity/fallback, all 68 stable episode identities, thumbnail truthfulness and image failures, comment scoping and stale requests, recovery visibility, bottom-sheet focus restoration, hero media gating, navigation, CSS and home compatibility. The final regression run, including the integrated homepage promotion and carousel tests, passed **127/127 tests**. Static homepage inspection confirms six slides, exactly one brand-video marker, a deferred brand poster and no initial video element.

An isolated copy passed the exact Vercel production build command, JavaScript/structured-data syntax checks and first-paint consistency checks. The design-document linter reported no errors. Strict frontend audit has 91 existing baseline findings; three additional actionless-button reports were inspected and are false positives because the analyzer does not recognize the existing JavaScript event bindings. The project-wide strict audit is not claimed as clean.

### Browser and deployed-resource verification

The hosted preview built from commit `c4d5484bec539a37d5326029aa17a39f872f723b` was inspected in a real browser at desktop width 1536px and phone width 390px. The player retains 16:9 geometry. The desktop rail and phone layout have no horizontal document overflow; the phone player is followed immediately by the two bottom-sheet buttons. Episode search, selection, current-state labels and both sheets work. Escape returns focus to the opening Voice button.

AniDUB remains selected across ordinary episode changes. Selecting supplemental release 68 falls back to STEPonee with an explanation, then returning to episode 64 restores AniDUB. Episode comments and the general discussion switch independently. Recovery is hidden initially, appears through the Help action and resets on an episode change. No live comments were posted during QA.

Provider limitation observed during QA: the catalog's Kodik AniDUB URLs for episodes 2 and 64 return a missing-season message in the iframe and HTTP 500 when requested independently. The same URLs existed before this release; the catalog record has not changed since 2026-11-10. The old and new player-core/runtime and embed HTML builder are identical, and both select the same URLs. STEPonee episode 2 and subtitles episode 1 load their actual player preview frames. This release does not claim to repair provider-side stream availability.

The brand video actually plays muted and looped on desktop (`readyState = 4`); its source is released on leaving the slide. After a fresh phone reload, selecting the same promo shows the still image with no video element and no poster animation. Reduced-motion and data-saving rules are covered by the media tests. One visual defect found during this check—black Next-button text on a dark hover background—was corrected in the scoped watch stylesheet and given a new asset revision.

Published preview resources return HTTP 200 with correct MIME types and sizes. Both media ETags match the MD5 of the committed local assets. The second MP4 request is a Vercel cache HIT. The first preview build took 7.877 seconds from `buildingAt` to `ready`; this is build time, not page-load time. Browser resource timing is not exposed by the available browser inspection tool, so no LCP, mobile network timing or Lighthouse score is claimed. The baseline source/episode audit remains separate from a guarantee of every third-party stream's availability.
