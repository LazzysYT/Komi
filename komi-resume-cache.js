/* A small session-only snapshot of the verified account's resume cards.
 * Public artwork/title + playback position only. Never store tokens or profile info.
 * Read ONLY after Supabase getSession confirms the same account uid. */
(function (root) {
  'use strict';
  const PREFIX = 'komi.resume.preview.v1:';
  const TTL = 24 * 60 * 60 * 1000;
  const UID = /^[a-f0-9-]{36}$/i;
  const ID = /^[1-9][0-9]{0,14}$/;
  const safeUrl = value => {
    if (typeof value !== 'string' || value.length > 2048) return '';
    try {
      const u = new URL(value);
      return u.protocol === 'https:' && !u.username && !u.password ? u.href : '';
    } catch { return ''; }
  };
  const finite = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  function clean(row) {
    const anime = row?.anime, p = row?.p;
    const id = String(anime?.id || '');
    if (!ID.test(id) || !anime || !p || !Number.isFinite(Number(p.updated))) return null;
    const screenshot = [row.preview, anime.screenshots?.[0]].map(safeUrl).find(Boolean);
    return {
      anime: {
        id, title: String(anime.title || '').slice(0, 220),
        poster: safeUrl(anime.poster), banner: safeUrl(anime.banner),
        screenshots: screenshot ? [screenshot] : [], episodes: []
      },
      p: {
        season: Math.max(1, Math.floor(finite(p.season))),
        index: Math.max(0, Math.floor(finite(p.index))),
        time: Math.max(0, finite(p.time)),
        duration: Math.max(0, finite(p.duration)),
        updated: Math.max(0, finite(p.updated))
      }
    };
  }
  function read(uid) {
    if (!UID.test(String(uid || ''))) return [];
    try {
      const payload = JSON.parse(root.sessionStorage?.getItem(PREFIX + uid) || 'null');
      if (payload?.version !== 1 || !Number.isFinite(payload.savedAt) ||
          payload.savedAt > Date.now() || Date.now() - payload.savedAt > TTL ||
          !Array.isArray(payload.entries) || payload.entries.length > 8) return [];
      return payload.entries.map(clean).filter(Boolean);
    } catch { return []; }
  }
  function write(uid, entries) {
    if (!UID.test(String(uid || '')) || !Array.isArray(entries)) return;
    try {
      const sanitized = entries.map(clean).filter(Boolean).slice(0, 8);
      root.sessionStorage?.setItem(PREFIX + uid,
        JSON.stringify({version:1, savedAt:Date.now(), entries:sanitized}));
    } catch {} // Incognito/quota errors must not break page rendering.
  }
  function clear(uid) {
    if (!UID.test(String(uid || ''))) return;
    try { root.sessionStorage?.removeItem(PREFIX + uid); } catch {}
  }
  const api = {read,write,clear};
  root.KomiResumeCache = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
