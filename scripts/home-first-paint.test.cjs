'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const snapshot=require('../komi-home-snapshot.js');
const app=fs.readFileSync(path.join(__dirname,'../app-main.js'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const year=a=>String(a.year);
const type=a=>a.type;
const make=(i,y,score)=>({
  id:String(i),title:'Title '+i,poster:'https://cdn.example.org/'+i+'.jpg',
  banner:'https://cdn.example.org/'+i+'-banner.jpg',year:String(y),
  shikiRating:score,genre:'Экшен',genres:['Экшен'],
  desc:'Safe preview',type:'Сериал',episodeCount:12,
  lastEpisodeAddedAt:new Date(Date.now()-i*1000).toISOString(),
  user_id:'should-never-be-cached',privateProgress:'never'
});
test('complete preview selects latest featured titles, not the first 48 low-ID rows',()=>{
  const first=Array.from({length:48},(_,i)=>make(i+1,2007,7));
  const rest=Array.from({length:90},(_,i)=>make(i+49,2026,8+i/100));
  const full=[...first,...rest];
  const featured=items=>[...items].filter(a=>a.poster).sort((a,b)=>
    Number(year(b))-Number(year(a)) || Number(b.shikiRating)-Number(a.shikiRating))
    .slice(0,5).map(a=>String(a.id));
  const result=snapshot.sample(full,year,type);
  assert.deepEqual(featured(result),featured(full));
  assert.notDeepEqual(featured(first),featured(full));
  assert.ok(result.length>=5&&result.length<=150);
  for(const card of result){
    assert.equal(card.episodes.length,0);
    assert.equal('user_id' in card,false);
    assert.equal('privateProgress' in card,false);
  }
});
test('public preview cache can be read immediately but expires and fails closed',()=>{
  const original=globalThis.localStorage;
  const map=new Map();
  globalThis.localStorage={getItem:key=>map.get(key)||null,setItem:(key,value)=>map.set(key,String(value))};
  try{
    const catalog=Array.from({length:80},(_,i)=>make(i+1,i>=48?2026:2007,8));
    snapshot.write(catalog,year,type);
    assert.equal(snapshot.read()?.length>5,true);
    const parsed=JSON.parse(map.get(snapshot.KEY));
    assert.equal(parsed.items[0].user_id,undefined);
    parsed.savedAt=Date.now()-73*60*60*1000;
    map.set(snapshot.KEY,JSON.stringify(parsed));
    assert.equal(snapshot.read(),null);
    map.set(snapshot.KEY,'invalid json');
    assert.equal(snapshot.read(),null);
  }finally{if(original===undefined)delete globalThis.localStorage;else globalThis.localStorage=original;}
});
test('home never paints the first catalog batch and keeps SEO first paint without JS',()=>{
  assert.match(html,/class="anime-card komi-seo-card"/);
  assert.match(html,/src="\.\/komi-home-snapshot\.js"/);
  assert.match(app,/if \(currentView !== 'home'\) render\(\)/);
  assert.match(app,/if \(!komiHomeCatalogReady && !komiHomePreviewCatalog\)/);
  assert.match(app,/animeList: komiHomeCatalogReady \? animeList : komiHomePreviewCatalog/);
  assert.match(app,/komiLastHomeMarkup === homeMarkup/);
  assert.match(app,/area\.dataset\.komiHeaderKey === headerKey/);
});
