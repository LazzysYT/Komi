'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
function load(hostname='komianime.online'){const window={location:{hostname,search:hostname==='komianime.online'?'':'?animated_shop=1'}};vm.runInNewContext(read('komi-shop-catalog.js'),{window});return window.KomiShopCatalog;}
test('new animated cosmetics are unique and preview-only until the second server revision is confirmed',async()=>{
 const c=load(),p=load('preview.example'),items=c.items.filter(x=>x.animatedShop&&!x.frameAtelier&&x.type!=='aura'&&x.type!=='banner');
 assert.equal(items.length,21);
 for(const id of ["entry_moonrise","entry_neon_gate","party_comet","party_portal"]){assert.equal(c.find(id),null);assert.equal(p.isOnSale(id),false);}
 assert.equal(new Set(c.items.map(x=>x.id)).size,c.items.length);
 assert.ok(items.every(x=>!c.isOnSale(x.id)&&p.isOnSale(x.id)&&!p.isGiftable(x.id)));
 await c.checkPricing({rpc:async name=>name==='komi_shop_living_revision'?{data:c.revision}:{error:{message:'not deployed'}}});
 assert.equal(c.canCheckout(),true);assert.equal(c.isOnSale('frame_ghoul_seal'),true);
 assert.ok(items.every(x=>!c.isOnSale(x.id)));
 await c.checkAnimatedPricing({rpc:async name=>{assert.equal(name,'komi_shop_animated_revision');return {data:c.animatedRevision};}});
 assert.ok(items.every(x=>c.isOnSale(x.id)));
 for(const id of ['aura_crimson','aura_starlight']){assert.equal(c.find(id).type,'aura');assert.equal(c.isOnSale(id),false);assert.equal(c.isGiftable(id),false);assert.equal(p.isOnSale(id),false);}
 assert.equal(c.isOnSale('frame_moon'),false);
 assert.equal(p.canCheckout(),false);
});
test('all new prices match the candidate SQL and all vector frames include a static fallback',()=>{
 const c=load(),css=read('komi-living-profile.css'),sql=read('docs/animated-shop-catalog.sql');
 for(const p of c.items.filter(x=>x.animatedShop&&!x.frameAtelier)){
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

test('all 13 frame designs have two separate small transparent vector assets',()=>{const css=read('komi-living-profile.css'),dir='assets/shop-frames-atelier/';const frames=load().items.filter(p=>p.type==='frame'&&!p.frameAtelier&&(p.animatedShop||p.id==='frame_ghoul_seal'));assert.equal(frames.length,13);for(const p of frames){const name=p.frameClass.replace(/^frame-/,'');for(const suffix of ['rim','fx']){const file=dir+name+'-'+suffix+'.svg',svg=read(file);assert.match(svg,/^<svg [\s\S]+<\/svg>$/);assert.match(svg,/viewBox=['"]0 0 240 240['"]/);assert.doesNotMatch(svg,/<(?:script|image|foreignObject)\b|https?:\/\/(?!www\.w3\.org\/2000\/svg)/);assert.ok(svg.length<18000,p.id);assert.ok(css.includes('/'+file));}}});


test('all existing covers have independent static and motion illustrations',()=>{
 const css=read('komi-shop-v6-goods.css'),banners=load().items.filter(p=>p.type==='banner');
 assert.equal(banners.length,20);const unique=new Set();
 for(const p of banners){const name=p.bannerClass.replace(/^banner-/,'');const still=['last-train','moon-platform'].includes(name)?'assets/shop-station/'+name+'.svg':'assets/shop-covers-atelier/'+name+'.svg';const motion='assets/shop-covers-atelier/motion/'+name+'.svg';
  for(const file of [still,motion]){const svg=read(file).trim();assert.match(svg,/^<svg [\s\S]+<\/svg>$/);assert.doesNotMatch(svg,/<(?:script|image|foreignObject)\b|https?:\/\/(?!www\.w3\.org\/2000\/svg)/);assert.ok(svg.length<43000,file);assert.ok(css.includes('/'+file),file);unique.add(file);}
  assert.doesNotMatch(read(still),/@keyframes ka-/);assert.match(read(motion),/prefers-reduced-motion:no-preference/);assert.match(read(motion),/@keyframes ka-/);
 }assert.equal(unique.size,40);assert.match(css,/prefers-reduced-motion:reduce/);
});


test('frame atelier keeps every old frame ID, animates all 49 frames, and removes banners only from sale',async()=>{
 const c=load(),p=load('preview.example'),frames=c.items.filter(x=>x.type==='frame'),fresh=frames.filter(x=>x.frameAtelier),css=read('komi-living-profile.css'),sql=read('docs/frame-atelier-v2.sql');
 assert.equal(frames.length,49);assert.equal(fresh.length,6);
 for(const f of frames){const name=f.frameClass.slice(6);assert.ok(css.includes('.komi-store-'+f.frameClass+'{--komi-motion-color:'),f.id);for(const suffix of ['rim','fx']){const path='assets/shop-frames-atelier/'+name+'-'+suffix+'.svg';const svg=read(path);assert.match(svg,/^<svg [\s\S]+<\/svg>$/);assert.match(svg,/viewBox=['"]0 0 240 240['"]/);assert.doesNotMatch(svg,/<(?:script|image|foreignObject)\b/);assert.ok(svg.length<18000,path);}}
 for(const b of c.items.filter(x=>x.type==='banner')){assert.ok(c.find(b.id));assert.equal(c.isOnSale(b.id),false);assert.equal(p.isOnSale(b.id),false);assert.equal(p.isGiftable(b.id),false);}
 for(const f of fresh){assert.ok(sql.includes("('"+f.id+"',"+f.cost+",false)"));assert.ok(!c.isOnSale(f.id)&&p.isOnSale(f.id)&&!p.isGiftable(f.id));}
 await c.checkPricing({rpc:async name=>({data:name==='komi_shop_living_revision'?c.revision:name==='komi_shop_animated_revision'?c.animatedRevision:'wrong'})});
 assert.ok(fresh.every(f=>!c.isOnSale(f.id)));
 await c.checkFrameAtelierPricing({rpc:async name=>{assert.equal(name,'komi_shop_frame_atelier_revision');return {data:c.frameAtelierRevision};}});
 assert.ok(fresh.every(f=>c.isOnSale(f.id)&&!c.isGiftable(f.id)));
 assert.ok(c.items.filter(x=>x.type==='banner').every(b=>!c.isOnSale(b.id)));
});
