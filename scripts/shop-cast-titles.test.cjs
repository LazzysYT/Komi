'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const ctx=vm.createContext({window:{}});vm.runInContext(read('komi-shop-catalog.js'),ctx);
const catalog=ctx.window.KomiShopCatalog;
const css=read('komi-shop-v6-goods.css'),sql=read('supabase/migrations/20261126194000_anicoin_anime_cast_titles.sql');
test('six distinct character titles keep the forty-title retail policy and verified catalogue prices',()=>{
 const cast=catalog.items.filter(i=>i.character);
 assert.equal(cast.length,6);
 assert.equal(new Set(cast.map(i=>i.anime)).size,6);
 assert.equal(catalog.items.filter(i=>catalog.isOnSale(i.id)).length,40);
 for(const i of cast){
  assert.equal(i.type,'title');
  assert.ok(catalog.isOnSale(i.id));
  assert.ok(css.includes('[data-komi-title-id="'+i.id+'"]'));
  assert.ok(sql.includes("('"+i.id+"',"+i.cost+",true)"));
 }
 assert.equal(catalog.isOnSale('frame_moon'),false);
 assert.equal(catalog.find('title_crimson_hunter').cost,30);
 assert.match(sql,/komi_shop_titles_revision\(\) is distinct from '20261126-anime-title-foil'/);
 assert.doesNotMatch(sql,/create or replace function public\.komi_shop_titles_revision\(/);
});
