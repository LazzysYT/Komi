/* Progressive, high-resolution hero artwork from AniList's public GraphQL API.
 * One batched request for up to five carousel titles; original Komi artwork
 * remains the fallback on errors, blocked requests, or missing banners.
 * No account identifiers, credentials or personal data are sent.
 */
(function (root) {
  'use strict';
  const API = 'https://graphql.anilist.co';
  const TTL = 24 * 60 * 60 * 1000;
  const memory = new Map();
  const pending = new Set();
  let running = false;
  let scanTimer = null;

  function validImage(raw) {
    try {
      const url = new URL(raw);
      return url.protocol === 'https:' &&
        (url.hostname === 's4.anilist.co' || url.hostname === 's3.anilist.co') &&
        /^\/file\/anilistcdn\/media\/anime\/(?:banner|cover)\//.test(url.pathname) &&
        !url.username && !url.password && !url.port && !url.hash ? url.href : '';
    } catch { return ''; }
  }
  function cacheKey(id) { return 'komi_hd_hero_' + id; }
  function getCached(id) {
    if (memory.has(id)) return memory.get(id);
    try {
      const entry = JSON.parse(sessionStorage.getItem(cacheKey(id)) || 'null');
      if (entry && Date.now() - entry.time < TTL) {
        memory.set(id, entry);
        return entry;
      }
    } catch { /* private browsing may disable storage */ }
    return null;
  }
  function putCached(id, url, kind) {
    const entry = { url: validImage(url), kind, time: Date.now() };
    memory.set(id, entry);
    try { sessionStorage.setItem(cacheKey(id), JSON.stringify(entry)); } catch {}
    return entry;
  }
  function promote(img, entry) {
    if (!entry?.url || img.dataset.komiHdHeroSrc === entry.url) return;
    img.dataset.komiHdHeroSrc = entry.url;
    const probe = new Image();
    probe.referrerPolicy = 'no-referrer';
    probe.decoding = 'async';
    probe.onload = () => {
      if (!img.isConnected || img.dataset.komiHdHeroSrc !== entry.url) return;
      const width = probe.naturalWidth;
      const height = probe.naturalHeight;
      const wide = height > 0 && width / height >= 1.45;
      if (entry.kind === 'banner' ? !(wide && width >= 700) : width < 400) return;
      // Do not replace an already better-quality source with a smaller image.
      if (img.complete && img.naturalWidth > width && img.naturalHeight > height) return;
      img.src = entry.url;
    };
    probe.onerror = () => {};
    probe.src = entry.url;
  }
  function apply(id, entry) {
    const slides = document.querySelectorAll('.komi-home-hero .hero-slide[data-komi-anime-id="' + id + '"] img.komi-hub-hero-art');
    slides.forEach(img => promote(img, entry));
  }
  async function fetchPending() {
    if (running || !pending.size) return;
    running = true;
    try {
      while (pending.size) {
        const ids = Array.from(pending).slice(0, 5);
        ids.forEach(id => pending.delete(id));
        const query = 'query KomiHeroArtwork { ' +
          ids.map(id => 'anime' + id + ': Media(idMal: ' + id +
            ', type: ANIME) { bannerImage coverImage { extraLarge } }').join(' ') + ' }';
        try {
          const response = await fetch(API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ query }),
            mode: 'cors',
            credentials: 'omit'
          });
          if (!response.ok) continue;
          const payload = await response.json();
          for (const id of ids) {
            const media = payload?.data?.['anime' + id];
            const banner = validImage(media?.bannerImage);
            const cover = validImage(media?.coverImage?.extraLarge);
            const entry = putCached(id, banner || cover, banner ? 'banner' : 'cover');
            apply(id, entry);
          }
        } catch {
          // The original banner/poster stays visible when AniList is unavailable.
        }
      }
    } finally { running = false; }
  }
  function scan() {
    document.querySelectorAll('.komi-home-hero .hero-slide[data-komi-anime-id]').forEach(slide => {
      const id = slide.dataset.komiAnimeId || '';
      if (!/^[1-9]\d{0,14}$/.test(id)) return;
      const entry = getCached(id);
      if (entry) apply(id, entry);
      else pending.add(id);
    });
    if (pending.size) void fetchPending();
  }
  function scheduleScan() {
    if (scanTimer !== null) return;
    scanTimer = setTimeout(() => { scanTimer = null; scan(); }, 80);
  }
  const target = document.getElementById('mainContainer');
  if (target) {
    new MutationObserver(scheduleScan).observe(target, { childList: true, subtree: true });
    scan();
  }
})(window);
