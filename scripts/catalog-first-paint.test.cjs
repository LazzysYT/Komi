const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8') + '\n' + fs.readFileSync(path.join(__dirname,'../app-main.js'),'utf8');
const start=html.indexOf('async function loadDataFromCloud(');
const end=html.indexOf('        async function saveAnimeToCloud()',start);
assert.ok(start>=0&&end>start,'Unable to find catalog loader');
const source=html.slice(start,end);
const first=Array.from({length:48},(_,i)=>({
  shikimori_id:i+1,data:{title:'Anime '+(i+1),poster:'',episodeCount:2},updated_at:'2026-11-10T00:00:00Z'
}));

function fixture(secondValue){
 let resolveSecond;
 const second=secondValue===undefined?
   new Promise(resolve=>{resolveSecond=resolve;}):
   Promise.resolve(secondValue);
 const renders=[],errors=[],timers=[],calls=[];
 const context=vm.createContext({
   _supabase:{
      from(table){
       if(table==='animes')return {select(){return this;},in(){return Promise.resolve({data:[],error:null});}};
       if(table!=='komi_catalog_cards')throw Error('unexpected table '+table);
       const query={
         select(){return this;},gt(){return this;},order(){return this;},
         limit(n){calls.push(n);return calls.length===1?Promise.resolve({data:first,error:null}):calls.length===2?second:Promise.resolve({data:[],error:null});}
       };
       return query;
      }
   },
   animeList:[],catalogInitialLoadComplete:false,catalogInitialLoadFailed:false,komiCatalogRevision:0,
   komiHomeCatalogReady:false,komiHomePreviewCatalog:null,currentView:'home',
   komiStoreReadyResume(){},
   window:{KomiHomeSnapshot:{write(){}}},komiAnimeYear:a=>a.year,komiCatalogType:a=>a.type,
   currentUser:null,animeComments:{},userProfiles:{},userAnimeStatuses:{},
   userFriends:{},userNotifications:{},localStorage:{getItem(){return null;}},
   render(){renders.push({loaded:context.catalogInitialLoadComplete,count:context.animeList.length,ready:context.komiHomeCatalogReady})},
   updateNotificationsUI(){},
   setTimeout(fn,ms){timers.push(ms);return 1;},
   console:{log(){},warn(){},error(e){errors.push(String(e));}},
   Date,Error
 });
 vm.runInContext(source,context);
 return {context,renders,calls,timers,errors,resolveSecond,run:()=>vm.runInContext('loadDataFromCloud()',context)};
}

test('the first 48 IDs load for catalog/search but never render a temporary home hero',async()=>{
 const x=fixture();
 const pending=x.run();
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(x.renders.length,0,'Home hero must remain on SEO first paint during partial scan');
 assert.equal(x.context.animeList.length,48);
 assert.equal(x.calls[0],48);
 assert.equal(x.calls[1],1000);
 assert.equal(x.context.catalogInitialLoadComplete,true);
 const later=[49,50].map(id=>({shikimori_id:id,data:{title:'Anime '+id},updated_at:'2026-11-10'}));
 x.resolveSecond({data:later,error:null});
 await pending;
 assert.equal(x.context.animeList.length,50);
 assert.deepEqual(x.calls,[48,1000,1000], 'Page scan continues until the first empty response');
 assert.equal(x.context.komiCatalogRevision,1, 'Full catalog completion invalidates public-list caches');
 assert.deepEqual(x.renders.at(-1),{loaded:true,count:50,ready:true});
 assert.equal(x.context.catalogInitialLoadFailed,false);
});

test('failed later page preserves partial data while SEO first paint stays stable during retry',async()=>{
 const x=fixture({data:null,error:{message:'later page offline'}});
 await x.run();
 assert.equal(x.context.catalogInitialLoadComplete,true);
 assert.equal(x.context.animeList.length,48);
 assert.ok(x.renders.every(result=>result.loaded && !result.ready));
 assert.deepEqual(x.timers,[2000]);
});
