const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const start=html.indexOf('const komiPresenceSession = crypto.randomUUID();');
const end=html.indexOf('        setInterval(updateOnlinePresence, 8000);',start);
assert.ok(start>=0&&end>start,'aggregate RPC presence code missing');
const source=html.slice(start,end);
assert.doesNotMatch(source,/\.from\(['"]online_users['"]\)/);

function fixture({user=null,online=true,rpcCount=5,cloudRows=[]}={}){
 const logs=[],label={textContent:'Онлайн: проверяем…'};
 let reads=0,rpcs=0,updates=0;
 const ctx=vm.createContext({
  crypto:{randomUUID:()=> '00000000-0000-4000-8000-000000000111'},
  currentUser:user,navigator:{onLine:online},document:{
    hidden:false,getElementById:id=>id==='onlineCountText'?label:null
  }, globalAllOnlineUsersList:[{username:'leak'}], userNotifications:{},
  userFriends:{},updateNotificationsUI:()=>{updates++;},
  AbortController, Number, Error, Map, JSON,
  setTimeout:()=>1,clearTimeout:()=>{}, console:{warn(){}},
  _supabase:{
   from(table) {
    assert.equal(table,'animes','only legacy social refresh is allowed');
    reads++;
    return {select(){return this;},in(){return this;},
      abortSignal(){return Promise.resolve({data:cloudRows,error:null});}};
   },
   rpc(method,payload) {
    rpcs++;logs.push({method,payload});
    return {abortSignal(){return Promise.resolve({data:rpcCount,error:null});}};
   }
  }
 });
 vm.runInContext(source,ctx);
 return {ctx,logs,label,counts:()=>({rpcs,reads,updates}),
  update:()=>vm.runInContext('updateOnlinePresence()',ctx)};
}
test('guest online indicator uses only private RPC and returns aggregate number',async()=>{
 const x=fixture();
 await x.update();
 assert.equal(x.label.textContent,'Онлайн: 5');
 assert.equal(x.counts().rpcs,1);
 assert.equal(x.counts().reads,0);
 assert.equal(x.logs[0].method,'komi_site_presence');
 assert.equal(x.logs[0].payload.p_session,'00000000-0000-4000-8000-000000000111');
 assert.equal(x.ctx.globalAllOnlineUsersList.length,0);
});
test('social refresh remains compatible with existing signed-in legacy users',async()=>{
 const x=fixture({user:{username:'alice'},rpcCount:3,
  cloudRows:[{id:5,content:'{"alice":[{"text":"Hello"}]}'},{id:7,content:'{"alice":["bob"]}'}]});
 await x.update();
 assert.equal(x.label.textContent,'Онлайн: 3');
 assert.equal(x.ctx.userNotifications.alice.length,1);
 assert.equal(x.ctx.userFriends.alice[0],'bob');
 assert.deepEqual(x.counts(),{rpcs:1,reads:1,updates:1});
});
test('offline does not call RPC, and invalid count is not shown',async()=>{
 const offline=fixture({online:false});
 await offline.update();
 assert.equal(offline.counts().rpcs,0);
 assert.equal(offline.label.textContent,'Нет соединения');
 const bad=fixture({rpcCount:-1});
 await bad.update();
 assert.equal(bad.label.textContent,'Онлайн: —');
});
