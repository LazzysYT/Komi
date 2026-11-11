const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const test=require('node:test'),assert=require('node:assert/strict');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
function segment(a,b){const x=html.indexOf(a),y=html.indexOf(b,x);assert.ok(x>=0&&y>x,'Missing '+a);return html.slice(x,y)}
const folderActions=segment('const pendingFolderWrites = new Set();','        async function postToProfileWall(');
const folderItems=segment('async function addToCustomFolder(', '        // Supabase-owned data is loaded');
const folderLoader=segment('async function komiLoadCloudFolders(', '        async function loadAuthenticatedAnimeData()');
function setup({archive={},failure=null,confirmed=true}={}){
 const calls=[],notices=[],opened=[],stored={komi_custom_folders:JSON.stringify(archive)};
 const names=Object.create(null);
 let user={username:'alice',authUserId:'uid-a'},response=null;
 const q={
  table:'',
  insert(payload){calls.push(['insert',this.table,payload]);return this},
  upsert(payload,opts){calls.push(['upsert',this.table,payload,opts]);return this},
  delete(){calls.push(['delete',this.table]);return this},
  select(){return this},eq(k,v){calls.push(['eq',this.table,k,v]);return this},
  order(){return this},
  range(){return Promise.resolve({data:[],error:null})},
  single(){return Promise.resolve(response||{data:this.table==='komi_custom_folders'?{name:'Моя папка'}:{anime_id:42},error:failure})},
  then(ok,bad){return Promise.resolve(response||{data:[],error:failure}).then(ok,bad)}
 };
 const ctx=vm.createContext({
  _supabase:{from(table){return Object.assign(Object.create(q),{table})}},
  currentUser:user,userCustomFolders:{alice:names},profileActiveTab:'Моя папка',
  window:{},Set,Map,Number,Object,JSON,Error,
  document:{getElementById:()=>({value:'Моя папка'})},
  localStorage:{getItem:k=>stored[k]||null,setItem:(k,v)=>stored[k]=v},
  safeParse:(raw,fallback)=>{try{return JSON.parse(raw)}catch{return fallback}},
  komiStatusFeedback:m=>notices.push(m),
  openAuthModal:x=>opened.push('auth:'+x),
  openWatchModal:x=>opened.push(x),confirm:()=>confirmed,
  saveData:()=>{},render:()=>{},
  console:{warn(){}}
 });
 vm.runInContext(folderActions+folderItems+folderLoader,ctx);
 return {ctx,calls,notices,opened,stored,
  setResponse:r=>response=r,
  create:()=>vm.runInContext('createCustomFolder()',ctx),
  import:()=>vm.runInContext('importLocalCustomFolders()',ctx),
  toggle:(id,name)=>{ctx.testId=id;ctx.testFolder=name;return vm.runInContext('addToCustomFolder(testId,testFolder)',ctx)},
  remove:name=>{ctx.testFolder=name;return vm.runInContext('deleteCustomFolder(testFolder)',ctx)}
 };
}
test('owner-only cloud folder creation requires confirmed server record',async()=>{
 const x=setup();
 await x.create();
 assert.equal(x.calls[0][0],'insert');
 assert.equal(x.calls[0][1],'komi_custom_folders');
 assert.equal(x.calls[0][2].user_id,'uid-a');
 assert.deepEqual(Array.from(x.ctx.userCustomFolders.alice['Моя папка']),[]);
 assert.match(x.notices.at(-1),/создана/);
});
test('server denial cannot fabricate a saved cloud folder',async()=>{
 const x=setup({failure:{message:'RLS denied'}});
 await x.create();
 assert.equal(Object.keys(x.ctx.userCustomFolders.alice).length,0);
 assert.match(x.notices.at(-1),/RLS denied/);
});
test('adding an anime uses owner-only folder item write',async()=>{
 const x=setup();x.ctx.userCustomFolders.alice['Моя папка']=[];
 await x.toggle('42','Моя папка');
 const row=x.calls.find(v=>v[0]==='insert');
 assert.equal(row[1],'komi_folder_items');
 assert.deepEqual([row[2].user_id,row[2].folder_name,row[2].anime_id],['uid-a','Моя папка',42]);
 assert.deepEqual(Array.from(x.ctx.userCustomFolders.alice['Моя папка']),['42']);
});
test('invalid folder names and IDs are rejected before network requests',async()=>{
 const x=setup();x.ctx.userCustomFolders.alice['Моя папка']=[];
 for(const value of ['__proto__','constructor','prototype','Просмотрено',''])assert.equal(x.ctx.komiFolderNameAllowed(value),false);
 await x.toggle('not-an-id','Моя папка');
 await x.toggle('42','__proto__');
 assert.equal(x.calls.length,0);
});
test('local folder import is explicit and uses non-overwriting composite keys',async()=>{
 const x=setup({archive:{alice:{'Моя папка':['42','42','43','invalid','0'],
    '__proto__':['9']},bob:{'Чужая':['33']}}});
 await x.import();
 const folders=x.calls.find(v=>v[0]==='upsert'&&v[1]==='komi_custom_folders');
 const members=x.calls.find(v=>v[0]==='upsert'&&v[1]==='komi_folder_items');
 assert.ok(folders&&members);
 assert.deepEqual(Array.from(folders[2].map(v=>v.name)),['Моя папка']);
 assert.equal(folders[3].ignoreDuplicates,true);
 assert.equal(folders[3].onConflict,'user_id,name');
 assert.deepEqual(Array.from(members[2].map(v=>v.anime_id)),[42,43]);
 assert.equal(members[3].onConflict,'user_id,folder_name,anime_id');
 assert.ok(members[2].every(v=>v.user_id==='uid-a'));
 assert.equal(JSON.parse(x.stored.komi_custom_folders).bob['Чужая'][0],'33');
});
test('cloud folder loading respects account switching and never wipes user data on errors',async()=>{
 const x=setup();x.ctx.userCustomFolders.alice['Моя папка']=['12'];
 x.ctx._supabase={from(){return {select(){return this},eq(){return this},
    order(){return this},range(){return Promise.resolve({data:null,error:{message:'offline'}})}}}};
 await vm.runInContext("komiLoadCloudFolders('uid-a','alice')",x.ctx);
 assert.deepEqual(Array.from(x.ctx.userCustomFolders.alice['Моя папка']),['12']);
 x.ctx.currentUser={username:'bob',authUserId:'uid-b'};
 await vm.runInContext("komiLoadCloudFolders('uid-a','alice')",x.ctx);
 assert.deepEqual(Array.from(x.ctx.userCustomFolders.alice['Моя папка']),['12']);
});


test('stale background load does not delete a newly confirmed folder',async()=>{
 const x=setup();let resolveFolders;
 const deferred=new Promise(resolve=>resolveFolders=resolve);
 x.ctx._supabase={from(table){
   const chain={select(){return this},eq(){return this},order(){return this},
     range(){return table==='komi_custom_folders'?deferred:Promise.resolve({data:[],error:null})}};
   return chain;
 }};
 const pending=vm.runInContext("komiLoadCloudFolders('uid-a','alice')",x.ctx);
 x.ctx.userCustomFolders.alice['Новая папка']=[];
 vm.runInContext('++komiFolderLoadEpoch',x.ctx);
 resolveFolders({data:[],error:null});
 await pending;
 assert.ok(Object.hasOwn(x.ctx.userCustomFolders.alice,'Новая папка'));
});
test('declined local import does not modify cloud data or local archive',async()=>{
 const legacy={alice:{'Личное':['101','102']}};
 const x=setup({archive:legacy,confirmed:false});
 await x.import();
 assert.equal(x.calls.length,0);
 assert.deepEqual(JSON.parse(x.stored.komi_custom_folders),legacy);
});
