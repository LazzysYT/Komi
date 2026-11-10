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
