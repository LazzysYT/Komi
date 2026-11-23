/* Komi Anime: progressive hero artwork with native-resolution fallbacks.
 * Requests public metadata only; does not send account information.
 * Wide images must be genuinely wide and high resolution. Low-resolution
 * portraits fill the entire hero with soft focus instead of a narrow strip.
 */
(function (root) {
  'use strict';

  const API = 'https://graphql.anilist.co';
  const SELECTOR = '.komi-home-hero .hero-slide[data-komi-anime-id]';
  const CACHE_PREFIX = 'komi_hd_hero_v3_';
  const FOUND_TTL = 24 * 60 * 60 * 1000;
  const MISSING_TTL = 60 * 60 * 1000;
  const cache = new Map();
  const pending = new Set();
  let fetching = false;
  let scanTimer = null;

  function trustedAniListImage(raw) {
    try {
      if (typeof raw !== 'string' || raw.length > 1024) return '';
      const u = new URL(raw);
      if (u.protocol !== 'https:' || u.username || u.password || u.port || u.hash ||
          !['s4.anilist.co', 's3.anilist.co'].includes(u.hostname) ||
          !/^\/file\/anilistcdn\/media\/anime\/(?:banner|cover)\//.test(u.pathname)) return '';
      return u.href;
    } catch { return ''; }
  }

  function safeStill(raw) {
    try {
      if (typeof raw !== 'string' || raw.length > 1024) return '';
      const u = new URL(raw);
      return u.protocol === 'https:' && !u.username && !u.password && !u.port ? u.href : '';
    } catch { return ''; }
  }

  function getCached(id) {
    const now = Date.now();
    const key = CACHE_PREFIX + id;
    let item = cache.get(id);
    if (!item) {
      try { item = JSON.parse(sessionStorage.getItem(key) || 'null'); } catch { item = null; }
    }
    if (!item || !Number.isFinite(item.time) ||
        now - item.time > (item.banner || item.cover ? FOUND_TTL : MISSING_TTL)) {
      cache.delete(id);
      return null;
    }
    cache.set(id, item);
    return item;
  }

  function saveCached(id, media) {
    const entry = {
      banner: trustedAniListImage(media?.bannerImage),
      cover: trustedAniListImage(media?.coverImage?.extraLarge),
      time: Date.now()
    };
    cache.set(id, entry);
    try { sessionStorage.setItem(CACHE_PREFIX + id, JSON.stringify(entry)); } catch {}
    return entry;
  }

  function updateLayout(slide, img) {
    if (!img || !img.naturalHeight) return;
    const ratio = img.naturalWidth / img.naturalHeight;
    const wide = img.naturalWidth >= 1200 && ratio >= 1.6;
    const softWide = !wide && img.naturalWidth >= 900 && ratio >= 1.55;
    slide.classList.toggle('komi-hd-wide', wide);
    slide.classList.toggle('komi-hd-softwide', softWide);
    slide.classList.toggle('komi-hd-poster', !wide && !softWide);
    slide.classList.toggle('komi-art-ready', true);
  }

  function bindImage(slide) {
    const img = slide.querySelector('img.komi-hub-hero-art');
    if (!img) return null;
    if (!img.dataset.komiHeroBound) {
      img.dataset.komiHeroBound = '1';
      img.addEventListener('load', () => updateLayout(slide, img));
      if (img.complete && img.naturalWidth) updateLayout(slide, img);
    }
    return img;
  }

  function preflight(url) {
    return new Promise(resolve => {
      if (!url) return resolve(null);
      const picture = new Image();
      picture.decoding = 'async';
      picture.referrerPolicy = 'no-referrer';
      picture.onload = () => resolve({
        url, width: picture.naturalWidth, height: picture.naturalHeight
      });
      picture.onerror = () => resolve(null);
      picture.src = url;
    });
  }

  async function applyArtwork(slide, entry) {
    const img = bindImage(slide);
    if (!img) return;
    const still = safeStill(slide.dataset.komiHeroStill);
    const originalPoster = safeStill(img.dataset.posterDirect);
    const signature = [entry.banner, still, entry.cover, originalPoster].join('|');
    if (img.dataset.komiHeroChecked === signature) return;
    img.dataset.komiHeroChecked = signature;

    // Prefer the largest real widescreen image (banner or anime screenshot).
    // At 900-1199px, slight softening prevents visible upscaling artifacts.
    let bestLandscape = null;
    for (const url of new Set([entry.banner, still].filter(Boolean))) {
      const result = await preflight(url);
      if (!img.isConnected || img.dataset.komiHeroChecked !== signature) return;
      if (result && result.width >= 900 && result.height > 0 &&
          result.width / result.height >= 1.55 &&
          (!bestLandscape || result.width > bestLandscape.width)) {
        bestLandscape = result;
      }
    }
    if (bestLandscape) {
      if (img.src !== bestLandscape.url) img.src = bestLandscape.url;
      return;
    }

    // No HD landscape: fill the full hero with a softly blurred portrait.
    // Use the original cover if it has better native dimensions than the proxy.
    let bestPortrait = null;
    for (const url of new Set([entry.cover, originalPoster].filter(Boolean))) {
      const result = await preflight(url);
      if (!img.isConnected || img.dataset.komiHeroChecked !== signature) return;
      if (result && result.width >= 480 && result.height > result.width * 1.05 &&
          (!bestPortrait || result.width > bestPortrait.width)) {
        bestPortrait = result;
      }
    }
    if (bestPortrait && bestPortrait.width > (img.naturalWidth || 0) + 90 &&
        img.src !== bestPortrait.url) {
      img.src = bestPortrait.url;
    }
  }

  function apply(id, entry) {
    document.querySelectorAll(SELECTOR).forEach(slide => {
      if (slide.dataset.komiAnimeId === id &&
          (!root.matchMedia?.('(max-width: 767px)').matches ||
            slide.classList.contains('active'))) void applyArtwork(slide, entry);
    });
  }

  async function fetchPending() {
    if (fetching || !pending.size) return;
    fetching = true;
    try {
      while (pending.size) {
        const batch = Array.from(pending).slice(0, 5);
        batch.forEach(id => pending.delete(id));

        // A Page filter skips missing titles instead of failing a query when
        // any single MAL entry has no matching AniList media record.
        const query = 'query KomiHeroArtwork($ids:[Int]) {' +
          ' Page(page:1,perPage:5) {' +
          ' media(type:ANIME,idMal_in:$ids) {' +
          ' idMal isAdult bannerImage coverImage { extraLarge } } } }';
        try {
          const response = await fetch(API, {
            method: 'POST',
            headers: {'Content-Type':'application/json', Accept:'application/json'},
            body: JSON.stringify({query, variables:{ids:batch.map(Number)}}),
            credentials: 'omit'
          });
          if (!response.ok) continue;
          const payload = await response.json();
          const results = payload?.data?.Page?.media;
          if (!Array.isArray(results)) continue;
          const byId = new Map(results.filter(item => item && !item.isAdult)
            .map(item => [String(item.idMal), item]));
          for (const id of batch) {
            apply(id, saveCached(id, byId.get(id)));
          }
        } catch {
          // Keep the existing image when AniList is offline or rate-limited.
        }
      }
    } finally {
      fetching = false;
    }
  }

  function scan() {
    const mobile = root.matchMedia?.('(max-width: 767px)').matches || false;
    document.querySelectorAll(SELECTOR).forEach(slide => {
      // On cellular, do not request high-resolution alternatives for slides
      // the visitor has not selected yet.
      if (mobile && !slide.classList.contains('active')) return;
      bindImage(slide);
      const id = String(slide.dataset.komiAnimeId || '');
      if (!/^[1-9]\d{0,9}$/.test(id)) return;
      const cached = getCached(id);
      if (cached) void applyArtwork(slide, cached);
      else pending.add(id);
    });
    if (pending.size) void fetchPending();
  }

  function scheduleScan() {
    if (scanTimer !== null) return;
    scanTimer = setTimeout(() => {
      scanTimer = null;
      scan();
    }, 100);
  }

  root.KomiHeroArt = {scan};
  const container = document.getElementById('mainContainer');
  if (container) {
    new MutationObserver(scheduleScan).observe(container, {childList:true, subtree:true});
    scan();
  }
})(window);
