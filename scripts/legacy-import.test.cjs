const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const ctx=vm.createContext({});vm.runInContext(fs.readFileSync(path.join(__dirname,'../legacy-import.js'),'utf8'),ctx);
test('legacy import copies validated personal lists only and assigns current owner',()=>{
 const archive={statuses:{old:{'12':'Смотрю','13':'admin','evil':'В планах','9007199254740999':'Смотрю'}},favorites:{old:{'12':'Любимые'}},role:'admin'};
 const before=JSON.stringify(archive);const result=ctx.komiLegacyImportRows(archive,'old','verified-owner');
 assert.equal(result.lists.length,1);assert.equal(result.favorites.length,1);
 assert.equal(result.lists[0].user_id,'verified-owner');assert.equal(result.lists[0].anime_id,12);
 assert.equal(JSON.stringify(archive),before);assert.equal(result.role,undefined);
});
test('missing local source is empty and cannot import another source implicitly',()=>{
 const result=ctx.komiLegacyImportRows({statuses:{someone:{12:'Смотрю'}}},'absent','owner');assert.equal(result.lists.length,0);
});


test('legacy watch progress belongs only to the selected source and keeps episode position',()=>{
 const archive={progress:{
  'old_12':{season:2,index:5,time:391.9,duration:1400.8},
  'other_12':{season:1,index:1,time:99,duration:100},
  'old_13':{season:-2,index:1,time:30,duration:100},
  'old_14':{season:1,index:1,time:-10,duration:100},
  'old_15':{season:1,index:1,time:30,duration:Infinity},
  'old_9007199254740999':{season:1,index:1,time:30,duration:100}
 }};
 const original=JSON.stringify(archive);
 const rows=ctx.komiLegacyImportRows(archive,'old','signed-in-owner');
 assert.equal(rows.progress.length,1);
 const item=rows.progress[0];
 assert.equal(item.user_id,'signed-in-owner');
 assert.equal(item.anime_id,12);
 assert.equal(item.season,2);
 assert.equal(item.episode_index,5);
 assert.equal(item.position_seconds,391);
 assert.equal(item.duration_seconds,1400);
 assert.equal(JSON.stringify(archive),original);
});

test('progress keys cannot cross a similar nickname prefix',()=>{
 const rows=ctx.komiLegacyImportRows({
  progress:{'old_22':{season:1,index:0,time:12,duration:100},
            'old_extra_23':{season:1,index:0,time:16,duration:100}}
 },'old','verified-owner');
 assert.equal(rows.progress.length,1);
 assert.equal(rows.progress[0].anime_id,22);
});


test('legacy folder import includes only valid selected-user folders and deduplicates anime IDs',()=>{
 const archive={folders:{
  alice: {
   'Сёнен':['12',12,'13','invalid','0','9007199254740999'],
   '__proto__':['14'],
   'Просмотрено':['15'],
   'too-long-name-abcdefghijklmnopqrstuvwxyz-1234':['16'],
   'Манга':['23']
  },
  bob: {'Личное':['99']}
 }};
 const before=JSON.stringify(archive);
 const result=ctx.komiLegacyImportRows(archive,'alice','verified-owner');
 assert.deepEqual(Array.from(result.folders.map(x=>x.name)),['Сёнен','Манга']);
 assert.deepEqual(Array.from(result.folderItems.map(x=>[x.folder_name,x.anime_id])),
  [['Сёнен',12],['Сёнен',13],['Манга',23]]);
 assert.ok(result.folderItems.every(x=>x.user_id==='verified-owner'));
 assert.equal(JSON.stringify(archive),before);
});
test('folder names cannot collide with profile tabs or prototype properties',()=>{
 for(const name of ['__proto__','constructor','prototype','Просмотрено','Любимые','', 'a'.repeat(41)]) {
  assert.equal(ctx.komiFolderNameAllowed(name),false);
 }
 assert.equal(ctx.komiFolderNameAllowed('Мой список'),true);
});
