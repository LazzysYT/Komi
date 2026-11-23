'use strict';
// Run: node tests/navigation-player-v72.test.cjs
// No dependencies, network, Supabase credentials or playback downloads.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = name => fs.readFileSync(path.join(__dirname,'..',name),'utf8');
const slice = (source,from,to) => {
  const start=source.indexOf(from), end=source.indexOf(to,start+from.length);
  assert.ok(start>=0&&end>start,'Missing source section: '+from);
  return source.slice(start,end);
};
async function run() {
  const app=read('app-main.js'), cinema=read('cinema-layout-v3.js'), runtime=read('player-runtime.js');
  const scripts=['app-main.js','cinema-layout-v3.js','player-runtime.js','komi-watch-compact-v6.js','anime-watch-bridge.js','anicoin.js','shop-first-paint.js','komi-home-boot.js','api/anime.js'];
  for (const name of scripts) assert.doesNotThrow(()=>new Function(read(name)),name);
  const routeCode=slice(app,'function komiRouteView()','let currentView = komiRouteView()');
  for (const [pathname,hash,expected] of [
    ['/','','home'], ['/catalog','','catalog'], ['/shop','','shop'], ['/partners','','partners'],
    ['/profile','','profile'], ['/#unused','','home'], ['/','#catalog','catalog'], ['/','#shop','shop'],
    ['/','#profile','profile'], ['/','#partners','partners'], ['/','#premium','premium'],
    ['/anime/42','#player','home'], ['/catalog','#shop','catalog']
  ]) assert.equal(new Function('location',routeCode+'return komiRouteView()')({pathname,hash}),expected);
  const routeNumber=new Function(slice(app,'function komiPositiveRouteNumber','function komiMaybeOpenSeoAnime()')+'return komiPositiveRouteNumber')();
  for(const [input,expected] of [['23',23],['0',null],['-1',null],['1.2',null],['1000000',null],['bad',null]]) assert.equal(routeNumber(input),expected);
  const duration=new Function(slice(cinema,'  function durationLabel(','  function paintEpisodeCaption(')+'return durationLabel')();
  assert.equal(duration(1380),'23 мин');
  assert.equal(duration('23:00'),'23 мин');
  assert.equal(duration(undefined),'');
  assert.equal(duration(Infinity),'');
  const previewCode=slice(cinema,'  function indexEpisodePreviews(','  function captureCurrentFrame(')+slice(cinema,'  function episodePreview(','  function durationLabel(');
  const preview=new Function('URL','location','capturedFrames','frameKey',previewCode+'return {indexEpisodePreviews,actualPreview}')(URL,{origin:'https://komianime.online'},new Map([['1:1:2','data:image/jpeg;base64,test']]),(ctx,i)=>ctx.animeId+':'+ctx.season+':'+i);
  const ctx={animeId:1,season:1,episodeMeta:[{preview:'https://a.test/a.jpg'},{preview:'https://a.test/a.jpg'},{preview:'https://b.test/b.jpg'},{preview:'javascript:bad'},{preview:'/anime-artwork.svg'},{preview:'https://user:pass@a.test/private.jpg'}],failedPreviews:new Set()};
  ctx.uniquePreviews=preview.indexEpisodePreviews(ctx);
  assert.deepEqual(ctx.uniquePreviews,['','','https://b.test/b.jpg','','https://komianime.online/anime-artwork.svg','']);
  ctx.failedPreviews.add('https://b.test/b.jpg');
  assert.equal(preview.actualPreview(ctx,2),'data:image/jpeg;base64,test');
  const share=new Function('URL','location','context',slice(cinema,'  function shareUrl(','  async function shareAnime(')+'return shareUrl(context)');
  assert.equal(share(URL,{origin:'https://komianime.online'},{animeId:'42',season:2,index:0,grid:{querySelectorAll:()=>[{dataset:{episodeNumber:'7'}}]}}),'https://komianime.online/anime/42?season=2&episode=7#player');
  assert.equal(share(URL,{origin:'https://komianime.online'},{animeId:'../bad'}),'https://komianime.online/');
  class MockHls {
    static Events={ERROR:'error',MANIFEST_PARSED:'manifest',LEVELS_UPDATED:'levels',LEVEL_SWITCHED:'switch'};
    static ErrorTypes={NETWORK_ERROR:'network',MEDIA_ERROR:'media'};
    static isSupported(){return true}
    constructor(){this.handlers={};this.levels=[]}
    on(e,f){this.handlers[e]=f}
    loadSource(u){this.url=u}
    attachMedia(v){this.video=v}
    destroy(){this.destroyed=true}
    emit(e,d){this.handlers[e]?.(e,d)}
  }
  class MockEvent{constructor(type){this.type=type}}
  const events=[], video={isConnected:true,canPlayType:()=>'',dispatchEvent:e=>events.push(e.type)};
  let errors=0;
  const attach=new Function('KomiPlayerCore','loadKomiHls','clearTimeout','setTimeout','Event',slice(runtime,'async function attachKomiMedia(','function disposeKomiMedia(')+'return attachKomiMedia')({source:u=>({kind:'hls',url:u})},async()=>MockHls,()=>{},()=>0,MockEvent);
  await attach(video,'https://media.test/test.m3u8',()=>errors++);
  const old=video.komiHls;
  assert.ok(old instanceof MockHls);
  for(const event of ['manifest','levels','switch']) old.emit(event);
  assert.deepEqual(events,Array(3).fill('komi:hls-levels'));
  video.komiMediaToken=null;old.emit('manifest');
  assert.equal(events.length,3);
  await attach(video,'https://media.test/new.m3u8',()=>errors++);
  assert.ok(old.destroyed);
  const next=video.komiHls;
  next.emit('error',{fatal:true,type:'other'});
  assert.equal(video.komiHls,null);assert.ok(next.destroyed);assert.equal(errors,1);assert.equal(events.length,4);
  const config=JSON.parse(read('vercel.json'));
  for(const view of ['catalog','shop','partners','profile']) assert.ok(config.rewrites.some(x=>x.source==='/'+view&&x.destination==='/index.html'));
  assert.ok(config.rewrites.some(x=>x.source==='/anime/:id'));
  assert.ok(config.rewrites.some(x=>x.source==='/sitemap.xml'));
  assert.ok(app.includes('if (komiCatalogLoadPending) return komiCatalogLoadPending;'));
  assert.ok(app.includes('komiPrefetchTimes.length >= 6'));
  assert.ok(app.includes('window.KomiPlayerUX?.disposeCinema?.()'));
  console.log('Komi V7.2 regression checks passed.');
}
run().catch(error=>{console.error(error);process.exitCode=1;});
