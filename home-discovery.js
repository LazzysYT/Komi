/* Komi Home Discovery.
 * Presentation only: receives existing catalog, progress and handlers.
 * No new client-side database reads or writes.
 */
(function (root) {
  'use strict';
  const escape = value => String(value == null ? '' : value).replace(/[&<>"']/g, ch => (
    {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]
  ));
  function rating(anime) {
    const raw = anime && anime.shikiRating;
    const score = Number(raw);
    if (Number.isFinite(score) && score > 0) return score.toFixed(1);
    // Preserve supplied text as plain, escaped text (never as HTML).
    return typeof raw === 'string' && raw.trim() ? raw.trim().slice(0, 80) : '—';
  }
  function score(anime) { return Number(anime && anime.shikiRating) || 0; }
  function count(anime) {
    return Math.max(0, Number(anime && anime.episodeCount) ||
      (Array.isArray(anime && anime.episodes) ? anime.episodes.length : 0));
  }
  function updated(anime) {
    const time = Date.parse(anime && anime.lastEpisodeAddedAt);
    return Number.isFinite(time) ? time : 0;
  }
  function id(anime) {
    const value = String(anime && anime.id || '');
    return /^[1-9][0-9]{0,14}$/.test(value) ? value : '';
  }
  function collectionAction(kind) {
    return 'data-komi-onclick="openKomiCollection(\'' + kind + '\')"';
  }
  function shelf(title, subtitle, list, kind, renderCard, classname) {
    if (!list.length) return '';
    // On small screens each shelf is a preview; keep the full collection via
    // the existing 'Смотреть все' action. This cuts DOM and poster requests.
    const compact = typeof root.matchMedia === 'function' &&
      root.matchMedia('(max-width: 767px)').matches;
    const visible = compact ? list.slice(0, 7) : list;
    return '<section class="komi-home-shelf komi-feature-section ' + (classname || '') + '">' +
      '<div class="komi-home-heading"><div><h2>' + escape(title) + '</h2>' +
      '<p class="komi-home-subtitle">' + escape(subtitle) + '</p></div>' +
      '<button type="button" class="komi-home-all" ' + collectionAction(kind) +
      '>Открыть каталог</button></div>' +
      '<div class="komi-home-rail komi-home-rail-pending" aria-busy="true"><template data-komi-lazy-shelf>' + visible.map(renderCard).join('') + '</template></div></section>';
  }
  const genreOptions = [
    {name:'Экшен',subtitle:'Драки и погони',symbol:'↗',choices:['Экшен']},
    {name:'Романтика',subtitle:'Про любовь',symbol:'♡',choices:['Романтика']},
    {name:'Фэнтези',subtitle:'Магия и миры',symbol:'✧',choices:['Фэнтези']},
    {name:'Комедия',subtitle:'Посмеяться',symbol:'☺',choices:['Комедия']},
    {name:'Исэкай',subtitle:'Попал в другой мир',symbol:'◇',choices:['Исэкай','Исекай']},
    {name:'Детектив',subtitle:'Распутать дело',symbol:'⌕',choices:['Детектив']},
    {name:'Повседневность',subtitle:'Уютно и спокойно',symbol:'☼',choices:['Повседневность']}
  ];
  function genreShelf(animeList) {
    const genres = new Set();
    for (const anime of animeList) for (const genre of Array.isArray(anime.genres) ? anime.genres : [])
      genres.add(String(genre));
    return '<section class="komi-home-genres komi-feature-section" aria-label="Выбор жанра">' +
      '<div class="komi-home-heading"><div><h2>Жанры <span class="komi-home-kicker">/ настроение</span></h2>' +
      '<p class="komi-home-subtitle">Выбери настроение на вечер</p></div></div>' +
      '<div class="komi-home-genre-rail">' + genreOptions.map(option => {
        const genre = option.choices.find(name => genres.has(name));
        return '<button type="button" class="komi-home-genre-card"' +
          (genre ? ' data-komi-genre="' + escape(genre) + '"' :
            ' disabled title="Тайтлов в этой категории пока нет"') +
          '><span class="komi-home-genre-symbol" aria-hidden="true">' + option.symbol + '</span>' +
          '<span class="komi-home-genre-name">' + escape(option.name) + '</span>' +
          '<span class="komi-home-genre-caption">' + escape(option.subtitle) + '</span></button>';
      }).join('') + '</div></section>';
  }
  function heroChevron(direction) {
    const path = direction === 'left' ? 'm15 18-6-6 6-6' : 'm9 18 6-6-6-6';
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="' + path + '"></path></svg>';
  }
  function artworkImage(anime, context, loading, className = '', deferHero = false, heroSource = '') {
    const source = anime.banner || anime.poster;
    const directSource = className === 'komi-hub-hero-art' && typeof source === 'string'
      ? source.replace(/(https:\/\/shikimori\.(?:io|one)\/system\/animes\/)preview(\/[1-9]\d*\.jpe?g(?:\?\d+)?)/i, '$1original$2')
      : source;
    const direct = typeof directSource === 'string' && /^https:\/\//i.test(directSource)
      ? ' data-poster-direct="' + escape(directSource) + '"' : '';
    const actualSrc = heroSource || context.artwork(anime);
    const deferred = className === 'komi-hub-hero-art' && deferHero;
    return '<img class="' + className + '" src="' + (deferred ? '/anime-artwork.svg' : escape(actualSrc)) +
      '" alt="" loading="' + loading + '" decoding="async" referrerpolicy="no-referrer"' +
      (deferred ? ' data-komi-hero-deferred-src="' + escape(actualSrc) + '"' : '') +
      (className === 'komi-hub-hero-art' && loading === 'eager' ? ' fetchpriority="high"' : '') + direct +
      ' data-komi-onerror="komiCardPosterFallback(this)">';
  }

  function heroLogo(anime) {
    const url = anime && (anime.logo_url || anime.logoUrl);
    return typeof url === 'string' && /^https:\/\/[^\s"'<>]+$/i.test(url) ? url : '';
  }
  function heroArtwork(anime) {
    const dailyArt = root.KomiHeroDaily?.artwork(id(anime));
    if (dailyArt) return {banner:dailyArt,wide:true,daily:true};
    const valid = url => typeof url === 'string' && /^https:\/\/[^\s"'<>]+$/i.test(url);
    const custom = [anime.banner_url, anime.bannerUrl].find(valid);
    // Public cards omit hero metadata. Reuse the verified seed banner for this
    // exact ID/cover through hydration, without changing catalog posters or
    // overriding a different live cover or legacy custom banner.
    const seed = Array.isArray(root.KomiHomeSeed)
      ? root.KomiHomeSeed.find(item => id(item) === id(anime)) : null;
    const seeded = seed && anime.poster === seed.poster &&
      (anime.banner || anime.poster) === (seed.banner || seed.poster) && valid(seed.banner_url)
      ? seed.banner_url : '';
    const banner = custom || seeded;
    // Only the checked seed asset has known landscape dimensions before load.
    return {banner, wide:Boolean(seeded && banner === seeded)};
  }
  function hero(slides, context) {
    if (!slides.length) return '';
    // The brand promotion belongs only to this presentation sequence, never to
    // the anime catalog or the public catalog snapshot.
    const slideCount = slides.length + 1;
    const index = ((Number(context.currentSlideIndex) || 0) % slideCount + slideCount) % slideCount;
    const total = String(slideCount).padStart(2, '0');
    const promoActive = index === slides.length;
    const promoPoster = '/assets/hero/komi-promo-first-frame.webp';
    const playSvg = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.8a1 1 0 0 1 1.5-.86l11 7.2a1 1 0 0 1 0 1.72l-11 7.2A1 1 0 0 1 7 19.2V4.8Z"/></svg>';
    const bookmarkSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21l-6-4-6 4V4.5Z"/></svg>';

    return '<section class="komi-home-hero" aria-label="Рекомендуем посмотреть">' +
      '<div class="hero-slider-container" id="heroSlider" role="group" aria-roledescription="карусель" aria-label="Подборка KomiAnime">' +
      '<div class="hero-slides-wrapper">' + slides.map((anime, i) => {
        const animeId = id(anime);
        // Shikimori IDs match MAL IDs; internal routes always use Komi's own ID.
        const malId = String(anime.shikimoriId || anime.idMal || anime.malId || animeId);
        const {banner, wide, daily} = heroArtwork(anime);
        const video = [anime.banner_video_url, anime.bannerVideoUrl, anime.bannerVideo].find(url => typeof url === 'string' && /^https:\/\/[^\s]+\.(?:mp4|webm)(?:\?[^\s]*)?$/i.test(url));
        const still = Array.isArray(anime.screenshots)
          ? anime.screenshots.find(url => typeof url === 'string' && /^https:\/\//i.test(url)) : '';
        const year = context.year(anime);
        const description = root.KomiDescription?.excerpt(anime.desc) || '';
        const logo = i === index ? heroLogo(anime) : '';
        const saved = Boolean(animeId && context.currentUser?.authUserId && context.statuses?.[animeId]);
        const route = '/anime/' + animeId;
        const active = i === index;
        return '<article class="' + (wide ? 'hero-slide komi-hd-wide' : 'hero-slide komi-hd-poster') +
          (active ? ' active' : '') + '"' +
          ' data-komi-anime-id="' + escape(malId) + '"' +
          ' data-komi-hero-saved="' + (saved ? 'true' : 'false') + '"' +
          (banner ? ' data-komi-hero-banner="' + escape(banner) + '"' : '') +
          (daily ? ' data-komi-daily-art="true"' : '') +
          (video ? ' data-komi-hero-video="' + escape(video) + '"' : '') +
          (still ? ' data-komi-hero-still="' + escape(still) + '"' : '') +
          ' aria-hidden="' + (active ? 'false' : 'true') + '"' +
          (active ? '' : ' inert') +
          ' aria-label="' + escape(anime.title) + '">' +
          artworkImage(anime, context, active ? 'eager' : 'lazy', 'komi-hub-hero-art', !active, banner) +
          '<div class="komi-home-hero-content">' +
          '<div class="komi-hub-title-wrap' + (logo ? ' has-logo' : '') + '">' +
          (logo ? '<img class="komi-hub-title-logo" src="' + escape(logo) +
            '" alt="" decoding="async" referrerpolicy="no-referrer">' : '') +
          '<h1 class="komi-hub-title-text">' + escape(anime.title) + '</h1></div>' +
          '<div class="hero-meta"><span>★ ' + escape(rating(anime)) + '</span>' +
          (year ? ' · <span>' + escape(year) + '</span>' : '') + '</div>' +
          '<p class="komi-hub-description"' + (description ? '' : ' hidden') + '>' + escape(description) + '</p>' +
          '<div class="hero-buttons">' +
          '<a class="komi-hub-play" href="' + route + '#player">' + playSvg + '<span>Смотреть</span></a>' +
          '<button type="button" class="komi-hub-list" aria-pressed="' + (saved ? 'true' : 'false') + '"' +
          ' data-komi-onclick="toggleHeroAnimeList(\'' + animeId + '\')">' +
          bookmarkSvg + '<span class="komi-hub-list-label">' + (saved ? '✓ В списке' : 'В список') + '</span></button>' +
          '</div></div></article>';
      }).join('') +
      '<article class="hero-slide komi-hd-wide' + (promoActive ? ' active' : '') + '"' +
      ' data-komi-promo="brand-loop" data-komi-hero-banner="' + promoPoster + '"' +
      ' data-komi-hero-video="/assets/hero/komi-promo-loop.mp4"' +
      ' aria-hidden="' + (promoActive ? 'false' : 'true') + '"' + (promoActive ? '' : ' inert') +
      ' aria-label="KomiAnime — выбери свою историю">' +
      '<img class="komi-hub-hero-art" src="' + (promoActive ? promoPoster : '/anime-artwork.svg') + '"' +
      ' alt="" width="1280" height="720" loading="' + (promoActive ? 'eager' : 'lazy') + '" decoding="async"' +
      (promoActive ? ' fetchpriority="high"' : ' data-komi-hero-deferred-src="' + promoPoster + '"') + '>' +
      '<div class="komi-home-hero-content">' +
      '<div class="komi-hub-title-wrap"><h1 class="komi-hub-title-text">Выбери свою<br>историю.</h1></div>' +
      '<div class="hero-meta"><span>KomiAnime</span> · <span>Без звука</span></div>' +
      '<p class="komi-hub-description">Найди аниме на вечер — и продолжи с того места, где остановился.</p>' +
      '<div class="hero-buttons"><a class="komi-hub-play" href="/catalog"><span>Открыть каталог</span>' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>' +
      '</a></div></div></article></div>' +
      '<div class="komi-hub-carousel-controls" aria-label="Управление слайдером">' +
      '<span class="komi-hub-slide-count"><strong data-komi-slide-current>' +
      String(index + 1).padStart(2, '0') + '</strong><span>/ ' + total + '</span></span>' +
      (slideCount > 1 ? '<div class="hero-dots" role="group" aria-label="Выбор слайда">' +
        Array.from({length:slideCount}, (_, i) =>
          '<button type="button" class="hero-dot' + (i === index ? ' active' : '') +
          '" aria-label="Показать слайд ' + (i + 1) + '" aria-pressed="' +
          (i === index ? 'true' : 'false') + '" data-komi-onclick="setSlide(' + i + ')"></button>'
        ).join('') + '</div>' : '') +
      '<div class="komi-hub-arrows">' +
      '<button type="button" class="komi-hero-pause" data-komi-hero-toggle aria-label="Приостановить слайдер" aria-pressed="false" title="Приостановить слайдер">' +
        '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path data-komi-hero-pause-icon d="M6 5h4v14H6zM14 5h4v14h-4z"/><path data-komi-hero-play-icon hidden d="M8 5v14l11-7z"/></svg></button>' +
      (slideCount > 1 ? '<button type="button" class="hero-slider-arrow hero-arrow-prev" aria-label="Предыдущий слайд" data-komi-onclick="changeSlide(-1)">' + heroChevron('left') + '</button>' +
        '<button type="button" class="hero-slider-arrow hero-arrow-next" aria-label="Следующий слайд" data-komi-onclick="changeSlide(1)">' + heroChevron('right') + '</button>' : '') + '</div>' +
      '</div></div></section>';
  }

  function unfinished(progress) {
    const time = Number(progress?.time), duration = Number(progress?.duration);
    const index = Number(progress?.index), season = Number(progress?.season);
    return Number.isFinite(time) && time > 0 && Number.isFinite(Number(progress?.updated)) &&
      Number.isSafeInteger(index) && index >= 0 && Number.isSafeInteger(season) && season > 0 &&
      (!Number.isFinite(duration) || duration <= 0 || time < duration - 5);
  }
  function recentProgress(context, animeList) {
    if (!context.currentUser?.authUserId) return [];
    // During initial hydration the 150-card public preview cannot resolve the
    // owner's whole watch list. Show only the last COMPLETE verified snapshot,
    // never a misleading partial row which reorders a moment later.
    if (!context.resumeReady)
      return Array.isArray(context.resumePreview)
        ? context.resumePreview.filter(item => id(item?.anime) && unfinished(item?.p)).slice(0, 8) : [];
    const prefix = context.currentUser.username + '_';
    const lookup = new Map(animeList.map(anime => [String(anime.id), anime]));
    return Object.entries(context.progress || {})
      .filter(([key, progress]) => key.startsWith(prefix) && unfinished(progress))
      .sort((a, b) => Number(b[1].updated) - Number(a[1].updated)).slice(0, 16)
      .map(([key, p]) => ({anime: lookup.get(key.slice(prefix.length)), p}))
      .filter(({anime}) => id(anime)).slice(0, 8);
  }

  function progressEpisode(anime, progress) {
    const season = Number(progress.season) || 1;
    const slot = Number(progress.index);
    const episodes = Array.isArray(anime.episodes) ? anime.episodes : [];
    const grouped = root.KomiPlayerCore?.seasonEpisodes(episodes, season) || [];
    const episode = grouped.find(item => item.slots.includes(slot));
    return {season, number: Number(episode?.number) || slot + 1, episode};
  }

  function elapsedTime(value) {
    const position = Number(value);
    const seconds = Number.isFinite(position) ? Math.max(0, Math.floor(position)) : 0;
    const minutes = Math.floor(seconds / 60);
    const remainder = String(seconds % 60).padStart(2, '0');
    return minutes + ':' + remainder;
  }

  function continueShelf(recent, context) {
    if (!recent.length) return '';
    return '<section class="komi-home-shelf komi-home-continue komi-feature-section">' +
      '<div class="komi-home-heading"><h2>Продолжить просмотр</h2></div>' +
      '<div class="komi-home-progress-rail">' + recent.map(({anime, p}, index) => {
        const position = Number(p.time);
        const duration = Number(p.duration);
        const percent = Number.isFinite(position) && Number.isFinite(duration) && duration > 0
          ? Math.min(100, Math.max(0, position / duration * 100)) : 0;
        const {season, number, episode} = progressEpisode(anime, p);
        const preview = [episode?.preview, episode?.thumbnail, episode?.screenshot, anime.screenshots?.[0]]
          .find(url => typeof url === 'string' && /^https:\/\//i.test(url));
        return '<button type="button" class="komi-home-progress-card" data-komi-onclick="resumeKomiAnime(\'' + id(anime) + '\')">' +
          '<span class="komi-home-progress-art">' + artworkImage(preview ? {banner: preview} : anime, context, index < 3 ? 'eager' : 'lazy') +
          '<span class="komi-home-progress-track" aria-hidden="true"><span style="width:' + percent.toFixed(2) + '%"></span></span></span>' +
          '<span class="komi-home-progress-details"><strong>' + escape(anime.title) + '</strong>' +
          '<small>Сезон ' + season + ' · Серия ' + number + ' · ' + elapsedTime(position) +
          '</small></span></button>';
      }).join('') + '</div></section>';
  }

  // Public recommendations reuse the loaded catalog. No view counts are implied.
  let cachedPublicHome = null;
  function render(context) {
    const source = Array.isArray(context.animeList) ? context.animeList : [];
    const animeList = source.filter(Boolean);
    if (!animeList.length) return '<section class="komi-home-empty">Аниме в каталоге пока нет.</section>';
    const daily = root.KomiHeroDaily?.lineup(animeList, Array.isArray(root.KomiHomeSeed) ? root.KomiHomeSeed : []);
    const usesDaily = daily?.length >= 2;
    const revision = Number(context.catalogRevision) || 0;
    if (!cachedPublicHome || cachedPublicHome.source !== source ||
        cachedPublicHome.revision !== revision || cachedPublicHome.length !== source.length) {
      const now = Date.now(), recentThreshold = now - 30 * 86400000;
      // Recommendation ranking needs only rating and freshness; avoid
      // extracting fallback-hero fields for the full catalog on daily renders.
      const metadata = animeList.map(anime => ({
        anime, score:score(anime), updated:updated(anime)
      }));
      const popularity = item => (item.updated > recentThreshold && item.updated <= now ? 2 : 0) + item.score / 10;
      const popular = metadata.filter(item => item.score > 0 && id(item.anime))
        .sort((a,b) => popularity(b) - popularity(a) || b.score - a.score)
        .slice(0,12).map(item => item.anime);
      cachedPublicHome = {source, revision, length:source.length, slider:null, popular};
    }
    // The daily lineup already selects the hero. Sort the full catalog only
    // when that lineup is unavailable, including after an earlier daily render.
    if (!usesDaily && cachedPublicHome.slider === null) {
      cachedPublicHome.slider = typeof root.KomiHomeSnapshot?.featured === 'function'
        ? root.KomiHomeSnapshot.featured(animeList, context.year)
        : animeList.map(anime => ({
            anime, score:score(anime), year:context.year(anime), count:count(anime)
          })).filter(item => /^https:\/\//i.test(item.anime.poster || '') && item.score >= 7 && item.count > 0)
          .sort((a,b) => Number(b.year) - Number(a.year) || b.score - a.score)
          .slice(0,5).map(item => item.anime);
    }
    const {slider, popular} = cachedPublicHome;
    const lineup = usesDaily ? daily : slider;
    const history = recentProgress(context, animeList);
    const genres = typeof context.genres === 'function' ? context.genres() : genreShelf(animeList);
    return '<div class="komi-home-discovery komi-home-storefront">' +
      hero(lineup, context) +
      continueShelf(history, context) +
      shelf('Рекомендуем', 'По оценкам Shikimori и свежести обновлений', popular, 'all',
        anime => context.renderCard(anime, {variant:'discovery'}), 'komi-home-popular') +
      '<div class="komi-home-genres-section komi-feature-section">' + genres + '</div>' +
      (root.KomiHomeReleases?.renderRecent(context) || '') +
      (root.KomiHomeReleases?.renderUpcoming(context) || '') +
      '<footer class="komi-home-browse-footer"><a class="komi-home-catalog-link" href="/catalog">Весь каталог</a>' +
      '<nav class="komi-home-support-links" aria-label="Дополнительные разделы Komi">' +
      '<a href="/partners">Партнёры</a>' +
      '<a href="https://www.tiktok.com/@komi_animeofficial" target="_blank" rel="noopener noreferrer">TikTok</a>' +
      '<a href="https://t.me/+X9yUQPEBldo2MzNi" target="_blank" rel="noopener noreferrer">Telegram</a></nav></footer>' +
      '</div>';
  }
  // Keep equal sections mounted through catalog/session refreshes. Parsing into
  // a template is inert; images and observers only start for genuinely new DOM.
  const sectionMarkup = new WeakMap();
  function adoptBootHero(container, renderedHero, markup, owner) {
    const current = container.querySelector(':scope > .komi-home-discovery');
    const existing = current?.querySelector('.komi-home-hero');
    if (!existing || !renderedHero || existing !== root.KomiHeroDaily?.preview) return false;
    const before = [...existing.querySelectorAll('.hero-slide')];
    const after = [...renderedHero.querySelectorAll('.hero-slide')];
    const identity = slide => slide.dataset.komiAnimeId || slide.dataset.komiPromo;
    if (before.length !== after.length || before.some((slide, index) => identity(slide) !== identity(after[index]))) return false;
    const activeIndex = before.findIndex(slide=>slide.classList.contains('active'));
    if (activeIndex < 0 || !after[activeIndex].classList.contains('active')) return false;
    const activeImage = before[activeIndex].querySelector('.komi-hub-hero-art');
    const expected = after[activeIndex].querySelector('.komi-hub-hero-art')?.getAttribute('src');
    if (!activeImage || activeImage.getAttribute('src') !== expected || !root.KomiHeroDaily.imageIsReal(activeImage)) return false;
    // patch() keys parsed sections by browser serialization (for example,
    // inert becomes inert=""). Register the same representation before moving
    // the canonical content, rather than the renderer's raw HTML string.
    const canonicalMarkup = renderedHero.outerHTML;
    // Upgrade text and account actions in place: moving the decoded artwork
    // into a new section would create a second, late largest-contentful paint.
    const focused = existing.contains(document.activeElement) ? document.activeElement : null;
    const focusedHref = focused?.closest('a')?.getAttribute('href');
    const focusedAction = focused?.closest('button')?.getAttribute('data-komi-onclick');
    const attributes = (target, source, preserve = []) => {
      for (const attribute of [...target.attributes])
        if (!preserve.includes(attribute.name) && !source.hasAttribute(attribute.name)) target.removeAttribute(attribute.name);
      for (const attribute of source.attributes)
        if (!preserve.includes(attribute.name) && target.getAttribute(attribute.name) !== attribute.value)
          target.setAttribute(attribute.name, attribute.value);
    };
    before.forEach((slide, index) => {
      const next = after[index];
      const image = slide.querySelector('.komi-hub-hero-art');
      const ready = image && root.KomiHeroDaily.imageIsReal(image);
      attributes(slide, next);
      if (ready) slide.classList.add('komi-art-ready');
      const content = slide.querySelector('.komi-home-hero-content');
      const nextContent = next.querySelector('.komi-home-hero-content');
      if (content && nextContent) content.replaceWith(nextContent);
      const nextImage = next.querySelector('.komi-hub-hero-art');
      if (image && nextImage) attributes(image, nextImage,
        ready ? ['src','loading','fetchpriority','data-komi-hero-deferred-src'] : []);
    });
    const controls = existing.querySelector('.komi-hub-carousel-controls');
    const nextControls = renderedHero.querySelector('.komi-hub-carousel-controls');
    // Once live, keep the carousel's direct event bindings and pause clock too.
    if (current.hasAttribute('data-komi-boot-preview') && controls && nextControls)
      controls.replaceWith(nextControls);
    existing.dataset.komiOwner = owner;
    current.dataset.komiHomeOwner = owner;
    delete current.dataset.komiBootPreview;
    sectionMarkup.set(existing, canonicalMarkup);
    if (focusedHref) [...existing.querySelectorAll('a')]
      .find(link => link.getAttribute('href') === focusedHref)?.focus({preventScroll:true});
    else if (focusedAction && !focused?.isConnected) [...existing.querySelectorAll('button[data-komi-onclick]')]
      .find(button => button.getAttribute('data-komi-onclick') === focusedAction)?.focus({preventScroll:true});
    return true;
  }
  function patch(container, markup, owner) {
    const template = document.createElement('template');
    template.innerHTML = markup;
    const next = template.content.firstElementChild;
    const current = container.querySelector(':scope > .komi-home-discovery');
    if (!next || !next.classList.contains('komi-home-discovery')) {
      container.innerHTML = markup;
      return;
    }
    const prepared = Array.from(next.children, node => ({node,html:node.outerHTML}));
    if (!current || current.dataset.komiHomeOwner !== owner) {
      next.dataset.komiHomeOwner = owner;
      for (const item of prepared) sectionMarkup.set(item.node,item.html);
      container.replaceChildren(next);
      return;
    }
    const available = new Map();
    for (const node of current.children) {
      const html = sectionMarkup.get(node);
      if (!html) continue;
      if (!available.has(html)) available.set(html,[]);
      available.get(html).push(node);
    }
    const desired = prepared.map(item => {
      const existing = available.get(item.html)?.shift();
      const node = existing || item.node;
      sectionMarkup.set(node,item.html);
      return node;
    });
    const keep = new Set(desired);
    for (let index=0;index<desired.length;index++) {
      const node=desired[index];
      const at=current.children[index]||null;
      if (node!==at) current.insertBefore(node,at);
    }
    for (const node of [...current.children]) {
      if (keep.has(node)) continue;
      node.remove();
    }
  }
  function retainSection(next, existing) {
    if (!next || !existing || next === existing) return;
    const html = sectionMarkup.get(next);
    if (html) sectionMarkup.set(existing,html);
    next.replaceWith(existing);
  }
  // Explicit viewport loading avoids Chromium's large native lazy-image
  // lookahead competing with the hero for mobile bandwidth.
  let viewportObserver = null;
  const pendingViewport = new Set();
  function activate(node) {
    if (node.matches('.komi-home-rail-pending')) {
      const template = node.querySelector('template[data-komi-lazy-shelf]');
      if (template) { node.append(template.content); template.remove(); }
      node.classList.remove('komi-home-rail-pending');
      node.removeAttribute('aria-busy');
      // The rail is already approaching the viewport. Start the first two
      // card covers now instead of waiting for a second observer delivery.
      // The rest still load only as they approach the visible shelf.
      const firstPosters = [...node.querySelectorAll('.komi-discovery-poster img[data-komi-lazy-src]')].slice(0,2);
      firstPosters.forEach(activate);
      observeViewport(node);
    } else if (node.matches('img[data-komi-lazy-src]')) {
      const source=node.dataset.komiLazySrc;
      delete node.dataset.komiLazySrc;
      if (source) {node.loading='eager';node.src=source;}
    }
  }
  function forgetViewport(node) {
    pendingViewport.delete(node);
    viewportObserver?.unobserve(node);
  }
  function observeViewport(container) {
    for (const node of pendingViewport) if (!node.isConnected) forgetViewport(node);
    if (typeof IntersectionObserver === 'function' && !viewportObserver) {
      viewportObserver=new IntersectionObserver(entries=>{
        for (const entry of entries) {
          if (!entry.target.isConnected) {forgetViewport(entry.target);continue;}
          if (entry.isIntersecting) {forgetViewport(entry.target);activate(entry.target);}
        }
      },{rootMargin:'200px 100px'});
    }
    for (const node of container.querySelectorAll('.komi-home-rail-pending,img[data-komi-lazy-src]')) {
      if (pendingViewport.has(node)) continue;
      if (!viewportObserver) activate(node);
      else {pendingViewport.add(node);viewportObserver.observe(node);}
    }
  }
  if (typeof root.addEventListener === 'function') root.addEventListener('beforeprint',()=>{
    const home=document.querySelector('.komi-home-discovery');
    if (home) for (const rail of home.querySelectorAll('.komi-home-rail-pending')) {forgetViewport(rail);activate(rail);}
    if (home) for (const img of home.querySelectorAll('img[data-komi-lazy-src]')) {forgetViewport(img);activate(img);}
  });
  function afterRender(container) {
    observeViewport(container);
  }
  root.KomiHomeDiscovery = {render,patch,adoptBootHero,retainSection,afterRender,observeViewport,recentProgress,unfinished};
})(globalThis);
