'use strict';
// Public-only Supabase read client for indexable pages. Never use a service-role key here.
const SOURCE = process.env.KOMI_PUBLIC_SUPABASE_URL || 'https://xebglnnpoutmdcgukbxf.supabase.co';
const KEY = process.env.KOMI_PUBLIC_SUPABASE_KEY || 'sb_publishable_SzKz649coUbxHWXjQfdSXQ_GGzzbHrs';
const CANONICAL = 'https://komianime.online';
function html(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, ch =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}
function safeImage(input) {
  const s = String(input || '');
  try { const url = new URL(s); return url.protocol === 'https:' ? url.href : '/anime-artwork.svg'; }
  catch { return '/anime-artwork.svg'; }
}
function plainText(input) {
  return String(input || '').replace(/<[^>]*>/g, ' ').replace(/\[[^\]]+\]/g,' ')
    .replace(/https?:\/\/\S+/gi,' ').replace(/\s+/g,' ').trim();
}
async function read(table, search) {
  const url = new URL('/rest/v1/' + table, SOURCE);
  for (const [key, value] of Object.entries(search)) url.searchParams.set(key, String(value));
  const response = await fetch(url, {
    headers: { apikey: KEY, accept: 'application/json' },
    signal: AbortSignal.timeout(12000)
  });
  if (!response.ok) throw new Error('Catalog upstream failed (' + response.status + ')');
  const rows = await response.json();
  if (!Array.isArray(rows)) throw new Error('Invalid catalog response');
  return rows;
}
function send(res, status, type, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', type);
  res.setHeader('Cache-Control', status === 200 ? 'public, s-maxage=1800, stale-while-revalidate=86400' : 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(body);
}
module.exports = { SOURCE, CANONICAL, html, safeImage, plainText, read, send };
