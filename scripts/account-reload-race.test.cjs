const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
function section(from,to) {
  const a=html.indexOf(from), b=html.indexOf(to,a);
  assert.ok(a>=0&&b>a,from);
  return html.slice(a,b);
}
const helpers=section('const komiFavoritePending = new Set();','        async function toggleFavorite(');
const load=section('async function loadAuthenticatedAnimeData()', '        async function persistAuthenticatedStatus(');

test('a confirmed watched status wins over an earlier stale server response',()=>{
 let clock=1000;
 const ctx=vm.createContext({Date:{now:()=>clock},Map,Object});
 vm.runInContext(helpers,ctx);
 clock=1100;
 vm.runInContext("komiRecordCollectionMutation('statuses','owner','12','Просмотрено')",ctx);
 ctx.__rows={'12':'Смотрю','13':'В планах'};
 const merged=vm.runInContext("komiMergeCollectionMutations('statuses','owner',1000,__rows)",ctx);
 assert.equal(merged['12'],'Просмотрено');
 assert.equal(merged['13'],'В планах');
 assert.equal(ctx.__rows['12'],'Смотрю','Original response is never mutated');
});

test('fresh status removal survives a delayed response, including owner isolation',()=>{
 let clock=2000;
 const ctx=vm.createContext({Date:{now:()=>clock},Map,Object});
 vm.runInContext(helpers,ctx);
 vm.runInContext("komiRecordCollectionMutation('statuses','owner','22',null)",ctx);
 ctx.__rows={'22':'Просмотрено','23':'Смотрю'};
 const owner=vm.runInContext("komiMergeCollectionMutations('statuses','owner',1000,__rows)",ctx);
 const unrelated=vm.runInContext("komiMergeCollectionMutations('statuses','other',1000,__rows)",ctx);
 assert.equal(Object.hasOwn(owner,'22'),false);
 assert.equal(unrelated['22'],'Просмотрено');
 assert.equal(owner['23'],'Смотрю');
});

test('old changes are removed when a later server read already includes them',()=>{
 let clock=1000;
 const ctx=vm.createContext({Date:{now:()=>clock},Map,Object});
 vm.runInContext(helpers,ctx);
 vm.runInContext("komiRecordCollectionMutation('favorites','owner','12','Любимые')",ctx);
 ctx.__rows={'12':'Обновлённое избранное'};
 const merged=vm.runInContext("komiMergeCollectionMutations('favorites','owner',1001,__rows)",ctx);
 assert.equal(merged['12'],'Обновлённое избранное');
 assert.equal(vm.runInContext('komiCollectionMutations.favorites.size',ctx),0);
});

test('account list load retains confirmed writes that occur while network is pending',async()=>{
 let clock=1000,release;
 const deferred=new Promise(resolve=>{release=resolve});
 const ctx=vm.createContext({
  Date:{now:()=>clock,parse:Date.parse}, Map,Object,
  currentUser:{authUserId:'owner',username:'owner'},
  _supabase:{}, userAnimeStatuses:{owner:{}},userFavorites:{owner:{}},
  userCustomFolders:{owner:{}}, komiEpisodeProgress:{},userWatchHistory:{},
  komiLoadAllOwnedRows(table) {
    return table==='komi_anime_lists'?deferred:
      Promise.resolve({data:[],error:null});
  },
  komiLoadAllFolderItems:async()=>({data:[],error:null}),
  render(){},
  komiHydrateSavedAnimeCards:async()=>{},
  komiLoadCloudFolders:async()=>{},
  console:{warn(){}}
 });
 vm.runInContext(helpers+load,ctx);
 const pending=vm.runInContext('loadAuthenticatedAnimeData()',ctx);
 clock=1100;
 vm.runInContext("komiRecordCollectionMutation('statuses','owner','12','Просмотрено')",ctx);
 ctx.userAnimeStatuses.owner['12']='Просмотрено';
 release({data:[{anime_id:12,status:'Смотрю'}],error:null});
 await pending;
 assert.equal(ctx.userAnimeStatuses.owner['12'],'Просмотрено');
});

test('older concurrent account loads cannot replace the newer response',async()=>{
 let releaseFirst, n=0;
 const first=new Promise(resolve=>{releaseFirst=resolve});
 const ctx=vm.createContext({
  Date, Map,Object,
  currentUser:{authUserId:'owner',username:'owner'},
  _supabase:{}, userAnimeStatuses:{owner:{}},userFavorites:{owner:{}},
  userCustomFolders:{owner:{}},komiEpisodeProgress:{},userWatchHistory:{},
  komiLoadAllOwnedRows(table) {
    if(table!=='komi_anime_lists')return Promise.resolve({data:[],error:null});
    return n++ === 0 ? first : Promise.resolve({data:[{anime_id:12,status:'Просмотрено'}],error:null});
  },
  komiLoadAllFolderItems:async()=>({data:[],error:null}),
  render(){},
  komiHydrateSavedAnimeCards:async()=>{},
  komiLoadCloudFolders:async()=>{},
  console:{warn(){}}
 });
 vm.runInContext(helpers+load,ctx);
 const old=vm.runInContext('loadAuthenticatedAnimeData()',ctx);
 await vm.runInContext('loadAuthenticatedAnimeData()',ctx);
 releaseFirst({data:[{anime_id:12,status:'Смотрю'}],error:null});
 await old;
 assert.equal(ctx.userAnimeStatuses.owner['12'],'Просмотрено');
});
