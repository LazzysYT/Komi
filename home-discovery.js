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
      '>Смотреть все <span aria-hidden="true">↗</span></button></div>' +
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

  function heroReleaseStatus(anime) {
    const raw = anime && (anime.releaseStatus || anime.status || anime.animeStatus);
    if (typeof raw !== 'string' || !raw.trim()) return '';
    const value = raw.trim();
    const aliases = {
      ongoing: 'Онгоинг', releasing: 'Онгоинг', anons: 'Анонс',
      announced: 'Анонс', released: 'Завершено', finished: 'Завершено'
    };
    return aliases[value.toLowerCase()] || value.slice(0, 40);
  }
  function heroLogo(anime) {
    const url = anime && (anime.logo_url || anime.logoUrl);
    return typeof url === 'string' && /^https:\/\/[^\s"'<>]+$/i.test(url) ? url : '';
  }
  function heroArtwork(anime) {
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
    const index = ((Number(context.currentSlideIndex) || 0) % slides.length + slides.length) % slides.length;
    const total = String(slides.length).padStart(2, '0');
    const playSvg = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.8a1 1 0 0 1 1.5-.86l11 7.2a1 1 0 0 1 0 1.72l-11 7.2A1 1 0 0 1 7 19.2V4.8Z"/></svg>';
    const bookmarkSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21l-6-4-6 4V4.5Z"/></svg>';
    const infoSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.5h.01"/></svg>';

    return '<section class="komi-home-hero" aria-label="Рекомендуем посмотреть">' +
      '<div class="hero-slider-container" id="heroSlider" role="group" aria-roledescription="карусель" aria-label="Подборка аниме">' +
      '<div class="hero-slides-wrapper">' + slides.map((anime, i) => {
        const animeId = id(anime);
        // Shikimori IDs match MAL IDs; internal routes always use Komi's own ID.
        const malId = String(anime.shikimoriId || anime.idMal || anime.malId || animeId);
        const {banner, wide} = heroArtwork(anime);
        const video = [anime.banner_video_url, anime.bannerVideoUrl, anime.bannerVideo].find(url => typeof url === 'string' && /^https:\/\/[^\s]+\.(?:mp4|webm)(?:\?[^\s]*)?$/i.test(url));
        const still = Array.isArray(anime.screenshots)
          ? anime.screenshots.find(url => typeof url === 'string' && /^https:\/\//i.test(url)) : '';
        const year = context.year(anime);
        const description = context.describe(anime.desc);
        const animeType = context.type(anime);
        const releaseStatus = heroReleaseStatus(anime);
        const episodes = count(anime);
        const genres = (Array.isArray(anime.genres) ? anime.genres : [anime.genre])
          .filter(value => typeof value === 'string' && value.trim()).slice(0, 4);
        const logo = i === index ? heroLogo(anime) : '';
        const saved = Boolean(animeId && context.currentUser?.authUserId && context.statuses?.[animeId]);
        const route = '/anime/' + animeId;
        const active = i === index;
        return '<article class="' + (wide ? 'hero-slide komi-hd-wide' : 'hero-slide komi-hd-poster') +
          (active ? ' active' : '') + '"' +
          ' data-komi-anime-id="' + escape(malId) + '"' +
          ' data-komi-hero-saved="' + (saved ? 'true' : 'false') + '"' +
          (banner ? ' data-komi-hero-banner="' + escape(banner) + '"' : '') +
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
          (animeType ? '<span>' + escape(animeType) + '</span>' : '') +
          (year ? '<span>' + escape(year) + '</span>' : '') +
          (episodes ? '<span>' + episodes + ' эп.</span>' : '') +
          (releaseStatus ? '<span>' + escape(releaseStatus) + '</span>' : '') + '</div>' +
          (genres.length ? '<div class="komi-hub-genres">' + genres.map(escape).join(' · ') + '</div>' : '') +
          (description ? '<p class="komi-hub-description">' + escape(description) + '</p>' : '') +
          '<div class="hero-buttons">' +
          '<a class="komi-hub-play" href="' + route + '#player">' + playSvg + '<span>Смотреть</span></a>' +
          '<button type="button" class="komi-hub-list" aria-pressed="' + (saved ? 'true' : 'false') + '"' +
          ' data-komi-onclick="toggleHeroAnimeList(\'' + animeId + '\')">' +
          bookmarkSvg + '<span class="komi-hub-list-label">' + (saved ? '✓ В списке' : 'В список') + '</span></button>' +
          '<a class="komi-hub-info" href="' + route + '" aria-label="Подробнее: ' + escape(anime.title) + '" title="Подробнее">' +
          infoSvg + '</a></div></div></article>';
      }).join('') + '</div>' +
      '<div class="komi-hub-carousel-controls" aria-label="Управление слайдером">' +
      '<span class="komi-hub-slide-count"><strong data-komi-slide-current>' +
      String(index + 1).padStart(2, '0') + '</strong><span>/ ' + total + '</span></span>' +
      (slides.length > 1 ? '<div class="hero-dots" role="group" aria-label="Выбор слайда">' +
        slides.map((_, i) =>
          '<button type="button" class="hero-dot' + (i === index ? ' active' : '') +
          '" aria-label="Показать тайтл ' + (i + 1) + '" aria-pressed="' +
          (i === index ? 'true' : 'false') + '" data-komi-onclick="setSlide(' + i + ')"></button>'
        ).join('') + '</div>' : '') +
      '<div class="komi-hub-arrows">' +
      '<button type="button" class="komi-hero-pause" data-komi-hero-toggle aria-label="Приостановить слайдер" aria-pressed="false" title="Приостановить слайдер">' +
        '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path data-komi-hero-pause-icon d="M6 5h4v14H6zM14 5h4v14h-4z"/><path data-komi-hero-play-icon hidden d="M8 5v14l11-7z"/></svg></button>' +
      (slides.length > 1 ? '<button type="button" class="hero-slider-arrow hero-arrow-prev" aria-label="Предыдущий тайтл" data-komi-onclick="changeSlide(-1)">' + heroChevron('left') + '</button>' +
        '<button type="button" class="hero-slider-arrow hero-arrow-next" aria-label="Следующий тайтл" data-komi-onclick="changeSlide(1)">' + heroChevron('right') + '</button>' : '') + '</div>' +
      '</div></div></section>';
  }

  function recentProgress(context, animeList) {
    if (!context.currentUser?.authUserId) return [];
    // During initial hydration the 150-card public preview cannot resolve the
    // owner's whole watch list. Show only the last COMPLETE verified snapshot,
    // never a misleading partial row which reorders a moment later.
    if (!context.resumeReady)
      return Array.isArray(context.resumePreview) ? context.resumePreview.slice(0, 8) : [];
    const prefix = context.currentUser.username + '_';
    const lookup = new Map(animeList.map(anime => [String(anime.id), anime]));
    return Object.entries(context.progress || {})
      .filter(([key, progress]) => key.startsWith(prefix) && progress && Number.isFinite(Number(progress.updated)))
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

  function resumeCapsule(item, context) {
    if (!item) return '';
    const {anime, p} = item;
    const {number} = progressEpisode(anime, p);
    return '<button type="button" class="komi-hub-resume" data-komi-onclick="resumeKomiAnime(\'' + id(anime) + '\')">' +
      artworkImage({poster: anime.poster || anime.banner}, context, 'eager') +
      '<span class="komi-hub-resume-copy"><small>Продолжить просмотр</small>' +
      '<strong>' + escape(anime.title) + '</strong><small>Серия ' + number + '</small></span>' +
      '<span class="komi-hub-resume-play" aria-hidden="true">▶</span></button>';
  }

  function continueShelf(recent, context) {
    if (!recent.length) {
      if (!context.currentUser?.authUserId || context.resumeReady) return '';
      // Same geometry as real cards; placeholders avoid an empty-to-full shift.
      return '<section class="komi-home-shelf komi-home-continue komi-feature-section komi-resume-loading" aria-busy="true">' +
        '<div class="komi-home-heading"><h2>Продолжить просмотр</h2></div>' +
        '<div class="komi-home-progress-rail">' +
        ('<div class="komi-home-progress-card komi-resume-placeholder" aria-hidden="true">' +
        '<span class="komi-home-progress-art"></span><span class="komi-home-progress-details"></span></div>').repeat(6) +
        '</div></section>';
    }
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
          '<span class="komi-home-progress-track"><span style="width:' + percent.toFixed(2) + '%"></span></span></span>' +
          '<span class="komi-home-progress-details"><strong>' + escape(anime.title) + '</strong>' +
          '<small>Сезон ' + season + ' · Серия ' + number + ' · ' + elapsedTime(position) +
          '</small></span></button>';
      }).join('') + '</div></section>';
  }

  function leaderboard() {
    return '<section class="komi-home-leaderboard komi-feature-section" id="komiLeaderboard">' +
      '<div class="komi-home-heading"><div><h2>Топ зрителей Komi</h2>' +
      '<p class="komi-home-subtitle">Подтверждённая активность участников, которые согласились войти в рейтинг</p></div></div>' +
      '<div class="komi-home-community-panel">' +
      '<div class="komi-home-leaderboard-tabs" role="group" aria-label="Показатель рейтинга">' +
      '<button type="button" data-komi-rank="hours" aria-pressed="true">Часы</button>' +
      '<button type="button" data-komi-rank="episodes" aria-pressed="false">Серии</button>' +
      '<button type="button" data-komi-rank="level" aria-pressed="false">Уровень</button>' +
      '</div><div id="komiLeaderboardDetails" class="komi-leaderboard-list" role="status" aria-live="polite">' +
      '<p class="komi-leaderboard-status">Загружаем рейтинг…</p></div>' +
      '<div class="komi-leaderboard-optin"><span>Часы — подтверждённые 20-минутные интервалы просмотра. Участие добровольное.</span>' +
      '<button type="button" data-komi-rank-consent hidden>Участвовать</button></div>' +
      '</div></section>';
  }
  // Only public, catalog-derived selections are memoized. Account-owned
  // recommendations, watch progress and UI state are always read fresh.
  let cachedPublicHome = null;
  function render(context) {
    const source = Array.isArray(context.animeList) ? context.animeList : [];
    const animeList = source.filter(Boolean);
    if (!animeList.length) return '<section class="komi-home-empty">Аниме в каталоге пока нет.</section>';
    const revision = Number(context.catalogRevision) || 0;
    if (!cachedPublicHome || cachedPublicHome.source !== source ||
        cachedPublicHome.revision !== revision || cachedPublicHome.length !== source.length) {
      // Cache normalized sort keys once per catalog revision. Date parsing and
      // year/type normalization must never happen inside thousands of comparisons.
      const now = Date.now(), recentThreshold = now - 30*86400000;
      const latestYear = String(new Date(now).getFullYear());
      const metadata = animeList.map(anime => ({
        anime, score:score(anime), updated:updated(anime),
        year:context.year(anime), type:context.type(anime), count:count(anime)
      }));
      const best = (items,compare,limit) => items.sort(compare).slice(0,limit).map(item=>item.anime);
      const byScore=(a,b)=>b.score-a.score;
      const byRecent=(a,b)=>b.updated-a.updated;
      const ranked = best(metadata.filter(item=>item.score>0),byScore,12);
      const slider = typeof root.KomiHomeSnapshot?.featured === 'function'
        ? root.KomiHomeSnapshot.featured(animeList, context.year)
        : best(metadata.filter(item=>/^https:\/\//i.test(item.anime.poster||'') && item.score>=7 && item.count>0),
            (a,b)=>Number(b.year)-Number(a.year)||byScore(a,b),5);
      const recent = best(metadata.filter(item=>item.updated>0),byRecent,12);
      const season = best(metadata.filter(item=>item.year===latestYear),(a,b)=>byRecent(a,b)||byScore(a,b),12);
      const short = best(metadata.filter(item=>item.type==='Сериал'&&item.count>0&&item.count<=13&&item.score>=7),byScore,12);
      const popularity = item => (item.updated>recentThreshold?2:0)+item.score/10;
      const popular = best(metadata.filter(item=>item.score>0),(a,b)=>popularity(b)-popularity(a),12);
      const catalogPreview = [...new Set([...popular, ...animeList])].slice(0,12);
      const films = best(metadata.filter(item=>item.type==='Фильм'),byScore,10);
      cachedPublicHome = {
        source, revision, length:source.length, ranked, slider, latestYear,
        recent, season, short, popular, catalogPreview, films
      };
    }
    const {ranked, slider, latestYear, recent, season, short, popular,
      catalogPreview, films} = cachedPublicHome;
    const recommended = context.recommendations();
    const history = recentProgress(context, animeList);
    // The same title may appear in several shelves. Build its card once per
    // render; this cache never survives an account or catalog state change.
    const cardMarkup = new Map();
    const originalCard = context.renderCard;
    context = {...context, renderCard(anime) {
      const key = id(anime);
      if (!key) return originalCard(anime);
      if (!cardMarkup.has(key)) cardMarkup.set(key,originalCard(anime));
      return cardMarkup.get(key);
    }};
    return '<div class="komi-home-discovery">' +
      hero(slider,context) +
      (slider.length ? resumeCapsule(history[0], context) : '') +
      continueShelf(history, context) +
      '<section class="komi-hub-catalog-preview" aria-label="Каталог аниме">' +
      (typeof context.quickFilters === 'function' ? context.quickFilters() : '') +
      '<div class="anime-grid">' + (typeof root.matchMedia === 'function' && root.matchMedia('(max-width: 767px)').matches ? catalogPreview.slice(0, 7) : catalogPreview).map(context.renderCard).join('') + '</div></section>' +
      shelf('Популярное прямо сейчас','Высокие оценки Shikimori и недавно обновлённые серии',popular,'all',context.renderCard,'komi-home-popular') +
      shelf('Новинки сезона','Релизы '+latestYear+' года из каталога',season,'all',context.renderCard,'komi-home-season') +
      shelf('На один вечер','Сериалы продолжительностью до 13 серий',short,'short',context.renderCard,'komi-home-evening') +
      shelf('Топ по рейтингу','Самые высоко оценённые тайтлы Shikimori',ranked.slice(0,12),'best',context.renderCard,'komi-home-top') +
      (recent.length ? shelf('Свежие серии','Последние добавления и обновления каталога',recent,'recent',context.renderCard,'komi-home-updated') : '') +
      leaderboard() +
      (recommended.length?shelf('Тебе понравится','Подборка на основе твоих списков и интересов',recommended,'all',context.renderCard,'komi-home-personal'):'') +
      context.calendar() +
      (films.length?shelf('Лучшие фильмы','Истории, которые помещаются в один сеанс',films,'movies',context.renderCard,'komi-home-films'):'') +
      context.years() +
      '<div class="komi-home-browse-footer">'+context.intro()+
      '<nav class="komi-home-support-links" aria-label="Дополнительные разделы Komi">'+
      '<button type="button" data-komi-onclick="navigate(\'partners\')">Партнёры</button>'+
      '<a href="https://www.tiktok.com/@komi_animeofficial" target="_blank" rel="noopener noreferrer">TikTok</a>'+
      '<a href="https://t.me/+X9yUQPEBldo2MzNi" target="_blank" rel="noopener noreferrer">Telegram</a></nav></div>' +
      '</div>';
  }
  // Keep equal sections mounted through catalog/session refreshes. Parsing into
  // a template is inert; images and observers only start for genuinely new DOM.
  const sectionMarkup = new WeakMap();
  const leaderboardObservers = new WeakMap();
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
      const observer=leaderboardObservers.get(node);
      if (observer) observer.disconnect();
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
    const labels = new Map([
      ['Календарь серий','Актуальное расписание выхода эпизодов'],
      ['Аниме 2026','Тайтлы этого года в нашей библиотеке'],
      ['Аниме 2025','Релизы прошлого года'],
      ['Аниме 2024','Что выходило ранее']
    ]);
    for (const header of container.querySelectorAll('.komi-feature-section .section-header')) {
      const heading = header.querySelector('.section-title');
      if (!heading || header.querySelector('.komi-home-subtitle')) continue;
      const description = labels.get(heading.textContent.trim());
      if (!description) continue;
      const p = document.createElement('p');
      p.className = 'komi-home-subtitle';
      p.textContent = description;
      heading.insertAdjacentElement('afterend',p);
    }
    const community = container.querySelector('#komiLeaderboard');
    if (community && !community.dataset.komiRankMounted && !leaderboardObservers.has(community) && typeof IntersectionObserver === 'function') {
      const observer = new IntersectionObserver(entries => {
        if (!community.isConnected) { observer.disconnect(); return; }
        if (entries.some(entry => entry.isIntersecting)) {
          observer.disconnect(); root.KomiPublicLeaderboard?.mount(community);
        }
      }, {rootMargin:'300px'});
      leaderboardObservers.set(community,observer);
      observer.observe(community);
    } else if (community && typeof IntersectionObserver !== 'function') root.KomiPublicLeaderboard?.mount(community);
  }
  root.KomiHomeDiscovery = {render,patch,retainSection,afterRender,observeViewport,recentProgress};
})(globalThis);
