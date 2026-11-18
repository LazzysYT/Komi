/* Strict public-poster URL allowlist shared by browser and Vercel Function.
 * Unknown providers are left unchanged by the client; the API never fetches them.
 * Keep this as a plain JS file (no new build dependencies).
 */
(function (root) {
  'use strict';
  const sourceHosts = new Set(['shikimori.io','shikimori.one','s4.anilist.co']);
  const shikimoriUpload = /^\/uploads\/poster\/animes\/[1-9]\d{0,11}\/[A-Za-z0-9_-]{3,120}\.(?:jpe?g|png|webp|avif)$/i;
  const shikimoriLegacy = /^\/system\/animes\/(?:preview|original)\/[1-9]\d{0,11}\.(?:jpe?g|png|webp)$/i;
  const anilistCover = /^\/file\/anilistcdn\/media\/anime\/cover\/(?:large|medium|extraLarge)\/[A-Za-z0-9_-]{3,150}\.(?:jpe?g|png|webp|avif)$/i;
  function validatePosterSource(raw) {
    if (typeof raw !== 'string' || raw.length > 1024 || raw.length < 20) return '';
    let url;
    try { url = new URL(raw); } catch { return ''; }
    if (url.protocol !== 'https:' || !sourceHosts.has(url.hostname) ||
        url.username || url.password || url.port || url.hash) return '';
    const path = url.pathname;
    if (url.hostname === 's4.anilist.co') {
      if (!anilistCover.test(path) || url.search) return '';
    } else {
      if (!shikimoriUpload.test(path) && !shikimoriLegacy.test(path)) return '';
      // Legacy Shikimori poster version parameter is a bare timestamp.
      if (url.search && !/^\?\d{1,15}$/.test(url.search)) return '';
    }
    return url.href;
  }
  function cachedPosterUrl(raw) {
    const checked = validatePosterSource(raw);
    return checked ? '/api/poster?src=' + encodeURIComponent(checked) : String(raw || '');
  }
  const api = { validatePosterSource, cachedPosterUrl };
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) {
    root.komiCachedPosterUrl = cachedPosterUrl;
    root.komiValidatePosterSource = validatePosterSource;
  }
})(typeof globalThis !== 'undefined' ? globalThis : null);
