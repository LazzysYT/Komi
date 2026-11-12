const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const test=require('node:test');
const assert=require('node:assert/strict');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8') + '\n' + fs.readFileSync(path.join(__dirname,'../app-main.js'),'utf8');
const from=html.indexOf('async function komiLoadAllOwnedRows(');
const to=html.indexOf('        async function loadAuthenticatedAnimeData()',from);
assert.ok(from>=0 && to>from,'Missing account pagination helper');
const helper=html.slice(from,to);

function fixture(expected,rows) {
  let currentUser={authUserId:'user-a',username:'qa'};
  const calls=[];
  const query={
    select(columns){calls.push({action:'select',columns});return this;},
    eq(key,value){calls.push({action:'eq',key,value});return this;},
    order(key){calls.push({action:'order',key});return this;},
    range(start,end) {
      calls.push({action:'range',start,end});
      return Promise.resolve(expected?.error && start===500
        ?{data:null,error:{message:expected.error}}
        :{data:rows.slice(start,end+1),error:null});
    }
  };
  const context=vm.createContext({currentUser,_supabase:{from(table){calls.push({action:'from',table});return query;}},Error});
  vm.runInContext(helper,context);
  return {context,calls};
}
test('saved statuses above the API row limit are fetched in ordered pages',async()=>{
  const data=Array.from({length:1250},(_,i)=>({anime_id:i+1,status:'Просмотрено'}));
  const {context,calls}=fixture(null,data);
  const result=await vm.runInContext("komiLoadAllOwnedRows('komi_anime_lists','anime_id,status','user-a')",context);
  assert.equal(result.error,null);
  assert.equal(result.data.length,1250);
  assert.deepEqual(calls.filter(x=>x.action==='range').map(x=>[x.start,x.end]),[[0,499],[500,999],[1000,1499]]);
  assert.ok(calls.some(x=>x.action==='order' && x.key==='anime_id'));
  assert.equal(result.data[1249].anime_id,1250);
});
test('saved favorites and watch progress use the same complete paging',async()=>{
  for(const [table,columns] of [
    ['komi_favorites','anime_id,category'],
    ['komi_watch_progress','anime_id,season,episode_index,position_seconds,duration_seconds,updated_at']
  ]){
    const rows=Array.from({length:1001},(_,i)=>({anime_id:i+1}));
    const {context}=fixture(null,rows);
    context.__table=table;context.__columns=columns;
    const result=await vm.runInContext("komiLoadAllOwnedRows(__table,__columns,'user-a')",context);
    assert.equal(result.data.length,1001);
    assert.equal(result.error,null);
  }
});
test('failure on a later page does not return partial user library',async()=>{
  const {context}=fixture({error:'Network error'},Array.from({length:1250},(_,i)=>({anime_id:i+1})));
  const result=await vm.runInContext("komiLoadAllOwnedRows('komi_anime_lists','anime_id,status','user-a')",context);
  assert.equal(result.data.length,0);
  assert.equal(result.error.message,'Network error');
});
test('switching accounts prevents exposing a prior account library',async()=>{
  const {context,calls}=fixture(null,Array.from({length:1250},(_,i)=>({anime_id:i+1})));
  context.currentUser={authUserId:'user-b',username:'another'};
  const result=await vm.runInContext("komiLoadAllOwnedRows('komi_anime_lists','anime_id,status','user-a')",context);
  assert.match(result.error.message,/Аккаунт изменился/);
  assert.equal(result.data.length,0);
  assert.equal(calls.length,0);
});
test('unexpected table and column combination is refused without DB request',async()=>{
  const {context,calls}=fixture(null,[]);
  const result=await vm.runInContext("komiLoadAllOwnedRows('animes','content','user-a')",context);
  assert.match(result.error.message,/Некорректный запрос/);
  assert.equal(calls.length,0);
});
