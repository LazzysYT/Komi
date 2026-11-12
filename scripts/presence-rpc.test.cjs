const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8') + '\n' + fs.readFileSync(path.join(__dirname,'../app-main.js'),'utf8');
const start=html.indexOf('const komiPresenceSession = crypto.randomUUID();');
const end=html.indexOf('        setInterval(updateOnlinePresence, 8000);',start);
assert.ok(start>=0&&end>start,'aggregate RPC presence code missing');
const source=html.slice(start,end);
assert.doesNotMatch(source,/\.from\(['"]online_users['"]\)/);

function fixture({user=null,online=true,rpcCount=5}={}){
 const logs=[],label={textContent:'Аккаунтов онлайн: проверяем…'};
 let rpcs=0;
 const ctx=vm.createContext({
  crypto:{randomUUID:()=> '00000000-0000-4000-8000-000000000111'},
  currentUser:user,navigator:{onLine:online},document:{
    hidden:false,getElementById:id=>id==='onlineCountText'?label:null
  }, globalAllOnlineUsersList:[{username:'leak'}],
  AbortController, Number, Error, Map, JSON,
  setTimeout:()=>1,clearTimeout:()=>{}, console:{warn(){}},
  _supabase:{
   from(table) { assert.fail('Unexpected table read during presence update: ' + table); },
   rpc(method,payload) {
    rpcs++;logs.push({method,payload});
    return {abortSignal(){return Promise.resolve({data:rpcCount,error:null});}};
   }
  }
 });
 vm.runInContext(source,ctx);
 return {ctx,logs,label,rpcCalls:()=>rpcs,
  update:()=>vm.runInContext('updateOnlinePresence()',ctx)};
}
test('guest online indicator uses only private RPC and returns aggregate number',async()=>{
 const x=fixture();
 await x.update();
 assert.equal(x.label.textContent,'Аккаунтов онлайн: 5');
 assert.equal(x.rpcCalls(),1);
 assert.equal(x.logs[0].method,'komi_site_presence');
 assert.equal(x.logs[0].payload.p_session,'00000000-0000-4000-8000-000000000111');
 assert.equal(x.ctx.globalAllOnlineUsersList.length,0);
});
test('signed-in presence refresh does not read legacy social data',async()=>{
 const x=fixture({user:{username:'alice',authUserId:'alice-id'},rpcCount:3});
 await x.update();
 assert.equal(x.label.textContent,'Аккаунтов онлайн: 3');
 assert.equal(x.rpcCalls(),1);
});
test('offline does not call RPC, and invalid count is not shown',async()=>{
 const offline=fixture({online:false});
 await offline.update();
 assert.equal(offline.rpcCalls(),0);
 assert.equal(offline.label.textContent,'Нет соединения');
 const bad=fixture({rpcCount:-1});
 await bad.update();
 assert.equal(bad.label.textContent,'Аккаунтов онлайн: —');
});
