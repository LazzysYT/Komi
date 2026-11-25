/* Home release shelves reuse the public catalogue and its existing schedule.
 * This module performs no requests and stores no account or playback data.
 * The bot writes lastEpisodeAddedAt/lastEpisodeNumber only for a newly added
 * playable source; public summaries must also be successfully synced. A
 * timestamp, a broadcast date or an episode count alone is not availability.
 */
(function (root) {
  'use strict';
  const DAY = 86400000;
  const escape = value => String(value == null ? '' : value).replace(/[&<>"']/g,
    ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const positive = value => /^[1-9][0-9]{0,4}$/.test(String(value ?? '')) ? Number(value) : null;
  const episodeNumber = value => Number.isSafeInteger(Number(value)) && Number(value) > 0 && Number(value) <= 99999 ? Number(value) : null;
  const animeId = anime => /^[1-9][0-9]{0,11}$/.test(String(anime?.id ?? '')) ? String(anime.id) : '';
  const time = value => {
    if (typeof value !== 'string' || !value.trim()) return NaN;
    return Date.parse(value);
  };
  function currentTime(options) {
    return Number.isFinite(options?.now) ? options.now : Date.now();
  }
  function boundedLimit(options) {
    return Number.isInteger(options?.limit) ? Math.max(0, Math.min(12, options.limit)) : 8;
  }
  function distinct(entries) {
    const ids = new Set();
    return entries.filter(entry => !ids.has(entry.id) && ids.add(entry.id));
  }
  function selectRecent(animeList, options = {}) {
    const now = currentTime(options);
    const core = options.core || root.KomiPlayerCore;
    const entries = [];
    for (const anime of Array.isArray(animeList) ? animeList : []) {
      const id = animeId(anime);
      const date = time(anime?.lastEpisodeAddedAt);
      const number = positive(anime?.lastEpisodeNumber);
      if (!id || !number || !Number.isFinite(date) || date > now || now - date > 14 * DAY) continue;
      let season = null;
      const episodes = Array.isArray(anime.episodes) ? anime.episodes : [];
      // Loaded episode data is stronger evidence than the public summary.
      // If it contradicts the summary, omit the item instead of claiming a
      // missing episode is available. Do not infer a season from its number.
      if (episodes.length || anime.komiDetailsLoaded) {
        if (!core?.seasonEpisodes) continue;
        const matches = [];
        for (const value of new Set(episodes.map(episode => episodeNumber(episode?.season) || 1))) {
          for (const episode of core.seasonEpisodes(episodes, value)) {
            if (episodeNumber(episode.number) === number && Object.keys(episode.sources || {}).length)
              matches.push({season:value, episode});
          }
        }
        const declaredSeason = positive(anime.lastEpisodeSeason);
        const exact = declaredSeason ? matches.find(item => item.season === declaredSeason)
          : matches.length === 1 ? matches[0] : null;
        if (!matches.length || (declaredSeason && !exact)) continue;
        season = exact?.season || null;
      } else {
        if (anime.syncStatus !== 'synced' || !(Number(anime.episodeCount) > 0)) continue;
        season = positive(anime.lastEpisodeSeason);
      }
      // If the summary does not know the season, the player resolves the
      // requested number against the title's full, playable episode data.
      const href = '/anime/' + id + '?' + (season ? 'season=' + season + '&' : '') + 'episode=' + number + '#player';
      entries.push({anime, id, number, season, date, href});
    }
    return distinct(entries.sort((a, b) => b.date - a.date)).slice(0, boundedLimit(options));
  }
  function selectUpcoming(animeList, options = {}) {
    const now = currentTime(options);
    const end = now + 14 * DAY;
    const entries = [];
    for (const anime of Array.isArray(animeList) ? animeList : []) {
      const id = animeId(anime);
      if (!id) continue;
      const stored = time(anime.nextEpisodeAt || anime.next_episode_at || anime.nextEpisodeDate);
      const live = options.schedule?.get?.(Number(anime.shikimoriId || id));
      // A fresh result from the existing schedule loader takes precedence over
      // older catalogue metadata. Never manufacture a weekly repeat.
      const liveDate = Number(live?.at);
      const useLive = Number.isFinite(liveDate) && liveDate > now;
      const date = useLive ? liveDate : stored;
      if (!Number.isFinite(date) || date <= now || date > end) continue;
      const number = positive(useLive ? live.episode : anime.nextEpisodeNumber);
      entries.push({anime, id, number, date, href:'/anime/' + id});
    }
    return distinct(entries.sort((a, b) => a.date - b.date)).slice(0, boundedLimit(options));
  }
  function image(anime, context) {
    const compact = typeof context.posterSource === 'function' ? context.posterSource(anime) : null;
    const candidate = compact?.preferred || (typeof context.artwork === 'function'
      ? context.artwork({poster:anime.poster || anime.banner, banner:''}) : anime.poster || anime.banner);
    let source = '/anime-artwork.svg';
    if (typeof candidate === 'string' && (/^https:\/\/[^\s"'<>]+$/i.test(candidate) || /^\/(?!\/)[^\s"'<>]*$/.test(candidate)))
      source = candidate;
    return '<img class="komi-home-release-poster" src="/anime-artwork.svg"' +
      (source !== '/anime-artwork.svg' ? ' data-komi-lazy-src="' + escape(source) + '"' : '') +
      ' width="80" height="120" alt="" loading="lazy" decoding="async" fetchpriority="low"' +
      (typeof compact?.direct === 'string' && /^https:\/\//i.test(compact.direct) ? ' data-poster-direct="' + escape(compact.direct) + '"' : '') +
      (typeof compact?.original === 'string' && /^https:\/\//i.test(compact.original) ? ' data-poster-original="' + escape(compact.original) + '"' : '') +
      ' referrerpolicy="no-referrer" data-komi-onerror="komiCardPosterFallback(this)">';
  }
  function dateLabel(value, withTime) {
    const date = new Date(value);
    const day = date.toLocaleDateString('ru-RU', {day:'numeric', month:'short'});
    return withTime ? day + ' · ' + date.toLocaleTimeString('ru-RU', {hour:'2-digit', minute:'2-digit'}) : day;
  }
  function cards(entries, context, upcoming) {
    return '<ul class="komi-home-release-rail">' + entries.map(entry => {
      const episode = entry.number ? (entry.season ? 'Сезон ' + entry.season + ' · ' : '') + 'Серия ' + entry.number
        : 'Следующая серия';
      return '<li><a class="komi-home-release-card" href="' + entry.href + '" data-komi-anime-id="' + entry.id + '">' +
        image(entry.anime, context) + '<span class="komi-home-release-copy">' +
        '<time datetime="' + new Date(entry.date).toISOString() + '">' +
          (upcoming ? '' : 'Добавлена ') + escape(dateLabel(entry.date, upcoming)) + '</time>' +
        '<strong>' + escape(entry.anime.title) + '</strong><span>' + escape(episode) + '</span>' +
        '<small>' + (upcoming ? 'По расписанию' : 'Смотреть серию') + '</small></span></a></li>';
    }).join('') + '</ul>';
  }
  function renderRecent(context = {}) {
    const entries = selectRecent(context.animeList, context);
    if (!entries.length) return '';
    return '<section class="komi-home-shelf komi-feature-section komi-home-updated" aria-labelledby="komiHomeRecentTitle">' +
      '<div class="komi-home-heading"><div><h2 id="komiHomeRecentTitle">Свежие серии</h2>' +
      '<p class="komi-home-subtitle">Новые серии с подтверждёнными источниками в каталоге</p></div></div>' +
      cards(entries, context, false) + '</section>';
  }
  function renderUpcoming(context = {}) {
    const entries = selectUpcoming(context.animeList, context);
    // The storefront only advertises confirmed dates. Empty, pending and failed
    // first loads leave no calendar widget; the existing loader can insert it
    // later when its schedule has a matching catalogue entry.
    if (!entries.length) return '';
    return '<section id="komiHomeUpcoming" class="komi-home-shelf komi-feature-section komi-home-upcoming" aria-labelledby="komiHomeUpcomingTitle">' +
      '<div class="komi-home-heading"><div><h2 id="komiHomeUpcomingTitle">Скоро выйдут</h2>' +
      '<p class="komi-home-subtitle">По расписанию. Озвучка может появиться позже. Время указано в вашем часовом поясе.</p></div>' +
      '<button type="button" class="komi-home-all" data-komi-onclick="loadKomiEpisodeSchedule(true)"' +
      (context.scheduleLoading ? ' disabled aria-busy="true"' : '') + '>Обновить</button></div>' +
      cards(entries, context, true) +
      (context.scheduleError ? '<p class="komi-home-subtitle" role="status">Не удалось обновить расписание. Показаны последние подтверждённые даты. Попробуйте ещё раз.</p>' : '') +
      '</section>';
  }
  // Refresh only this shelf, preserving the hero and the rest of the storefront.
  // The section can be absent initially or disappear as its dates expire.
  function updateUpcoming(container, context = {}) {
    if (!container) return null;
    const document = container.ownerDocument;
    const previous = container.querySelector('#komiHomeUpcoming');
    const footer = container.querySelector('.komi-home-browse-footer');
    const restoreFocus = !!previous?.contains(document.activeElement);
    const markup = renderUpcoming(context);
    let next = null;
    if (markup) {
      const template = document.createElement('template');
      template.innerHTML = markup;
      next = template.content.firstElementChild;
      if (previous) previous.replaceWith(next);
      else container.insertBefore(next, footer || null);
    } else previous?.remove();
    if (restoreFocus) {
      const target = next?.querySelector('.komi-home-all') || footer?.querySelector('.komi-home-catalog-link');
      target?.focus({preventScroll:true});
    }
    return next;
  }
  const api = {selectRecent, selectUpcoming, renderRecent, renderUpcoming, updateUpcoming};
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.KomiHomeReleases = api;
})(globalThis);
