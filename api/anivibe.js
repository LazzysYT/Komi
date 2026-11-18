'use strict';
/**
 * KomiAnime <-> AniVibe partner bridge.
 *
 * Only the Vercel server sees ANIVIBE_API_KEY. The partner supplies a signed
 * iframe, never MP4/HLS files. Partner iframe display is deliberately
 * disabled until its advertising and redistribution terms have been checked.
 */
const API = 'https://anivibe.pro';
const SITE = 'https://komianime.online';
const MAX_JSON = 128 * 1024;
const HEALTH_TTL_MS = 5 * 60_000;
const healthCache = {until:0,value:null};
const recentIpRequests = new Map();
const availabilityCache = new Map();
const AVAILABILITY_TTL_MS = 15 * 60_000;
const MAX_AVAILABILITY_CACHE = 64;

// Prefer explicit Russian AUDIO metadata; subtitles and studio brand names
// alone do not prove that a Russian audio track exists.
function russianAudioLanguage(value) {
  return typeof value === 'string' && /^(?:ru|ru-ru|russian|русск(?:ий|ая|ое))(?:\s|$)/i.test(value.trim());
}
function explicitRussianAudio(track, depth=0) {
  if (!track || typeof track !== 'object' || depth > 4) return false;
  if (Array.isArray(track)) return track.some(item=>explicitRussianAudio(item,depth+1));
  if (['language','lang','audio_language','audioLanguage','dub_language','dubLanguage','locale']
    .some(key=>russianAudioLanguage(track[key]))) return true;
  return Object.entries(track).some(([key,value])=>
    /^(?:audio|audios|dubs|dub|voice|voices|voiceover|voiceovers|tracks|translations)$/i.test(key)
    && explicitRussianAudio(value,depth+1));
}
function episodeRows(payload) {
  const obj=payload && typeof payload==='object' ? payload : {};
  const data=obj.data && typeof obj.data==='object' ? obj.data : obj;
  const collections=[data.episodes,data.items,data.results,obj.episodes,obj.items,obj.results,data,obj];
  return collections.find(Array.isArray) || null;
}
function summarizeAvailability(status,payload) {
  if(status===404) return {available:false,episodeCount:0,russianAudioEpisodes:0,russianAudio:'unconfirmed',adFreeConfirmed:false};
  if(status!==200) return {available:null,episodeCount:null,russianAudioEpisodes:0,russianAudio:'unconfirmed',adFreeConfirmed:false};
  const episodes=episodeRows(payload);
  // An HTTP 200 without a recognizable episode array is not proof of availability.
  if(!episodes) return {available:null,episodeCount:null,russianAudioEpisodes:0,russianAudio:'unconfirmed',adFreeConfirmed:false};
  const bounded=episodes.slice(0,1500);
  const russianAudioEpisodes=bounded.filter(episode=>{
    if(!episode || typeof episode!=='object') return false;
    return Object.entries(episode).some(([key,value])=>
      /^(?:audio|audios|dubs|dub|voice|voices|voiceover|voiceovers|tracks|translations)$/i.test(key)
      && explicitRussianAudio(value,0));
  }).length;
  return {
    available:episodes.length>0,
    episodeCount:episodes.length,
    russianAudioEpisodes,
    russianAudio:russianAudioEpisodes ? 'metadata_evidence' : 'unconfirmed',
    // A language tag cannot prove the absence of ads in a third-party iframe.
    adFreeConfirmed:false
  };
}
async function checkAvailability(id,key,fetchFn=fetch) {
  const result=await callPartner('/api/v1/anime/'+id+'/episodes',key,fetchFn);
  return summarizeAvailability(result.status,result.data);
}


function integer(value, max) {
  const raw = String(value ?? '');
  if (!/^[1-9]\d{0,9}$/.test(raw)) return null;
  const n = Number(raw);
  return Number.isSafeInteger(n) && n <= max ? n : null;
}
function partnerUrl(raw) {
  try {
    const url = new URL(String(raw || ''));
    if (url.protocol !== 'https:' || url.username || url.password || url.port ||
        (url.hostname !== 'anivibe.pro' && !url.hostname.endsWith('.anivibe.pro'))) return '';
    return url.href;
  } catch { return ''; }
}
function iframeUrl(payload) {
  const obj = payload?.data && typeof payload.data === 'object' ? payload.data : payload;
  const candidates = [
    obj?.iframe_url, obj?.embed_url, obj?.embedUrl, obj?.iframeUrl,
    obj?.player_url, obj?.playerUrl, obj?.url
  ];
  return candidates.map(partnerUrl).find(Boolean) || '';
}
function credential(key) {
  return typeof key === 'string' && key.trim().length >= 8 && !/[\r\n]/.test(key)
    ? key.trim() : '';
}
function parseJson(body) {
  if (typeof body === 'string') {
    if (body.length > 4096) return null;
    try { return JSON.parse(body); } catch { return null; }
  }
  return body && typeof body === 'object' ? body : null;
}
async function callPartner(resource, key, fetchFn = fetch, input = null) {
  const url = new URL(resource, API);
  if (url.origin !== API || !url.pathname.startsWith('/api/v1/')) throw Error('Invalid partner API path');
  const response = await fetchFn(url.href, {
    method: input ? 'POST' : 'GET',
    headers: {
      'X-Api-Key': key,
      Accept: 'application/json',
      ...(input ? {'Content-Type':'application/json'} : {})
    },
    ...(input ? {body: JSON.stringify(input)} : {}),
    redirect: 'error',
    signal: AbortSignal.timeout(8500)
  });
  if (!response.ok) return {status: response.status, data:null};
  const length = Number(response.headers.get('content-length'));
  if (Number.isFinite(length) && length > MAX_JSON) throw Error('Partner response too large');
  const text = await response.text();
  if (text.length > MAX_JSON) throw Error('Partner response too large');
  let data;
  try { data = JSON.parse(text); } catch { throw Error('Invalid partner JSON'); }
  return {status:response.status,data};
}
async function checkPartner(key, fetchFn = fetch) {
  const me = await callPartner('/api/v1/partner/me',key,fetchFn);
  if (me.status === 401 || me.status === 403) {
    return {connection:'rejected', sampleAnime:'skipped'};
  }
  if (me.status !== 200) {
    return {connection:'unavailable', sampleAnime:'skipped'};
  }
  const anime = await callPartner('/api/v1/anime/52991',key,fetchFn);
  return {connection:'connected',sampleAnime:anime.status === 200 ? 'found'
    : anime.status === 404 ? 'not_found' : 'unavailable'};
}
function requestAllowed(req) {
  const h = req.headers || {};
  const origin = String(h.origin || '');
  const site = String(h['sec-fetch-site'] || '');
  const host = String(h['x-forwarded-host'] || h.host || '').toLowerCase();
  return origin === SITE && host === 'komianime.online' && 
    (!site || site === 'same-origin');
}
function limitRequest(req, now=Date.now()) {
  const raw=String(req.headers?.['x-vercel-forwarded-for'] || req.headers?.['x-forwarded-for'] || 'unknown');
  const ip=raw.split(',')[0].trim().slice(0,80);
  for(const [k,v] of recentIpRequests) if(now-v.until>0) recentIpRequests.delete(k);
  if(recentIpRequests.size>500) recentIpRequests.clear();
  const prev=recentIpRequests.get(ip);
  const record=prev && prev.until>now ? prev : {until:now+60_000,count:0};
  record.count++;
  recentIpRequests.set(ip,record);
  return record.count<=6; // best-effort per-instance bound, not a global quota
}
function send(res,status,body) {
  res.statusCode=status;
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.end(JSON.stringify(body));
}
async function handler(req,res) {
  const key=credential(process.env.ANIVIBE_API_KEY);
  if(req.method === 'GET') {
    if(String(req.query?.check || '') === '1') {
      if (!key) return send(res,503,{service:'anivibe',connection:'not_configured',embedEnabled:false});
      try {
        const now=Date.now();
        if(healthCache.until <= now || !healthCache.value) {
          healthCache.value=await checkPartner(key);
          healthCache.until=now+HEALTH_TTL_MS;
        }
        return send(res,200,{
          service:'anivibe', ...healthCache.value,
          embedEnabled:process.env.ANIVIBE_PARTNER_EMBED_ENABLED === 'true'
        });
      } catch {
        return send(res,502,{service:'anivibe',connection:'unreachable',sampleAnime:'skipped',embedEnabled:false});
      }
    }
    // Read-only, bounded diagnostics by exact Shikimori ID. No signed tokens,
    // video URLs or unvetted provider titles are ever returned here.
    const id=integer(req.query?.availability,100000000);
    if(!id) return send(res,404,{error:'not_found'});
    if(!key) return send(res,503,{service:'anivibe',availability:'not_configured'});
    const now=Date.now();
    const cached=availabilityCache.get(id);
    if(cached && cached.until>now)
      return send(res,200,{service:'anivibe',shikimoriId:id,...cached.summary});
    if(!limitRequest(req)) return send(res,429,{error:'rate_limited'});
    try {
      const summary=await checkAvailability(id,key);
      if(availabilityCache.size>=MAX_AVAILABILITY_CACHE) availabilityCache.clear();
      availabilityCache.set(id,{until:now+AVAILABILITY_TTL_MS,summary});
      return send(res,200,{service:'anivibe',shikimoriId:id,...summary});
    } catch {
      return send(res,502,{error:'partner_unreachable'});
    }
  }
  if(req.method !== 'POST') {
    res.setHeader('Allow','GET, POST');
    return send(res,405,{error:'method_not_allowed'});
  }
  // Never display an unverified partner iframe by simply adding a key.
  if (process.env.ANIVIBE_PARTNER_EMBED_ENABLED !== 'true')
    return send(res,403,{error:'partner_embed_not_approved'});
  if(!requestAllowed(req) || !/^application\/json(?:;|$)/i.test(String(req.headers?.['content-type'] || '')))
    return send(res,403,{error:'request_not_allowed'});
  if(!limitRequest(req)) return send(res,429,{error:'rate_limited'});
  if(!key) return send(res,503,{error:'partner_not_configured'});
  const input=parseJson(req.body);
  const animeId=integer(input?.shikimoriId,100000000);
  const episode=integer(input?.episode,1000);
  if (!animeId || !episode) return send(res,400,{error:'invalid_anime_or_episode'});
  try {
    const response=await callPartner('/api/v1/embed-token',key,fetch,{
      anime_id:animeId,episode,origin:SITE
    });
    if (response.status === 404) return send(res,404,{error:'episode_unavailable'});
    if (response.status === 401 || response.status === 403) return send(res,502,{error:'partner_access_denied'});
    if (response.status === 429) return send(res,429,{error:'partner_quota_exceeded'});
    if (response.status !== 200) return send(res,502,{error:'partner_unavailable'});
    const url=iframeUrl(response.data);
    if (!url) return send(res,502,{error:'partner_embed_response_invalid'});
    return send(res,200,{url,kind:'embed',provider:'AniVibe'});
  } catch {
    return send(res,502,{error:'partner_unreachable'});
  }
}
module.exports=handler;
module.exports.internals={integer,partnerUrl,iframeUrl,credential,parseJson,callPartner,checkPartner,checkAvailability,summarizeAvailability,episodeRows,explicitRussianAudio,requestAllowed,limitRequest};
