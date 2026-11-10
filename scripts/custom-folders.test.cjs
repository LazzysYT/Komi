const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');

const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const legacy=fs.readFileSync(path.join(__dirname,'../legacy-import.js'),'utf8');
function part(from,to) {
  const start=html.indexOf(from),end=html.indexOf(to,start);
  assert.ok(start>=0&&end>start,from);
  return html.slice(start,end);
}
const createSource=part('const pendingFolderWrites = new Set();','        async function postToProfileWall(');
const toggleSource=part('async function addToCustomFolder(', '        // Supabase-owned data is loaded');

function fixture() {
  const calls=[],notifications=[],opened=[],saved=[];
  let nextResponse=null, deferred=null;
  const input={value:'Моя папка'};
  const ctx=vm.createContext({
    Set,
    Number,
    currentUser:{authUserId:'owner-uuid',username:'alex'},
    userCustomFolders:{alex:Object.create(null)},
    document:{getElementById:id=>id==='newFolderNameInput'?input:null},
    komiStatusFeedback:msg=>notifications.push(msg),
    openWatchModal:id=>opened.push(id),
    openAuthModal:mode=>opened.push('auth:'+mode),
    saveData:()=>saved.push('saved'),
    render:()=>{},
    _supabase:{
      from(table) {
        const b={
          insert(payload){calls.push({table,kind:'insert',payload});return b;},
          delete(){calls.push({table,kind:'delete'});return b;},
          eq(column,value){calls.push({table,kind:'where',column,value});return b;},
          select(){return b;},
          single() {
            if(deferred)return deferred;
            const insert=calls.filter(x=>x.table===table&&x.kind==='insert').at(-1);
            return Promise.resolve(nextResponse||{data:table==='komi_custom_folders'?
              {name:insert?.payload.name}:{anime_id:insert?.payload.anime_id},error:null});
          },
          then(resolve,reject){return Promise.resolve(nextResponse||{error:null}).then(resolve,reject);}
        };
        return b;
      }
    }
  });
  vm.runInContext(legacy,ctx);
  vm.runInContext(createSource+toggleSource,ctx);
  return {ctx,calls,notifications,opened,saved,input,setResponse:r=>nextResponse=r,
    defer:p=>deferred=p,runCreate:()=>vm.runInContext('createCustomFolder()',ctx),
    runToggle:(animeId,folder)=>{ctx.__id=animeId;ctx.__folder=folder;
      return vm.runInContext('addToCustomFolder(__id,__folder)',ctx);}
  };
}

test('folder creation stores owner UUID and reports server-confirmed success',async()=>{
 const x=fixture();
 await x.runCreate();
 assert.equal(x.calls[0].table,'komi_custom_folders');
 assert.equal(x.calls[0].payload.user_id,'owner-uuid');
 assert.equal(x.calls[0].payload.name,'Моя папка');
 assert.deepEqual(Array.from(x.ctx.userCustomFolders.alex['Моя папка']),[]);
 assert.equal(x.saved.length,1);
 assert.match(x.notifications.at(-1),/создана/);
});

test('RLS errors never add local folders as if stored',async()=>{
 const x=fixture();
 x.setResponse({data:null,error:{message:'RLS rejected'}});
 await x.runCreate();
 assert.ok(!Object.hasOwn(x.ctx.userCustomFolders.alex,'Моя папка'));
 assert.equal(x.saved.length,0);
 assert.match(x.notifications.at(-1),/RLS rejected/);
});

test('a valid folder item is saved for the signed-in owner before UI update',async()=>{
 const x=fixture();
 x.ctx.userCustomFolders.alex['Моя папка']=[];
 await x.runToggle('42','Моя папка');
 const insert=x.calls.find(c=>c.table==='komi_folder_items'&&c.kind==='insert');
 assert.equal(insert.payload.user_id,'owner-uuid');
 assert.equal(insert.payload.folder_name,'Моя папка');
 assert.equal(insert.payload.anime_id,42);
 assert.deepEqual(Array.from(x.ctx.userCustomFolders.alex['Моя папка']),['42']);
 assert.deepEqual(x.opened,['42']);
});

test('folder item deletion removes exactly the selected owner, name and anime',async()=>{
 const x=fixture();
 x.ctx.userCustomFolders.alex['Моя папка']=['42'];
 await x.runToggle('42','Моя папка');
 assert.ok(x.calls.some(c=>c.kind==='delete'));
 assert.deepEqual(x.calls.filter(c=>c.kind==='where').map(c=>[c.column,c.value]),[
  ['user_id','owner-uuid'],['folder_name','Моя папка'],['anime_id',42]
 ]);
 assert.equal(x.ctx.userCustomFolders.alex['Моя папка'].length,0);
});

test('invalid folder name or anime ID cannot reach the database',async()=>{
 const x=fixture();
 x.ctx.userCustomFolders.alex['__proto__']=[];
 await x.runToggle('not-a-number','Моя папка');
 await x.runToggle('12','__proto__');
 assert.equal(x.calls.length,0);
});

test('changing accounts during async write never contaminates a second user',async()=>{
 const x=fixture();
 let resolve;
 x.defer(new Promise(ok=>resolve=ok));
 const pending=x.runCreate();
 x.ctx.currentUser={authUserId:'other-uuid',username:'alex'};
 resolve({data:{name:'Моя папка'},error:null});
 await pending;
 assert.ok(!Object.hasOwn(x.ctx.userCustomFolders.alex,'Моя папка'));
 assert.equal(x.saved.length,0);
});


test('folder membership loads every page without the Supabase 1000-row truncation',async()=>{
 const loadSource=part('async function komiLoadAllFolderItems(', '        // Supabase-owned data is loaded');
 const items=Array.from({length:1003},(_,i)=>({folder_name:'Моя папка',anime_id:i+1}));
 const ranges=[];
 const chain={
  select(){return this;},
  eq(){return this;},
  order(){return this;},
  range(start,end){ranges.push([start,end]);return Promise.resolve({data:items.slice(start,end+1),error:null});}
 };
 const ctx=vm.createContext({currentUser:{authUserId:'owner-uuid'},_supabase:{from:()=>chain},Error});
 vm.runInContext(loadSource,ctx);
 const result=await vm.runInContext("komiLoadAllFolderItems('owner-uuid')",ctx);
 assert.equal(result.error,null);
 assert.equal(result.data.length,1003);
 assert.deepEqual(ranges,[[0,499],[500,999],[1000,1499]]);
});

test('folder pagination fails closed if signed-in account changed',async()=>{
 const loadSource=part('async function komiLoadAllFolderItems(', '        // Supabase-owned data is loaded');
 const ctx=vm.createContext({currentUser:{authUserId:'other-owner'},_supabase:{from(){throw Error('unexpected query')}},Error});
 vm.runInContext(loadSource,ctx);
 const result=await vm.runInContext("komiLoadAllFolderItems('owner-uuid')",ctx);
 assert.equal(result.data.length,0);
 assert.match(result.error.message,/Аккаунт/);
});
