const {chromium}=require('playwright');
const assert=require('node:assert/strict');

(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.KOMI_CHROME?{executablePath:process.env.KOMI_CHROME}:{})});
 try {
  const page=await browser.newPage({viewport:{width:1280,height:900}});
  await page.route('https://**/*',route=>route.fulfill({status:200,contentType:'application/json',body:'{}'}));
  await page.goto(process.env.KOMI_TEST_URL||'http://127.0.0.1:8765',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>typeof createCustomFolder==='function'&&typeof komiLoadCloudFolders==='function');
  const result=await page.evaluate(async()=>{
   const ownerName='qa_cloud_browser',folder='Моя папка';
   const original={currentUser,supabase:_supabase,render,saveData,watch:openWatchModal,
    accountFolders:userCustomFolders[ownerName],
    folderName:document.getElementById('newFolderNameInput'),
    tab:profileActiveTab};
   const input=document.createElement('input');
   input.id='newFolderNameInput';input.value=folder;document.body.append(input);
   const serverFolders=new Map(),serverItems=new Map();
   const calls=[];
   const key=(uid,name)=>uid+':'+name;
   const mock={
    from(table){
      const q={
        filters:{},sort:[],rows:null,operation:null,
        insert(row){
          calls.push(['insert',table,row]);
          if(table==='komi_custom_folders'){
            serverFolders.set(key(row.user_id,row.name),true);
            this.rows={name:row.name};
          }else{
            const k=key(row.user_id,row.folder_name);
            serverItems.set(k,new Set([...(serverItems.get(k)||[]),Number(row.anime_id)]));
            this.rows={anime_id:row.anime_id};
          }
          return this;
        },
        delete(){this.operation='delete';calls.push(['delete',table]);return this},
        eq(column,value){this.filters[column]=value;return this},
        order(){return this},
        select(){return this},
        single(){return Promise.resolve({data:this.rows,error:null})},
        range(){
          if(table==='komi_custom_folders'){
            const data=[...serverFolders.keys()]
              .filter(k=>k.startsWith(this.filters.user_id+':'))
              .map(k=>({name:k.slice(this.filters.user_id.length+1)}));
            return Promise.resolve({data,error:null});
          }
          const data=[];
          for(const [k,items] of serverItems) {
            if(!k.startsWith(this.filters.user_id+':'))continue;
            const name=k.slice(this.filters.user_id.length+1);
            for(const id of items)data.push({folder_name:name,anime_id:id});
          }
          return Promise.resolve({data,error:null});
        },
        then(done,fail){
          if(this.operation==='delete'){
            if(table==='komi_custom_folders'){
              const k=key(this.filters.user_id,this.filters.name);
              const existed=serverFolders.delete(k);serverItems.delete(k);
              return Promise.resolve({data:existed?[{name:this.filters.name}]:[],error:null}).then(done,fail);
            }
            const k=key(this.filters.user_id,this.filters.folder_name);
            const items=serverItems.get(k)||new Set();
            items.delete(Number(this.filters.anime_id));
          }
          return Promise.resolve({data:[],error:null}).then(done,fail);
        }
      };
      return q;
    }
   };
   try{
    render=()=>{};saveData=()=>{};openWatchModal=()=>{};
    _supabase=mock;
    currentUser={username:ownerName,authUserId:'qa-uid-1'};
    userCustomFolders[ownerName]=Object.create(null);
    await createCustomFolder();
    const made=Array.isArray(userCustomFolders[ownerName][folder]);
    await addToCustomFolder(42,folder);
    const saved=userCustomFolders[ownerName][folder].map(String);
    await komiLoadCloudFolders('qa-uid-1',ownerName);
    const reloaded=userCustomFolders[ownerName][folder].map(String);
    currentUser={username:ownerName,authUserId:'qa-uid-2'};
    await komiLoadCloudFolders('qa-uid-2',ownerName);
    const otherFolders=Object.keys(userCustomFolders[ownerName]);
    return {made,saved,reloaded,otherFolders,calls};
   }finally{
    currentUser=original.currentUser;_supabase=original.supabase;
    render=original.render;saveData=original.saveData;openWatchModal=original.watch;
    profileActiveTab=original.tab;
    if(original.accountFolders===undefined)delete userCustomFolders[ownerName];
    else userCustomFolders[ownerName]=original.accountFolders;
    input.remove();
   }
  });
  assert.equal(result.made,true);
  assert.deepEqual(result.saved,['42']);
  assert.deepEqual(result.reloaded,['42']);
  assert.deepEqual(result.otherFolders,[]);
  assert.ok(result.calls.some(c=>c[0]==='insert'&&c[1]==='komi_custom_folders'&&c[2].user_id==='qa-uid-1'));
  assert.ok(result.calls.some(c=>c[0]==='insert'&&c[1]==='komi_folder_items'&&c[2].anime_id===42));
  console.log('PASS cloud folder create, membership, reload and isolation in browser (mock RLS API)');
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
