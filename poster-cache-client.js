/* Strict public-poster URL allowlist shared by browser and Vercel Function.
 * Browser images use a public resizing CDN; the bounded /api/poster endpoint
 * stays available for legacy clients. Unknown providers stay unchanged.
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
  function cachedPosterUrl(raw, width) {
    const checked = validatePosterSource(raw);
    if (!checked) return String(raw || '');
    // Only public, allowlisted anime art may reach the external CDN.
    // Catalog cards use 360 px; full-size banners explicitly request 1280 px.
    const size = [768,1280].includes(Number(width)) ? Number(width) : 360;
    return 'https://wsrv.nl/?url=' + encodeURIComponent(checked) + '&w=' + size + '&output=webp';
  }
  // Social preview crawlers need a stable first-party URL. Keep that
  // low-volume server-side path separate from browser image traffic.
  function posterApiUrl(raw) {
    const checked = validatePosterSource(raw);
    return checked ? '/api/poster?src=' + encodeURIComponent(checked) : String(raw || '');
  }
  const api = { validatePosterSource, cachedPosterUrl, posterApiUrl };
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) {
    root.komiCachedPosterUrl = cachedPosterUrl;
    root.komiValidatePosterSource = validatePosterSource;
  }
})(typeof globalThis !== 'undefined' ? globalThis : null);
