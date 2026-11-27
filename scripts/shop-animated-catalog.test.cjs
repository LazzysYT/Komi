'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
function load(hostname='komianime.online'){const window={location:{hostname,search:hostname==='komianime.online'?'':'?animated_shop=1'}};vm.runInNewContext(read('komi-shop-catalog.js'),{window});return window.KomiShopCatalog;}
test('new animated cosmetics are unique and preview-only until the second server revision is confirmed',async()=>{
 const c=load(),p=load('preview.example'),items=c.items.filter(x=>x.animatedShop);
 assert.equal(items.length,24);
 for(const id of ["entry_moonrise","entry_neon_gate","party_comet","party_portal"]){assert.equal(c.find(id),null);assert.equal(p.isOnSale(id),false);}
 assert.equal(new Set(c.items.map(x=>x.id)).size,c.items.length);
 assert.ok(items.every(x=>!c.isOnSale(x.id)&&p.isOnSale(x.id)&&!p.isGiftable(x.id)));
 await c.checkPricing({rpc:async name=>name==='komi_shop_living_revision'?{data:c.revision}:{error:{message:'not deployed'}}});
 assert.equal(c.canCheckout(),true);assert.equal(c.isOnSale('frame_ghoul_seal'),true);
 assert.ok(items.every(x=>!c.isOnSale(x.id)));
 await c.checkAnimatedPricing({rpc:async name=>{assert.equal(name,'komi_shop_animated_revision');return {data:c.animatedRevision};}});
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

test('new slots have distinct frontend surfaces and syntax',()=>{for(const type of ['aura','commentfx'])assert.ok(read('komi-shop-v3.js').includes("['"+type+"',"));for(const [file,marker] of [['komi-comments.js','renderAnimatedReactions'],['komi-collection.js','loadOwnedAura']]){assert.ok(read(file).includes(marker));assert.doesNotThrow(()=>new vm.Script(read(file)));}});

test('SQL grants no direct equipment writes and validates reactions against equipped items',()=>{
 const sql=read('docs/animated-shop-catalog.sql');
 for(const type of ['entry','aura','commentfx','party']){
  assert.ok(sql.includes('add column if not exists '+type+'_id text'));
  assert.ok(sql.includes("elsif kind='"+type+"' then"));
  assert.ok(sql.includes("elsif v_kind='"+type+"' then"));
 }
 assert.match(sql,/enable row level security/);
 assert.match(sql,/animated_reactions_insert[^;]+e\.commentfx_id=effect_id/);
 assert.match(sql,/animated_reactions_delete[^;]+auth\.uid\(\)/);
 assert.doesNotMatch(sql,/grant (?:all|insert|update|delete)[^;]+on public\.komi_premium_cosmetic_equips/i);
});

test('retired effects never appear in UI or trigger Party/profile animations',()=>{assert.doesNotMatch(read('komi-shop-v3.js'),/Эффекты входа|Эффекты Party/);assert.doesNotMatch(read('watch-party.js'),/animatePartyArrivals/);assert.doesNotMatch(read('komi-premium-store.js'),/entrySeen/);});
