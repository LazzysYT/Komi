'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
function load(hostname='komianime.online'){const window={location:{hostname}};vm.runInNewContext(read('komi-shop-catalog.js'),{window});return window.KomiShopCatalog;}
test('new animated cosmetics are unique and preview-only until the second server revision is confirmed',async()=>{
 const c=load(),p=load('preview.example'),items=c.items.filter(x=>x.animatedShop);
 assert.equal(items.length,20);
 assert.equal(new Set(c.items.map(x=>x.id)).size,c.items.length);
 assert.ok(items.every(x=>!c.isOnSale(x.id)&&p.isOnSale(x.id)&&!p.isGiftable(x.id)));
 await c.checkPricing({rpc:async name=>name==='komi_shop_living_revision'?{data:c.revision}:{error:{message:'not deployed'}}});
 assert.equal(c.canCheckout(),true);assert.equal(c.isOnSale('frame_ghoul_seal'),true);
 assert.ok(items.every(x=>!c.isOnSale(x.id)));
 await c.checkPricing({rpc:async name=>({data:name==='komi_shop_living_revision'?c.revision:c.animatedRevision})});
 assert.ok(items.every(x=>c.isOnSale(x.id)));
 assert.equal(c.isOnSale('frame_moon'),false);
 assert.equal(p.canCheckout(),false);
});
test('all new prices match the candidate SQL and all vector frames include a static fallback',()=>{
 const c=load(),css=read('komi-living-profile.css'),sql=read('docs/animated-shop-catalog.sql');
 for(const p of c.items.filter(x=>x.animatedShop)){
  assert.ok(sql.includes("('"+p.id+"',"+p.cost+",false)"),p.id);
  assert.ok(p.cost>=15&&p.cost<=75);
  if(p.type==='frame')assert.ok(css.includes('.komi-store-'+p.frameClass+'{--komi-motion-color:'),p.id);
 }
 assert.ok(css.includes('prefers-reduced-motion:reduce'));
});
test('four anime sets contain three distinct equipment slots and use normal server-priced cart totals',()=>{
 const c=load('preview.example');
 assert.equal(c.animatedSets.length,4);
 const totals=Array.from(c.animatedSets,s=>s.items.reduce((sum,id)=>sum+c.find(id).cost,0));
 assert.deepEqual(totals,[70,95,75,85]);
 for(const s of c.animatedSets){
  assert.equal(new Set(s.items.map(id=>c.find(id).type)).size,3);
  assert.ok(s.items.every(id=>c.isOnSale(id)));
 }
});
