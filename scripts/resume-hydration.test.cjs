'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..');
const cache=require('../komi-resume-cache.js');
require('../home-discovery.js');
const discovery=globalThis.KomiHomeDiscovery;
const app=fs.readFileSync(path.join(root,'app-main.js'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const uidA='00000000-0000-4000-8000-000000000001';
const uidB='00000000-0000-4000-8000-000000000002';
const anime=id=>({id:String(id),title:'Anime '+id,poster:'https://images.example.org/'+id+'.webp',
 screenshots:['https://images.example.org/'+id+'-scene.webp'],year:'2026',
 type:'Сериал',shikiRating:8,episodeCount:12,episodes:[]});
const progress=id=>({season:1,index:0,time:22,duration:120,updated:1000+id});
const watch=id=>({anime:anime(id),p:progress(id)});
test('account-scoped resume snapshot expires and never writes secrets',()=>{
 const old=globalThis.sessionStorage,rows=new Map();
 globalThis.sessionStorage={setItem(k,v){rows.set(k,v);},getItem(k){return rows.get(k)??null;},removeItem(k){rows.delete(k);}};
 try{
  const entries=[1,2,3,4,5,6].map(watch);
  entries[0].anime.authToken='secret';
  entries[0].anime.privateFolders=['hidden'];
  cache.write(uidA,entries);
  assert.deepEqual(cache.read(uidB),[]);
  assert.deepEqual(cache.read('not-verified'),[]);
  assert.equal(cache.read(uidA).length,6);
  assert.doesNotMatch([...rows.values()].join(''),/secret|privateFolders|authToken/);
  assert.equal(cache.read(uidA)[0].anime.screenshots.length,1);
  cache.clear(uidA);
  assert.deepEqual(cache.read(uidA),[]);
 } finally {if(old===undefined) delete globalThis.sessionStorage;else globalThis.sessionStorage=old;}
});
test('first render preserves complete owner history even with partial catalog',()=>{
 const entries=[6,5,4,3,2,1].map(watch),currentUser={username:'owner',authUserId:uidA};
 const pending=discovery.recentProgress({
  currentUser,progress:{owner_1:progress(1)},resumePreview:entries,resumeReady:false
 },[anime(1)]);
 assert.deepEqual(pending.map(x=>x.anime.id),['6','5','4','3','2','1']);
 const fullProgress=Object.fromEntries(entries.map(x=>['owner_'+x.anime.id,x.p]));
 const full=discovery.recentProgress({
  currentUser,progress:fullProgress,resumePreview:entries,resumeReady:true
 },entries.map(x=>x.anime));
 assert.deepEqual(full.map(x=>x.anime.id),pending.map(x=>x.anime.id));
 assert.deepEqual(discovery.recentProgress({currentUser:null,resumePreview:entries,resumeReady:false},entries.map(x=>x.anime)),[]);
});
test('pending owner history reserves rail and boot blocks anon-to-member flicker',()=>{
 const context={animeList:[anime(1)],currentUser:{username:'owner',authUserId:uidA},
  progress:{owner_1:progress(1)},resumeReady:false,resumePreview:[],currentSlideIndex:0,
  year:a=>a.year,type:a=>a.type,artwork:a=>a.poster,
  describe:()=>'',renderCard:()=>'<div></div>',recommendations:()=>[],
  calendar:()=>'',years:()=>'',intro:()=>'',quickFilters:()=>''};
 const markup=discovery.render(context);
 assert.match(markup,/komi-resume-loading/);
 assert.equal((markup.match(/komi-resume-placeholder/g)||[]).length,6);
 assert.match(html,/komi-resume-cache\.js/);
 assert.match(app,/KomiResumeCache\?\.read\(session\.user\.id\)/);
 assert.match(app,/komiHomeCatalogReady && komiResumeReadyUid === currentUser\.authUserId/);
 assert.match(app,/komiStoreReadyResume\(\)/);
 assert.match(app,/!komiSessionResolved/);
});
