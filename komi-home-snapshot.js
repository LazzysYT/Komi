/* Public home preview, never contains user identity, progress or private data.
 * A bounded, TTL-limited cache makes repeat loads paint a real, complete
 * featured selection instead of the first 48 lowest-ID catalog rows.
 */
(function (root) {
  'use strict';
  const KEY = 'komi.public.home.preview.v1';
  const TTL = 72 * 60 * 60 * 1000;
  const MAX_ITEMS = 150;
  const cleanText = (value, max = 400) => String(value == null ? '' : value).slice(0, max);
  const safeUrl = value => typeof value === 'string' && /^https:\/\/[^\s]+$/i.test(value) ? value.slice(0, 2048) : '';
  const score = a => Number(a?.shikiRating) || 0;
  const updated = a => Date.parse(a?.lastEpisodeAddedAt || '') || 0;
  const id = a => String(a?.id || '');
  const validId = a => /^[1-9][0-9]{0,14}$/.test(id(a));
  const episodeCount = a => Math.max(0, Number(a?.episodeCount) || 0);
  const year = (a, yearFn) => Number(yearFn(a)) || 0;
  const type = (a, typeFn) => typeFn(a);
  function safeCard(a) {
    if (!validId(a)) return null;
    return {
      id: id(a), shikimoriId: Number(a.shikimoriId || a.id),
      title: cleanText(a.title, 240), originalTitle: cleanText(a.originalTitle, 240),
      poster: safeUrl(a.poster), banner: safeUrl(a.banner),
      year: cleanText(a.year, 8), type: cleanText(a.type, 24),
      genres: (Array.isArray(a.genres) ? a.genres : []).slice(0, 10).map(g => cleanText(g, 50)),
      shikiRating: Number.isFinite(Number(a.shikiRating)) ? Number(a.shikiRating) : 0,
      episodeCount: episodeCount(a),
      lastEpisodeAddedAt: cleanText(a.lastEpisodeAddedAt, 50),
      komiCardUpdatedAt: cleanText(a.komiCardUpdatedAt, 50),
      desc: cleanText(a.desc, 850),
      screenshots: (Array.isArray(a.screenshots) ? a.screenshots : []).slice(0, 2).map(safeUrl).filter(Boolean),
      episodes: []
    };
  }
  function sample(catalog, yearFn, typeFn, now = Date.now()) {
    if (!Array.isArray(catalog) || typeof yearFn !== 'function' || typeof typeFn !== 'function') return [];
    const all = catalog.filter(validId);
    if (!all.length) return [];
    const byScore = (a, b) => score(b) - score(a);
    const byYear = (a, b) => year(b, yearFn) - year(a, yearFn) || byScore(a,b);
    const byUpdated = (a, b) => updated(b) - updated(a);
    const byPopular = (a, b) =>
      ((updated(b) > now - 30*86400000 ? 2 : 0) + score(b)/10) -
      ((updated(a) > now - 30*86400000 ? 2 : 0) + score(a)/10);
    const thisYear = new Date(now).getFullYear();
    const groups = [
      all.filter(a => safeUrl(a.poster)).sort(byYear).slice(0, 7),
      all.filter(a => score(a) > 0).sort(byScore).slice(0, 18),
      all.filter(a => year(a, yearFn) === thisYear).sort((a,b) => byUpdated(a,b) || byScore(a,b)).slice(0, 18),
      all.filter(a => score(a) > 0).sort(byPopular).slice(0, 18),
      all.filter(a => updated(a) > 0).sort(byUpdated).slice(0, 18),
      all.filter(a => type(a, typeFn) === 'Сериал' && episodeCount(a) > 0 &&
        episodeCount(a) <= 13 && score(a) >= 7).sort(byScore).slice(0, 18),
      all.filter(a => type(a, typeFn) === 'Фильм').sort(byScore).slice(0, 14),
      all.slice(0, 22)
    ];
    const seen = new Set(), picked = [];
    for (const group of groups) for (const item of group) {
      const key = id(item);
      if (seen.has(key)) continue;
      const card = safeCard(item);
      if (!card) continue;
      seen.add(key);
      picked.push(card);
      if (picked.length >= MAX_ITEMS) return picked;
    }
    return picked;
  }
  function read() {
    try {
      const raw = root.localStorage?.getItem(KEY);
      if (!raw || raw.length > 500000) return null;
      const value = JSON.parse(raw);
      if (value?.version !== 1 || !Number.isFinite(value.savedAt) ||
          value.savedAt > Date.now() || Date.now() - value.savedAt > TTL ||
          !Array.isArray(value.items) || value.items.length < 5 ||
          value.items.length > MAX_ITEMS) return null;
      const items = value.items.map(safeCard).filter(Boolean);
      return items.length >= 5 ? items : null;
    } catch { return null; }
  }
  function write(catalog, yearFn, typeFn) {
    if (!Array.isArray(catalog) || catalog.length < 48) return;
    try {
      const items = sample(catalog, yearFn, typeFn);
      if (items.length < 5) return;
      root.localStorage?.setItem(KEY, JSON.stringify({version:1,savedAt:Date.now(),items}));
    } catch {
      // Quota/private browsing must never interrupt the live catalog.
    }
  }
  const api = {read, write, sample, KEY};
  root.KomiHomeSnapshot = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
