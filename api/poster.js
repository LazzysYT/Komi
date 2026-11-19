'use strict';
// Public, bounded poster cache endpoint. No caller-controlled hosts or redirects.
const {validatePosterSource} = require('../poster-cache-client');
const MAX_BYTES = 3 * 1024 * 1024;
// URLs containing a content fingerprint can stay cached much longer without
// hiding future poster updates: when an image changes, its URL changes as well.
// Legacy Shikimori /system/animes/.../<id>.jpg is NOT fingerprinted.
const IMMUTABLE_CACHE_HEADER = 'public, max-age=604800, s-maxage=2592000, stale-while-revalidate=604800';
const MUTABLE_CACHE_HEADER = 'public, max-age=60, s-maxage=86400, stale-while-revalidate=604800';
function posterCacheHeader(source) {
  const url=new URL(source);
  const path=url.pathname;
  const fingerprintedShikimori=/^\/uploads\/poster\/animes\/\d+\/[a-f0-9]{16,}\.(?:jpe?g|png|webp|avif)$/i.test(path);
  const fingerprintedAniList=/^\/file\/anilistcdn\/media\/anime\/cover\/(?:large|medium|extraLarge)\/[A-Za-z0-9_-]+-[A-Za-z0-9_-]{8,}\.(?:jpe?g|png|webp|avif)$/i.test(path);
  return (fingerprintedShikimori || fingerprintedAniList) && !url.search
    ? IMMUTABLE_CACHE_HEADER : MUTABLE_CACHE_HEADER;
}
const TYPES = new Set(['image/jpeg','image/png','image/webp','image/avif','image/gif']);
function sendFailure(res, status) {
  res.statusCode = status;
  res.setHeader('Cache-Control','no-store');
  res.setHeader('Content-Type','text/plain; charset=utf-8');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.end(status === 400 ? 'Invalid poster URL' : 'Poster temporarily unavailable');
}
async function collectLimited(body) {
  if (!body || typeof body.getReader !== 'function') throw Error('Missing body stream');
  const reader = body.getReader();
  let count=0; const buffers=[];
  try {
    while (true) {
      const {value,done}=await reader.read();
      if (done) break;
      const bytes=Buffer.from(value);
      count+=bytes.length;
      if (count > MAX_BYTES) throw Error('Poster too large');
      buffers.push(bytes);
    }
    return Buffer.concat(buffers,count);
  } finally { try { await reader.cancel(); } catch {} }
}
module.exports = async function cachedPoster(req,res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow','GET, HEAD');
    return sendFailure(res,405);
  }
  const source = validatePosterSource(req.query?.src);
  if (!source) return sendFailure(res,400);
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),7500);
  try {
    // Some image CDNs change their image hostname or path. Follow only
    // validated image URLs on our explicit public-host allowlist, never a
    // caller-controlled URL, and never more than two redirects.
    let fetchedUrl=source;
    let upstream;
    for (let hop=0;hop<=2;hop++) {
      upstream=await fetch(fetchedUrl, {
        method:req.method,
        redirect:'manual',
        headers:{Accept:'image/avif,image/webp,image/jpeg,image/png,image/gif'},
        signal:controller.signal
      });
      if (![301,302,303,307,308].includes(upstream.status)) break;
      let next='';
      try {
        const location=upstream.headers.get('location');
        if (location) next=validatePosterSource(new URL(location,fetchedUrl).href);
      } catch {}
      if (!next || next===fetchedUrl || hop===2) return sendFailure(res,502);
      try { await upstream.body?.cancel?.(); } catch {}
      fetchedUrl=next;
    }
    const type=(upstream.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    const length=Number(upstream.headers.get('content-length'));
    if (upstream.status !== 200 || !TYPES.has(type) ||
        (Number.isFinite(length) && length > MAX_BYTES)) return sendFailure(res,502);
    const bytes=req.method==='HEAD'?null:await collectLimited(upstream.body);
    if (bytes && !bytes.length) return sendFailure(res,502);
    res.statusCode=200;
    res.setHeader('Content-Type',type);
    res.setHeader('Cache-Control',posterCacheHeader(fetchedUrl));
    res.setHeader('X-Content-Type-Options','nosniff');
    if (bytes) res.setHeader('Content-Length',String(bytes.length));
    res.end(req.method==='HEAD'?'':bytes);
  } catch(error) {
    console.warn('Poster cache upstream error:',error?.name || 'unknown');
    return sendFailure(res,502);
  } finally { clearTimeout(timeout); }
};
