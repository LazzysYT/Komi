'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {validatePosterSource,cachedPosterUrl,posterApiUrl}=require('../poster-cache-client');
const handler=require('../api/poster');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');

const validShiki='https://shikimori.io/uploads/poster/animes/52991/dc841cc9fce2aa1e9907a4b61c5d1d92.jpeg';
const validOld='https://shikimori.one/system/animes/preview/39894.jpg?1718615729';
const validAniList='https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx189046-yaHWtS5FII46.jpg';
function mockRes() {
  return {headers:{},statusCode:200,ended:false,body:null,
    setHeader(k,v){this.headers[k.toLowerCase()]=v;},
    end(body){this.ended=true;this.body=body;}
  };
}
function mockStream(bytes){return {
  getReader(){let done=false;return {
    async read(){if(done)return {done:true};done=true;return {done:false,value:Uint8Array.from(bytes)};},
    async cancel(){}
  }}
};}
test('only allowlisted public posters are sent to wsrv.nl, other URLs stay direct',()=>{
  for(const url of [validShiki,validOld,validAniList]) {
    assert.equal(validatePosterSource(url),url);
    assert.equal(cachedPosterUrl(url),'https://wsrv.nl/?url='+encodeURIComponent(url)+'&w=360&output=webp');
    assert.equal(cachedPosterUrl(url,1280),'https://wsrv.nl/?url='+encodeURIComponent(url)+'&w=1280&output=webp');
    assert.equal(cachedPosterUrl(url,99999),cachedPosterUrl(url));
    assert.equal(posterApiUrl(url),'/api/poster?src='+encodeURIComponent(url));
  }
  for(const bad of [
    'http://shikimori.io/uploads/poster/animes/1/a.jpg',
    'https://shikimori.io.evil.test/uploads/poster/animes/1/abc.jpeg',
    'https://user:password@shikimori.io/uploads/poster/animes/1/abc.jpeg',
    'https://shikimori.io:8443/uploads/poster/animes/1/abc.jpeg',
    'https://shikimori.io/api/private',
    'https://s4.anilist.co/other/cover.jpeg',
    'https://127.0.0.1/path/image.png',
    'https://shikimori.io/uploads/poster/animes/1/abc.svg',
    validShiki+'?q=arbitrary',
    validShiki+'#fragment'
  ]) assert.equal(validatePosterSource(bad),'','Unsafe poster origin/path accepted: '+bad);
  assert.equal(cachedPosterUrl('https://cdn.myanimelist.net/images/anime/1/a.jpg'),
    'https://cdn.myanimelist.net/images/anime/1/a.jpg');
  assert.equal(posterApiUrl('https://cdn.myanimelist.net/images/anime/1/a.jpg'),
    'https://cdn.myanimelist.net/images/anime/1/a.jpg');
});
test('all pre-rendered public posters use external CDN with direct fallback',()=>{
  const images=[...html.matchAll(/<img\b[^>]*data-poster-direct="https:\/\/(?:shikimori\.io|shikimori\.one|s4\.anilist\.co)[^"]+"[^>]*>/g)];
  assert.ok(images.length>=37,'Initial static poster cache is not attached');
  for(const [tag] of images) {
    assert.match(tag,/src="https:\/\/wsrv\.nl\/\?url=https%3A%2F%2F/);
    assert.match(tag,/&amp;w=360&amp;output=webp/);
    assert.match(tag,/data-komi-error="poster-error"/);
  }
  assert.doesNotMatch(html,/\/api\/poster\?src=/,'Static HTML should not invoke Vercel poster functions');
  assert.ok(html.indexOf('poster-cache-client.js') < html.indexOf('app-main.js'));
});
test('cached poster streams safe image bytes with CDN headers',async()=>{
  const prev=global.fetch;
  let fetched='';
  global.fetch=async(url,opts)=>{
    fetched=url;
    assert.equal(opts.redirect,'manual');
    assert.equal(opts.method,'GET');
    return {status:200,headers:new Headers({'content-type':'image/jpeg','content-length':'4'}),
      body:mockStream([0xff,0xd8,0xff,0xd9])};
  };
  try {
    const res=mockRes();
    await handler({method:'GET',query:{src:validShiki}},res);
    assert.equal(fetched,validShiki);
    assert.equal(res.statusCode,200);
    assert.equal(res.headers['content-type'],'image/jpeg');
    assert.match(res.headers['cache-control'],/s-maxage=2592000/);
    assert.match(res.headers['cache-control'],/max-age=604800/);
    assert.deepEqual([...res.body],[255,216,255,217]);
    assert.equal(res.ended,true);
  } finally {global.fetch=prev;}
});
test('cache API blocks SSRF, redirects, unsupported MIME and over-size images',async()=>{
  const previous=global.fetch;
  try {
    let calls=0;
    global.fetch=async()=>{calls++;return {status:302,headers:new Headers({location:'http://127.0.0.1/'}),body:null};};
    const bad=mockRes();
    await handler({method:'GET',query:{src:'https://localhost/admin'}},bad);
    assert.equal(bad.statusCode,400);
    assert.equal(calls,0);
    for(const response of [
      {status:302,headers:new Headers({location:'https://other.test/img'}),body:null},
      {status:200,headers:new Headers({'content-type':'image/svg+xml'}),body:mockStream([60,115,118,103,62])},
      {status:200,headers:new Headers({'content-type':'image/jpeg','content-length':String(4000000)}),body:mockStream([0])}
    ]) {
      global.fetch=async()=>response;
      const res=mockRes();
      await handler({method:'GET',query:{src:validAniList}},res);
      assert.equal(res.statusCode,502);
      assert.equal(res.headers['cache-control'],'no-store');
    }
  } finally {global.fetch=previous;}
});


test('poster cache follows trusted CDN redirects but never leaves the URL allowlist',async()=>{
  const previous=global.fetch;
  const calls=[];
  const cancel={async cancel(){}};
  try {
    global.fetch=async(url,options)=>{
      calls.push(url);
      assert.equal(options.redirect,'manual');
      if (url===validShiki) return {status:302,headers:new Headers({'location':validAniList}),body:cancel};
      assert.equal(url,validAniList);
      return {status:200,headers:new Headers({'content-type':'image/jpeg','content-length':'4'}),
        body:mockStream([255,216,255,217])};
    };
    const ok=mockRes();
    await handler({method:'GET',query:{src:validShiki}},ok);
    assert.equal(ok.statusCode,200);
    assert.deepEqual(calls,[validShiki,validAniList]);
    assert.deepEqual([...ok.body],[255,216,255,217]);

    for(const destination of [
      'http://127.0.0.1/internal',
      'https://shikimori.io.evil.test/uploads/poster/animes/1/abc.jpg',
      'https://shikimori.io/api/private',
      'javascript:alert(1)'
    ]){
      calls.length=0;
      global.fetch=async(url)=>{
        calls.push(url);
        return {status:302,headers:new Headers({'location':destination}),body:cancel};
      };
      const bad=mockRes();
      await handler({method:'GET',query:{src:validShiki}},bad);
      assert.equal(bad.statusCode,502);
      assert.deepEqual(calls,[validShiki],'Untrusted redirect must never be fetched');
    }

    calls.length=0;
    global.fetch=async(url)=>{
      calls.push(url);
      const next=url===validShiki?validAniList:validShiki;
      return {status:301,headers:new Headers({'location':next}),body:cancel};
    };
    const loop=mockRes();
    await handler({method:'GET',query:{src:validShiki}},loop);
    assert.equal(loop.statusCode,502,'Repeated redirect must fail closed');
    assert.ok(calls.length<=3,'Redirect chain must be bounded');
  } finally { global.fetch=previous; }
});

test('mutable legacy poster URLs keep short CDN and browser freshness',async()=>{
  const prev=global.fetch;
  global.fetch=async()=>({
    status:200,headers:new Headers({'content-type':'image/jpeg','content-length':'4'}),
    body:mockStream([0xff,0xd8,0xff,0xd9])
  });
  try {
    for(const source of [validOld,
      'https://shikimori.io/uploads/poster/animes/1/abc.jpg']) {
      const res=mockRes();
      await handler({method:'GET',query:{src:source}},res);
      assert.equal(res.statusCode,200);
      assert.match(res.headers['cache-control'],/s-maxage=86400/);
      assert.match(res.headers['cache-control'],/max-age=60/);
    }
    const aniList=mockRes();
    await handler({method:'GET',query:{src:validAniList}},aniList);
    assert.equal(aniList.statusCode,200);
    assert.match(aniList.headers['cache-control'],/s-maxage=2592000/);
  } finally {global.fetch=prev;}
});
