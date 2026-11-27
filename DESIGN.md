---
version: alpha
name: "Komi Anime"
description: "A Russian-language anime catalogue with monochrome controls and cinematic, artwork-led discovery."
colors:
  primary: "#FFFFFF"
  background: "#090909"
  surface: "#161616"
  active: "#242424"
  segment: "#242424"
  muted: "#A3A3A3"
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

## Comfort refinement, 26 November 2026

This revision supersedes the earlier all-pill guidance for discovery
and catalogue; the compact icon-only desktop navigation is retained. The brief is a comfortable monochrome anime library. References:
Senku's image-led discovery, AnimeOn's explicit catalogue controls and Yanima's
direct watch actions; do not copy their colour accents or upsells.

Palette: canvas #090909, surface #161616, selected/recessed #242424, secondary
text #A3A3A3, reading text #F5F5F5, white actions. komi-pill-system.css remains
the runtime token owner; komi-icon-rail.css maps rail aliases. Personal cosmetics
and original anime artwork retain their colours. Legacy feature palettes remain
upstream cascade inputs. Manrope 700 carries headings; Inter 400–500 carries copy;
controls use Manrope 600. Existing font delivery is retained. Hero actions and
shelf links use 10px corners, selected categories retain pills, carousel controls
remain circles. Selected pills no longer glow.

Plan comparison: another decorative catalogue banner would repeat the home hero
and delay browsing. Choose the working-library composition with actual posters
visible sooner and one compact scrolling row of genres. All copy is left aligned.

    Desktop (768px+)               Phone
    K icon    | Global search      Search / More
    Home icon | Title / tools      Catalogue title / tools
    Catalog   | Title search       Title search / feedback
    Partners  | Categories         Categories
    Shop      | Genres             Genres / filter sheet
    Party     | Poster grid        Two-column poster grid
    Account   |                    Bottom navigation
    *Existing authenticated visibility remains authoritative.

Desktop navigation is a stable 72px icon rail at 768px and above; labels appear on hover and keyboard focus. Below 768px retains the labeled mobile dock. Catalogue DOM order is heading, search and feedback, categories, compact genres, advanced filters. Phones use the existing
sheet as their single advanced-filter entry; desktop keeps the inline panel.
Home keeps one cinematic image, quieter controls and inset recommendation shelves.

Review against the brief: actual anime artwork is the signature. No new tagline,
artificial statistics, decorative numbering, font download or independently loaded
theme. Extend maintained stylesheet owners; preserve IDs, events, routes and state.
Verify 320/390px, tablet/wide navigation, long titles, open filters, empty/reset,
keyboard access, guest login and watch entry before releasing.

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

Catalogue gutters and cards retain the existing 16px geometry. Storefront recommendations use vertical 2:3 posters, a single rating overlay, a two-line title and a quiet year/format/episode-count row. The full catalogue shares this poster, badge and typography on both direct HTML and hydrated/filter results, but keeps its responsive grid instead of a horizontal rail. Catalogue-only watch and quick-list actions sit over the poster on hover, focus or touch; they are separate from the native details link. The label «Рекомендуем» and subtitle disclose Shikimori score and freshness as the selection principle. Continue-watching uses a separate 16:9 preview, title, season, episode, timecode and a thin white progress bar. Mobile cards are at most 310px or 82vw so a complete card and the next card's edge remain visible. Each rail owns its horizontal scrolling; the document keeps natural vertical scrolling.

Recent/upcoming episodes are compact horizontal rows with a small 2:3 thumbnail, title, episode and date. Both rails are omitted when there is no qualifying data, including while the initial schedule is loading. Upcoming dates retain a refresh action and the notice that voice-over availability may be later; a failed refresh explains that already confirmed dates remain visible. Watch Party, shop and Premium remain navigation destinations rather than extra first-screen panels.

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

The homepage rotates its five editorial lead titles once per Kyiv calendar day. The order remains fixed through catalogue refreshes; the Komi promo is always last. Each title uses its own 1280×720 TMDB still, selected by the public media-index episode mapping; the hero title, artwork and watch route switch only after the target still is ready. Warm only the next slide when not constrained, and keep the current slide if the target image fails.

The initial daily hero can paint as soon as the document is parsed and its chosen image has decoded. `komi-home-boot.js` prepares the existing generated hero template; `home-discovery.js` adopts that same mounted image and layout when the application starts. Native watch and catalogue links remain usable during startup. List and carousel buttons stay disabled until their real handlers are available. The temporary preview has the same geometry, typography and artwork as the complete homepage, without introducing another visual layout.

The home first paint uses the existing system-font fallbacks before activating the unchanged web-font families after the hero has had a paint opportunity. Other routes and failed-image startup have bounded release paths. Motion and shared cosmetic styles load without blocking the public hero, then apply in their original cascade position; shop/profile routes promote their cosmetic styles immediately. Mobile navigation and hero geometry remain in the blocking stylesheet set.

The existing advertising SDK starts after document application startup and the first artwork settle, followed by a paint opportunity and idle scheduling. Its publisher, SDK URL and eventual behavior remain unchanged. This keeps third-party download/CPU timing out of the content's initial rendering path; bounded fallbacks cover failed scripts, images and suspended frames.

The five daily 1280×720 stills are served from `assets/hero/daily/` on the same origin. They are byte-for-byte copies of the WebP representations previously delivered by the external provider, with source URLs and hashes in `sources.json`; no recompression or visual changes are introduced. Stable source-key filenames use immutable caching. The first-paint stylesheet omits positively scoped hidden-feature rules while retaining hiding rules, globals and ambiguous selectors; the complete cascade is still loaded afterward.

The main layout reserves at least one viewport of height so the shared public footer stays below the initial screen during the neutral shell, early hero and shelf hydration. The footer remains in normal document flow, including without JavaScript and on direct section routes.

Production combines the three synchronous startup helpers into one local script, preserving their existing order and classic-script scopes while removing two serial requests. The daily lineup is selected before computing any full-catalog hero fallback, so the regular daily hero does not pay for a discarded sort.

Release shelves reuse date/time formatters within one render. The visible Russian labels and local timezone stay the same; recreating the formatters on the next render honors later timezone changes without repeated formatter construction for every card.

Public recommendations retain the twelve best candidates during one catalog pass, using the existing freshness/rating ranking and stable source order for ties. The daily hero computes year labels only for the titles it displays; full-catalog year/episode preparation belongs to the legacy fallback that needs it.

The episode rail is a near-black filmstrip: #0C0C0E panel, #151517 rows, #2B2B2F outlines, #ACACB3 secondary text and a white current/focus outline. The only color comes from 16:9 episode frames. Rows without a verified frame use the episode number on a dark plate, not a repeated title poster. Assistive labels distinguish «Кадр серии» from «Нет изображения». The toolbar keeps number search and list/grid controls together on desktop and wraps in the existing phone sheet. A large number badge survives every image failure. Verified supplemental entries carry their original public numbers and a text label; they are not silently dropped or renamed as OVA. The under-player shelf pairs a balanced title with adjacent transport controls, and puts secondary actions on a separate matte strip. Comments use a #101012 panel with a compact segmented episode/general switch, a #161618 composer and a single dashed empty-state row. On phones the switch sits below the title, and the submit action wraps below the draft on small widths. Keep spoilers, draft state, moderation and login guidance in the existing comment owner. Links in «Свежие серии» always carry the announced episode number. When a season is unknown, resolve only against a unique playable number; show a season choice on ambiguity and an explicit unavailable state instead of falling back to episode one. Header search uses real native focus on suggestions (Up/Down, Enter, Escape), while the guest Watch Party CTA opens the shared login with its own explanation. Shop CTA accessible names must start with their visible action, including «Войти».

The player entry uses an opaque dark loading surface for native watch links and keeps the watch overlay mounted while switching episodes. Overflow actions use the watch action strip as their containing block so long labels and the full-screen button cannot overlap neighboring rows. Retry/source recovery appears after a media error or the viewer's «Видео не работает?» action, rather than occupying space on every embedded-player visit.

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

The shop is a profile fitting room beside a browsable collection of real, server-priced cosmetics. `komi-shop-v5.css` is the single final layout owner, scoped to `.komi-shop-studio`; its `--shop-bg`, `--shop-raised`, `--shop-active` and `--shop-fg` aliases consume `--komi-pill-base`, `--komi-pill-matte`, `--komi-pill-graphite` and `--komi-pill-white`. The quiet card surface remains `#131316`; secondary labels are `#a6a6af` for readability. Existing Manrope/Inter roles and white pill actions are preserved. `komi-shop-v6-goods.css` owns shared cosmetic appearances, including actual profile, comment and Premium-studio renderers.

The signature is a live profile miniature using the viewer's avatar and selected cosmetics. Six permanent collections show real frame/cover combinations and offer separate browse and try-on actions. They replace the oversized weekly banner and its countdown: these collections have no expiry or claimed discount. Cosmetics retain their intended colors inside a monochrome interface. Compact Catalog/My items navigation, clearable search, explicit categories, balance/ownership filters and a native sort select lead to the products. Native operating-system select popups are accepted, as on sibling workflows.

The compact «Магазин оформления» header leads directly to one full-width search toolbar. Catalog/My items and a prominent product search share its first row; native category and sort selects plus ownership/balance filters share the next. There is no duplicate horizontally scrolling category rail. Collections start collapsed on every screen; an explicit user choice persists across renders. Desktop shows three or four product columns beside a 320px fitting room. A desktop collection try-on brings the fitting room into view and focuses its heading, with immediate scrolling under reduced motion. At 980px the fitting room becomes a persistent, explicitly non-modal expandable sheet; its header, reset action, comment preview and checkout feedback stay reachable. The mobile bottom navigation has its own reserved clearance. The compact community button sits beside the collapsed sheet and yields while the sheet is expanded. On phones the search spans a full row, with category and sort selects side by side beneath it. Product cards retain two columns down to 320px with natural-height text and a separate visible price. Cards show a labelled try-on action without requiring hover. Only the inspected card animates; reduced motion disables cosmetic movement.

The fitting room has three real layout rows: a header with Profile/Comment switches, a bounded scroll region, and a separate static checkout footer. Checkout never overlays preview content. An empty trial shows a short hint instead of a zero total and disabled purchase button. Plate trials reveal the comment view; other trials reveal the profile. Filtering preserves the scroll position, while a new trial returns the preview to its top. Nickname product cards use a readable sample, while the fitting room retains the actual account name. Avatar image and fallback are mutually exclusive; local SVG artwork renders all paid reactions without depending on OS emoji fonts. The catalogue renders 24 items at a time and offers explicit Load more. Card geometry is reserved, and no new remote images or fonts are needed for the 48 additions. The preview's XP bar is clearly a style sample, never a fictional user level. Purchased/equipped states and cost remain separate. Purchase confirmation is a shared native dialog styled with the same tokens; its composition shows the exact items, total and resulting balance. Preview never spends coins or changes the profile.

Reconciled shop drift: the previous large weekly feature and dense wrapped category rows delayed access to products on phones; they are replaced by compact collections and native filters. The previous browser confirmation is replaced by the app-owned dialog. Hard-coded sample XP identity is removed. Older shop CSS remains an upstream cascade input; this layout owner deliberately replaces those screen-level rules rather than adding another separately loaded skin.

### Profile: identity, navigation, then content

The user requested a closer profile reference to Senku on 25 November. `profile-studio.css` now centers the avatar, name, cosmetics and profile actions over the existing cover, with a natural-height header and an 88px avatar. One summary strip places XP beside list, episode, time and friend metrics; unverified metrics display an em dash. This replaces the earlier left-aligned tall card and repeated numerical panels. The studio layer maps its surface and control aliases to the shared `--komi-pill-*` tokens; personal animated media, purchased frames, nickname styles and music retain their existing owners.

The profile has a 1240px maximum width. Overview, lists, owner-only history and friends are primary navigation; a native «Ещё» disclosure holds achievements, wall and owner-only activity. Only the primary row scrolls horizontally, so the disclosure stays visible and its popup is not clipped. The selected section remains a white pill. Profile editing opens the existing settings panel; «Оформление» opens the existing Premium studio. The tools for collections and import belong inside Lists, not the primary navigation.

Overview leads with at most two real unfinished resume cards when available, then a compact list distribution beside viewing genres (stacked on phones), and actual favorites with a single add action. List rows use subtle grayscale markers and real counts; an empty profile gets no fabricated percentages or rating graph. Premium retains six favorite positions without drawing empty placeholders for every unused slot. The quieter side column contains the owner’s private activity (episodes marked since Monday UTC and server-confirmed check-in streak), up to three achievement previews and friends. Full achievements and all account actions remain in their own sections. A signed-out visitor at the own-profile route gets the existing explicit sign-in screen.

At 860px the overview becomes one column; at 620px the summary becomes two columns with XP spanning both. Header text wraps naturally, cards retain accessible names, and focus is restored to the selected primary control or the disclosure summary. Motion never delays content, and reduced motion removes hover/entry transforms.

### Home image first paint

The hero keeps a neutral, correctly sized backdrop before artwork arrives or when all sources fail. Do not render the generic Komi logo as a fullscreen image or use its dimensions to classify the hero. Known portrait fallbacks remain portrait even before decode. Near the viewport, the recommendations rail starts only its first two covers immediately; the rest remain visibility-loaded. Reserve the card geometry without flashing logo thumbnails while images arrive.

A portrait-only slide still needs a banner composition on wide screens. Use a right-hand crop with preserved aspect ratio and feather the left edge into the text field. Do not put the original portrait in a narrow strip or stretch it into a blurred full-width background. Keep landscape art and mobile portrait positioning independent.

### Header quick menu

The native header disclosure keeps the navigation, sound, sign-in and dynamic account controls. Its matte graphite popover pairs the two social links above the site sections, then separates settings and account actions with a hairline. Rows use a common 44 px target and consistent 17 px outline icons; the sound switch mirrors the existing pressed state and AniCoin uses tabular numerals. Open and close share a short opacity and position transition on supporting browsers; reduced motion opens and closes immediately. The mobile dock's separate «Ещё» menu is unchanged.

### Search and footer correction (26 November 2026)
The v5 catalogue search is a single outlined flex surface: search icon, transparent borderless text input, and conditional clear button. Its wrapper owns keyboard focus feedback. The home browse link is a compact end-of-list action; all site and social links live in the native shared footer. The footer reserves clearance for the community launcher and mobile dock without duplicating navigation.

### Catalogue contact prints
Existing AniCoin products are displayed in miniature versions of the surfaces
where they appear. The scene is a dark film contact print with registration
marks: profile header, hover card, comment or watch room. Use the product's
existing cosmetic classes inside, without retinting the purchased item.
Card copy names the exact slot, not just «Профиль». Preserve the shared
renderer, filters, fitting room, native confirmation and server quotes.

### Station 00:17 collection
Two custom cinematic SVG prints, after-hours rail infrastructure and moving
rain. Let warm train windows be the only amber focal point. No third-party
art, remote asset dependencies, auto-playing video, or background redraw
effects. Respect reduced motion. Archiving a card changes store discovery
only; owners keep item IDs, fitting, visibility in inventory and equipment.

### Anime foil titles
Centered enamel badge over a dark scene, a single emblem and a narrow traveling
reflection. Color belongs to the title, not the rest of the shop. Real title
IDs pick the same emblem and palette in cards, fitting, Premium studio and
public profile. Idle shop cards stay still; user hover or keyboard focus plays
the sheen. Reduced motion has a static highlight and high-contrast mode keeps
the text readable. Old names, prices, inventory and equipment remain intact.

### Title gallery
Only titles are offered for new cosmetic purchases. Other IDs, prices, gifts,
equipment, history and ownership stay intact; existing owners manage them in
«Мои предметы». The main view shows distinct effects: a stylized scarlet
droplet, cold blade trail, purple mist, sparks, petals, stars and classic foil.
Contexts share one badge, with no flash and stable metrics. The store is still
until hover/focus; fitting and profile animate unless reduced motion is active.

### Character study titles
Fan-made profile badges combine an original small emblem with a personal motion
study. Show the character and work on each shop card to make the catalog
searchable and the inspiration explicit. Keep the first frame still in the
catalog; motion is opt-in by hover, keyboard focus or fitting. Never obscure
the name or use flashing, imported assets or franchise logos.

### Live profile cosmetics
The catalog deliberately reopens four slots for four new IDs only. Retired inventory and refunds are not reversed, and the 40 existing title treatments keep their prices. The four physical motifs are lacquer with a restrained crimson crack, a stroked ink signature, a strip of print panels, and a warm pool of cinema lamplight. Animate only the relevant component; honor reduced motion and avoid movement on initial XP hydration. A cinematic showcase displays at most three actually saved favorites, and does not grant access to private data. A neutral poster sample appears in a fitting room with no favorites. The new cosmetics are direct purchases; the existing gift list continues to show eligible titles only.

## Tokyo Ghoul collection · foil booster

The package is a single, crimped foil object, not a full-bleed banner or a
chest. Komi's neutral navigation/actions stay intact. In the collection only:
ink #151217, oxblood #411C2B, foil #7B263B, silver-pink #E4C5C9. Use a framed
2:3 collectible face, a real roster number, and the existing rarity colors.
Names sit above the lower foil edge; locked art stays solid black, with no
visible name or color image before a reveal. Maintain the same purchase,
confirmation, price, odds and keyboard/reduced-motion behavior.

### Series 01: field dossier and album

Owners open one dossier at a time using a real button on a card. The reverse
uses an ink archive grid, original spoiler-free notes and existing roster
numbers; it is absent, not merely hidden, on unowned cards. One short glint
emphasizes existing rarity labels. Reduced motion swaps the sides instantly.
The compact 18-slot album links to the matching card, revealing its grid slot
if a filter hides it. Neither inspection nor album navigation uses the network
to mutate ownership, coins or progress.

### Collection worlds

Four shelves (Ghoul, Jujutsu, Frieren, Alchemist) share the same ownership rules
but use burgundy ink, violet seals, warm parchment and brass-blue respectively.
Use full-body art only when inspecting an owned card. The native viewer places
the full illustration left and a compact spoiler-free dossier right. At phone
width they stack; Escape closes and restores focus. A pull uses one short,
non-flashing motif specific to the character, stopped entirely by reduced
motion. Keep new booster storage separate and always use the existing wallet.

### Cel-art expansion

Keep outlines dark and expressive, with flat two-tone cel shadows and no
photographic smudging or synthetic bloom. Each character gets a distinctive
pose and faithful silhouette. The card print crops closer than the archival
full-body viewer. The three newer shelves each carry ten characters; the
original eighteen and their collection identifiers do not change.

### Collector interaction

A trusted purchase produces the card before any visual step. The peel stage is
a regular button with an optional horizontal gesture and a dedicated skip.
Result silhouettes open a two-panel manga strip, then the color detail and
series motif appear briefly once. Reduced motion skips these decorations.
Search matches names only for owned cards; rarity is available for locked
slots without exposing identities. The profile showcase is off by default and
publishes only an owner's three intentionally saved, server-verified card picks
to visitors able to see that profile. No inventory, transaction or wallet
metadata is part of the showcase.

### Collector deluxe

Each world uses a distinct physical wrapper and manga paper treatment. Twelve
selected hero assets were replaced after comparative review, not the existing
ownership IDs. Arcs and completion stamps are informational; the final slot
shows a quiet recap and does not add further card rewards. Private opening
history reads server timestamps and can repeat the scene without a purchase.
A completed series can optionally supply an authored profile background
without deleting the existing custom banner. A manually requested poster
includes only game artwork, character name, series, rarity and catalogue code.

### Collector navigation
The Collections tab owns the series albums, silhouettes, filters and journal. Packs owns the pack shelf and checkout; only the opening or its result may show a character on that tab. Both use the same active series; switching tabs never starts a purchase. Journal replays return to the album.
