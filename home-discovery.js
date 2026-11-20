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
    return '<section class="komi-home-shelf komi-feature-section ' + (classname || '') + '">' +
      '<div class="komi-home-heading"><div><h2>' + escape(title) + '</h2>' +
      '<p class="komi-home-subtitle">' + escape(subtitle) + '</p></div>' +
      '<button type="button" class="komi-home-all" ' + collectionAction(kind) +
      '>Смотреть все <span aria-hidden="true">↗</span></button></div>' +
      '<div class="komi-home-rail">' + list.map(renderCard).join('') + '</div></section>';
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
  function artworkImage(anime, context, loading, className = '') {
    const source = anime.banner || anime.poster;
    const directSource = className === 'komi-hub-hero-art' && typeof source === 'string'
      ? source.replace(/(https:\/\/shikimori\.(?:io|one)\/system\/animes\/)preview(\/[1-9]\d*\.jpe?g(?:\?\d+)?)/i, '$1original$2')
      : source;
    const direct = typeof directSource === 'string' && /^https:\/\//i.test(directSource)
      ? ' data-poster-direct="' + escape(directSource) + '"' : '';
    return '<img class="' + className + '" src="' + context.artwork(anime) + '" alt="" loading="' +
      loading + '" decoding="async" referrerpolicy="no-referrer"' +
      (className === 'komi-hub-hero-art' && loading === 'eager' ? ' fetchpriority="high"' : '') + direct +
      ' data-komi-onerror="komiCardPosterFallback(this)">';
  }

  function hero(slides, context) {
    if (!slides.length) return '';
    const index = ((Number(context.currentSlideIndex) || 0) % slides.length + slides.length) % slides.length;
    const total = String(slides.length).padStart(2, '0');
    return '<section class="komi-home-hero" aria-label="Рекомендуем посмотреть">' +
      '<div class="hero-slider-container" id="heroSlider" role="group" aria-roledescription="карусель" aria-label="Подборка аниме">' +
      '<div class="hero-slides-wrapper">' + slides.map((anime, i) => {
        const animeId = id(anime);
        // Shikimori IDs match MAL IDs; keep the site's own ID for navigation.
        const malId = String(anime.shikimoriId || anime.idMal || anime.malId || animeId);
        const still = Array.isArray(anime.screenshots)
          ? anime.screenshots.find(url => typeof url === 'string' && /^https:\/\//i.test(url)) : '';
        const year = context.year(anime);
        const description = context.describe(anime.desc);
        const listAction = context.currentUser?.authUserId
          ? "setAnimeStatus('" + animeId + "', 'В планах')" : "openAuthModal('login')";
        const route = '/anime/' + animeId;
        const category = (Array.isArray(anime.genres) && anime.genres[0]) || 'Выбор Komi Anime';

        return '<article class="hero-slide komi-hd-poster' + (i === index ? ' active' : '') + '"' +
          ' data-komi-anime-id="' + escape(malId) + '"' +
          (still ? ' data-komi-hero-still="' + escape(still) + '"' : '') +
          ' aria-hidden="' + (i === index ? 'false' : 'true') + '"' +
          ' aria-label="' + escape(anime.title) + '">' +
          artworkImage(anime, context, i === index ? 'eager' : 'lazy', 'komi-hub-hero-art') +
          '<div class="komi-home-hero-content">' +
          '<div class="komi-hub-hero-kicker"><span>' + escape(category) + '</span>' +
          '<button type="button" class="komi-hub-save" aria-label="Добавить в список" title="Добавить в список" data-komi-onclick="' + listAction + '">' +
          '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4h12v17l-6-4-6 4zM9 10h6m-3-3v6"/></svg></button></div>' +
          '<h1>' + escape(anime.title) + '</h1>' +
          '<p' + (description ? '' : ' class="komi-hub-placeholder"') + '>' +
          (description || 'Описание тайтла пока не добавлено.') + '</p>' +
          '<div class="hero-meta"><span>★ ' + escape(rating(anime)) + ' Shikimori</span>' +
          (year ? '<span>' + escape(year) + '</span>' : '') +
          '<span>' + escape(context.type(anime)) + '</span></div>' +
          '<div class="hero-buttons"><a class="komi-hub-play" href="' + route + '#player">▷ Смотреть аниме</a>' +
          '<a class="komi-hub-glass" href="' + route + '">Подробнее</a></div></div>' +
          (slides.length > 1 ? '<span class="komi-hub-slide-count" aria-hidden="true">' +
            String(i + 1).padStart(2, '0') + ' <span>/ ' + total + '</span></span>' : '') + '</article>';
      }).join('') + '</div>' +
      (slides.length > 1 ? '<div class="komi-hub-carousel-controls">' +
        '<div class="hero-dots" role="group" aria-label="Слайды">' + slides.map((_, i) =>
          '<button type="button" class="hero-dot' + (i === index ? ' active' : '') +
          '" aria-label="Показать тайтл ' + (i + 1) + '" aria-pressed="' +
          (i === index ? 'true' : 'false') + '" data-komi-onclick="setSlide(' + i + ')"></button>'
        ).join('') + '</div>' +
        '<button type="button" class="hero-slider-arrow hero-arrow-prev" aria-label="Предыдущий тайтл" data-komi-onclick="changeSlide(-1)">' + heroChevron('left') + '</button>' +
        '<button type="button" class="hero-slider-arrow hero-arrow-next" aria-label="Следующий тайтл" data-komi-onclick="changeSlide(1)">' + heroChevron('right') + '</button></div>'
        : '') + '</div></section>';
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
    // No public opt-in aggregate source currently exists. Never expose other
    // users' owner-only watch progress or wallet rows to manufacture rankings.
    return '<section class="komi-home-leaderboard komi-feature-section" id="komiLeaderboard">' +
      '<div class="komi-home-heading"><div><h2>Топ зрителей Komi</h2>' +
      '<p class="komi-home-subtitle">Сообщество и достижения зрителей</p></div>' +
      '<a class="komi-home-all" href="#komiLeaderboardDetails">Весь рейтинг ↗</a></div>' +
      '<div class="komi-home-community-panel">' +
      '<div class="komi-home-leaderboard-tabs" role="group" aria-label="Показатель рейтинга">' +
      '<button type="button" data-komi-rank="episodes" aria-pressed="true">По сериям</button>' +
      '<button type="button" data-komi-rank="hours" aria-pressed="false">По часам</button>' +
      '<button type="button" data-komi-rank="coins" aria-pressed="false">По AniCoin</button>' +
      '</div><div id="komiLeaderboardDetails" class="komi-home-community-empty" role="status" aria-live="polite">' +
      '<span class="komi-home-community-mark" aria-hidden="true">◇</span>' +
      '<div><strong>Публичный рейтинг пока не доступен</strong>' +
      '<p>Показатели просмотра и балансы пользователей защищены. Здесь появятся только разрешённые к публикации результаты.</p></div>' +
      '</div></div></section>';
  }
  function render(context) {
    const animeList = Array.isArray(context.animeList) ? context.animeList.filter(Boolean) : [];
    if (!animeList.length) return '<section class="komi-home-empty">Аниме в каталоге пока нет.</section>';
    const ranked = [...animeList].filter(a => score(a)>0).sort((a,b)=>score(b)-score(a));
    const slider = typeof root.KomiHomeSnapshot?.featured === 'function'
      ? root.KomiHomeSnapshot.featured(animeList, context.year)
      : [...animeList].filter(a => /^https:\/\//i.test(a.poster || '') &&
          score(a) >= 7 && count(a) > 0)
          .sort((a,b)=>Number(context.year(b))-Number(context.year(a))||score(b)-score(a)).slice(0,5);
    const latestYear = String(new Date().getFullYear());
    const recent = [...animeList].filter(a=>updated(a)>0)
      .sort((a,b)=>updated(b)-updated(a)).slice(0,12);
    const season = [...animeList].filter(a=>context.year(a)===latestYear)
      .sort((a,b)=>updated(b)-updated(a)||score(b)-score(a)).slice(0,12);
    const short = [...animeList].filter(a=>context.type(a)==='Сериал' &&
      count(a)>0 && count(a)<=13 && score(a)>=7).sort((a,b)=>score(b)-score(a)).slice(0,12);
    const popular = [...animeList].filter(a=>score(a)>0)
      .sort((a,b)=>((updated(b)>Date.now()-30*86400000?2:0)+score(b)/10)-
                    ((updated(a)>Date.now()-30*86400000?2:0)+score(a)/10)).slice(0,12);
    const recommended = context.recommendations();
    const history = recentProgress(context, animeList);
    const catalogPreview = [...new Set([...popular, ...animeList])].slice(0, 12);
    const films = animeList.filter(a=>context.type(a)==='Фильм')
      .sort((a,b)=>score(b)-score(a)).slice(0,10);
    return '<div class="komi-home-discovery">' +
      hero(slider,context) +
      (slider.length ? resumeCapsule(history[0], context) : '') +
      continueShelf(history, context) +
      '<section class="komi-hub-catalog-preview" aria-label="Каталог аниме">' +
      (typeof context.quickFilters === 'function' ? context.quickFilters() : '') +
      '<div class="anime-grid">' + catalogPreview.map(context.renderCard).join('') + '</div></section>' +
      genreShelf(animeList) +
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
  function afterRender(container) {
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
    if (!community) return;
    community.addEventListener('click', event=>{
      const button=event.target.closest('[data-komi-rank]');
      if (!button || !community.contains(button)) return;
      const selected=button.getAttribute('data-komi-rank');
      for (const tab of community.querySelectorAll('[data-komi-rank]'))
        tab.setAttribute('aria-pressed',String(tab===button));
      community.dataset.metric=selected;
    });
  }
  root.KomiHomeDiscovery = {render,afterRender,recentProgress};
})(globalThis);
