/* Public KomiAnime catalog cache, IndexedDB only. No auth/session/account
 * records, watch progress, payment details or episode-source URLs are stored.
 * This is a fast first paint for RETURNING visitors, not a replacement for RLS. */
(function (root) {
  'use strict';
  const NAME='komi-public-catalog-v1';
  const RECORD='latest';
  const TTL=12*60*60*1000;
  const MAX_RECORDS=15000;
  const STRING_FIELDS=[
    'id','title','originalTitle','english','japanese','poster','banner',
    'year','type','genre','status','releaseStatus','animeStatus',
    'nextEpisodeAt','lastEpisodeAddedAt','lastEpisodeNumber',
    'komiCardUpdatedAt','syncStatus','scheduleSource'
  ];
  const NUMBER_FIELDS=['shikimoriId','shikiRating','episodeCount'];
  const ARRAY_FIELDS=['genres','synonyms'];
  let opening=null;
  function project(cards) {
    if (!Array.isArray(cards) || cards.length>MAX_RECORDS) return [];
    const selected=[];
    for (const card of cards) {
      if (!card || !/^[1-9][0-9]{0,11}$/.test(String(card.id??''))) continue;
      const item={id:String(card.id)};
      for(const key of STRING_FIELDS) {
        if(key==='id')continue;
        if(typeof card[key]==='string')item[key]=card[key].slice(0,2048);
      }
      for(const key of NUMBER_FIELDS) {
        const number=Number(card[key]);
        if(card[key]!==undefined&&card[key]!==null&&Number.isFinite(number))
          item[key]=number;
      }
      for(const key of ARRAY_FIELDS) {
        if(Array.isArray(card[key]))
          item[key]=card[key].filter(x=>typeof x==='string').slice(0,24).map(x=>x.slice(0,180));
      }
      item.episodes=[]; // Public cards never contain premium/player source data.
      selected.push(item);
    }
    return selected;
  }
  function open() {
    if (!root.indexedDB) return Promise.resolve(null);
    if(opening)return opening;
    opening=new Promise(resolve=>{
      let request;
      try{request=root.indexedDB.open(NAME,1);}catch{return resolve(null);}
      request.onupgradeneeded=()=>{
        try{
          if(!request.result.objectStoreNames.contains('catalog'))
            request.result.createObjectStore('catalog');
        }catch{}
      };
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>resolve(null);
      request.onblocked=()=>resolve(null);
    });
    return opening;
  }
  async function read() {
    try {
      const db=await open();
      if(!db)return null;
      const record=await new Promise(resolve=>{
        const transaction=db.transaction('catalog','readonly');
        const request=transaction.objectStore('catalog').get(RECORD);
        request.onsuccess=()=>resolve(request.result||null);
        request.onerror=()=>resolve(null);
        transaction.onabort=()=>resolve(null);
      });
      if(!record || record.version!==1 || !Number.isFinite(record.savedAt) ||
          record.savedAt>Date.now()+60000 || Date.now()-record.savedAt>TTL ||
          !Array.isArray(record.items) || record.items.length<48 ||
          record.items.length>MAX_RECORDS) return null;
      const cleaned=project(record.items);
      return cleaned.length===record.items.length ? cleaned : null;
    } catch { return null; }
  }
  async function write(cards) {
    if(!Array.isArray(cards) || cards.length<48 || cards.length>MAX_RECORDS)return false;
    try {
      // Yield rendering before processing the public catalog (~3 MB raw).
      await new Promise(resolve=>{
        if(typeof root.requestIdleCallback==='function')
          root.requestIdleCallback(resolve,{timeout:2500});
        else root.setTimeout(resolve,0);
      });
      const items=project(cards);
      if(items.length!==cards.length)return false;
      const db=await open();
      if(!db)return false;
      return await new Promise(resolve=>{
        const transaction=db.transaction('catalog','readwrite');
        transaction.objectStore('catalog').put({version:1,savedAt:Date.now(),items},RECORD);
        transaction.oncomplete=()=>resolve(true);
        transaction.onerror=()=>resolve(false);
        transaction.onabort=()=>resolve(false);
      });
    } catch { return false; }
  }
  root.KomiPublicCatalogCache={read,write,project};
})(window);
