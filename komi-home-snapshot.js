/* Public home preview, never contains user identity, progress or private data.
 * A bounded, TTL-limited cache makes repeat loads paint a real, complete
 * featured selection instead of the first 48 lowest-ID catalog rows.
 */
(function (root) {
  'use strict';
  const KEY = 'komi.public.home.preview.v2';
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
  const releaseNumberFields = ['lastEpisodeNumber','lastEpisodeSeason','nextEpisodeNumber'];
  function safeCard(a) {
    if (!validId(a)) return null;
    const card = {
      id: id(a), shikimoriId: Number(a.shikimoriId || a.id),
      title: cleanText(a.title, 240), originalTitle: cleanText(a.originalTitle, 240),
      poster: safeUrl(a.poster), banner: safeUrl(a.banner),
      year: cleanText(a.year, 8), type: cleanText(a.type, 24),
      genres: (Array.isArray(a.genres) ? a.genres : []).slice(0, 10).map(g => cleanText(g, 50)),
      shikiRating: Number.isFinite(Number(a.shikiRating)) ? Number(a.shikiRating) : 0,
      episodeCount: episodeCount(a),
      lastEpisodeAddedAt: cleanText(a.lastEpisodeAddedAt, 50),
      nextEpisodeAt: cleanText(a.nextEpisodeAt, 50),
      syncStatus: cleanText(a.syncStatus, 24),
      scheduleSource: cleanText(a.scheduleSource, 80),
      komiCardUpdatedAt: cleanText(a.komiCardUpdatedAt, 50),
      desc: cleanText(a.desc, 850),
      screenshots: (Array.isArray(a.screenshots) ? a.screenshots : []).slice(0, 2).map(safeUrl).filter(Boolean),
      episodes: []
    };
    for (const key of releaseNumberFields) {
      const value = a[key];
      if ((typeof value === 'number' || typeof value === 'string') &&
          /^[1-9][0-9]{0,4}$/.test(String(value))) card[key] = Number(value);
    }
    return card;
  }
  // Keep the homepage and cached preview on the same featured selection.
  // Upcoming, unrated titles without episodes were producing an empty hero.
  function featured(catalog, yearFn, now = Date.now()) {
    if (!Array.isArray(catalog) || typeof yearFn !== 'function') return [];
    const currentYear = new Date(now).getFullYear();
    const candidates = [];
    for (const a of catalog) {
      if (!validId(a) || !(safeUrl(a.banner) || safeUrl(a.poster))) continue;
      const y=year(a,yearFn), rating=score(a);
      if (y<2000 || y>currentYear || rating<=0) continue;
      candidates.push({anime:a,year:y,rating,count:episodeCount(a),id:Number(id(a))});
    }
    const available = candidates.filter(a => a.count > 0 && a.rating >= 7);
    const eligible = available.length >= 5 ? available :
      candidates.filter(a => a.rating >= 7);
    const sorted = (eligible.length ? eligible : candidates).sort((a,b) =>
      b.year - a.year || b.rating - a.rating || a.id - b.id);
    return sorted.slice(0,5).map(a=>a.anime);
  }
  function sample(catalog, yearFn, typeFn, now = Date.now()) {
    if (!Array.isArray(catalog) || typeof yearFn !== 'function' || typeof typeFn !== 'function') return [];
    const all = catalog.filter(validId);
    if (!all.length) return [];
    // Compute expensive date/year/type keys once, not for each sort comparison.
    const recentThreshold=now-30*86400000;
    const metadata=all.map(anime=>{
      const date=updated(anime), rating=score(anime);
      return {anime,year:year(anime,yearFn),type:type(anime,typeFn),
        count:episodeCount(anime),rating,date,popular:(date>recentThreshold?2:0)+rating/10};
    });
    const byScore=(a,b)=>b.rating-a.rating;
    const byYear=(a,b)=>b.year-a.year||byScore(a,b);
    const byUpdated=(a,b)=>b.date-a.date;
    const best=(items,compare,limit)=>items.sort(compare).slice(0,limit).map(x=>x.anime);
    const thisYear=new Date(now).getFullYear();
    const groups=[
      featured(all,yearFn,now),
      best(metadata.filter(a=>safeUrl(a.anime.poster)),byYear,7),
      best(metadata.filter(a=>a.rating>0),byScore,18),
      best(metadata.filter(a=>a.year===thisYear),(a,b)=>byUpdated(a,b)||byScore(a,b),18),
      best(metadata.filter(a=>a.rating>0),(a,b)=>b.popular-a.popular,18),
      best(metadata.filter(a=>a.date>0),byUpdated,18),
      best(metadata.filter(a=>a.type==='Сериал'&&a.count>0&&a.count<=13&&a.rating>=7),byScore,18),
      best(metadata.filter(a=>a.type==='Фильм'),byScore,14),
      all.slice(0,22)
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
      if (value?.version !== 2 || !Number.isFinite(value.savedAt) ||
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
      root.localStorage?.setItem(KEY, JSON.stringify({version:2,savedAt:Date.now(),items}));
    } catch {
      // Quota/private browsing must never interrupt the live catalog.
    }
  }
  const api = {read, write, sample, featured, KEY};
  root.KomiHomeSnapshot = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
