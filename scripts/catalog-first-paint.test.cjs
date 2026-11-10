const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
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
         limit(n){calls.push(n);return calls.length===1?Promise.resolve({data:first,error:null}):second;}
       };
       return query;
      }
   },
   animeList:[],catalogInitialLoadComplete:false,catalogInitialLoadFailed:false,
   currentUser:null,animeComments:{},userProfiles:{},userAnimeStatuses:{},
   userFriends:{},userNotifications:{},localStorage:{getItem(){return null;}},
   render(){renders.push({loaded:context.catalogInitialLoadComplete,count:context.animeList.length})},
   updateNotificationsUI(){},
   setTimeout(fn,ms){timers.push(ms);return 1;},
   console:{log(){},warn(){},error(e){errors.push(String(e));}},
   Date,Error
 });
 vm.runInContext(source,context);
 return {context,renders,calls,timers,errors,resolveSecond,run:()=>vm.runInContext('loadDataFromCloud()',context)};
}

test('first 48 cards become visible before later API pages resolve',async()=>{
 const x=fixture();
 const pending=x.run();
 await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual(x.renders[0],{loaded:true,count:48});
 assert.equal(x.calls[0],48);
 assert.equal(x.calls[1],500);
 assert.equal(x.context.catalogInitialLoadComplete,true);
 const later=[49,50].map(id=>({shikimori_id:id,data:{title:'Anime '+id},updated_at:'2026-11-10'}));
 x.resolveSecond({data:later,error:null});
 await pending;
 assert.equal(x.context.animeList.length,50);
 assert.deepEqual(x.renders.at(-1),{loaded:true,count:50});
 assert.equal(x.context.catalogInitialLoadFailed,false);
});

test('failed later page keeps first 48 rendered rather than reverting to skeleton',async()=>{
 const x=fixture({data:null,error:{message:'later page offline'}});
 await x.run();
 assert.equal(x.context.catalogInitialLoadComplete,true);
 assert.equal(x.context.animeList.length,48);
 assert.ok(x.renders.every(result=>result.loaded));
 assert.deepEqual(x.timers,[2000]);
});
