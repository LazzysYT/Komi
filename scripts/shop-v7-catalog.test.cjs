'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const source=read('komi-shop-catalog.js');
const migrationName=fs.readdirSync(path.join(root,'supabase/migrations')).find(name=>name.endsWith('_anicoin_shop_v7_collections.sql'));
const sql=read('supabase/migrations/'+migrationName);
const previous=read('supabase/migrations/20261125100500_anicoin_shop_v6_catalog.sql');
const styles=read('komi-shop-v6-goods.css');
const publicRenderer=read('komi-premium-store.js');
const commentRenderer=read('komi-comments.js');
const studioRenderer=read('premium-studio.js');
function load(hostname='komianime.online'){
 const context={window:{location:{hostname}}};
 vm.createContext(context);
 vm.runInContext(source,context);
 return context.window.KomiShopCatalog;
}
const catalog=load();
const additions=catalog.items.filter(item=>item.introducedAt==='2026-11-25');
const priceRows=text=>Array.from(text.matchAll(/\('([a-z_0-9]+)',(\d+),true\)/g),match=>[match[1],Number(match[2])]);
const ids=text=>Array.from(text.matchAll(/'([a-z]+_[a-z_0-9]+)'/g),match=>match[1]);
function allowlist(constraint,column){
 const start=sql.indexOf('add constraint '+constraint);
 assert.ok(start>=0,'Missing '+constraint);
 const end=sql.indexOf('));',start);
 const clause=sql.slice(start,end);
 assert.ok(clause.includes(column+' in ('),constraint+' guards the correct slot');
 return ids(clause);
}

test('V7 retains every existing product price and adds 48 uniquely identified products',()=>{
 assert.equal(catalog.items.length,141);
 assert.equal(new Set(catalog.items.map(item=>item.id)).size,141);
 assert.equal(additions.length,48);
 const priorPrices=priceRows(previous);
 assert.equal(priorPrices.length,93);
 for(const [id,cost] of priorPrices){
  const current=catalog.find(id);
  assert.ok(current,'Previously sold product remains in the catalog: '+id);
  assert.equal(current.cost,cost,'Existing price changed: '+id);
  assert.equal(current.introducedAt,undefined,'Existing item must not be advertised as new: '+id);
 }
 for(const item of additions){
  assert.ok(Number.isSafeInteger(item.cost)&&item.cost>0);
  assert.equal(item.id.split('_')[0],item.type);
  assert.ok(item.description.length>15&&item.description.length<110);
 }
});

test('the new private server price rows match all advertised new prices exactly',()=>{
 const rows=priceRows(sql);
 assert.equal(rows.length,48);
 assert.equal(new Set(rows.map(([id])=>id)).size,48);
 assert.deepEqual(new Map(rows),new Map(additions.map(item=>[item.id,item.cost])));
 const oldIds=new Set(priceRows(previous).map(([id])=>id));
 for(const [id] of rows)assert.ok(!oldIds.has(id),'Migration must not update an old item price: '+id);
 assert.match(sql,/actual\.cost is distinct from expected\.cost/);
 assert.ok(sql.indexOf('do $verify$')<sql.indexOf('create or replace function public.komi_shop_catalog_revision'));
});

test('purchase and equipped-slot constraints preserve old products and accept every new one',()=>{
 const purchaseIds=allowlist('premium_store_purchases_item_id_check','item_id');
 assert.deepEqual(new Set(purchaseIds),new Set(catalog.items.map(item=>item.id)));
 const types=new Set(additions.map(item=>item.type));
 assert.equal(types.size,9);
 for(const type of types){
  const slotIds=allowlist('komi_premium_cosmetic_equips_'+type+'_id_check',type+'_id');
  assert.deepEqual(new Set(slotIds),new Set(catalog.items.filter(item=>item.type===type).map(item=>item.id)));
 }
});

test('collections contain real products and a valid three-slot fitting-room combination',()=>{
 assert.deepEqual(Array.from(catalog.collections,collection=>collection.id),['nocturne','manga','arcade','celestial','cinema','botanical']);
 const included=[];
 for(const collection of catalog.collections){
  assert.equal(collection.items.length,8);
  assert.ok(Object.isFrozen(collection)&&Object.isFrozen(collection.items)&&Object.isFrozen(collection.preview));
  for(const id of collection.items){
   const item=catalog.find(id);
   assert.ok(item,'Unknown collection item: '+id);
   assert.equal(item.collection,collection.id);
   included.push(id);
  }
  const samples=collection.preview.map(id=>catalog.find(id));
  assert.equal(samples.length,3);
  assert.deepEqual(new Set(samples.map(item=>item.type)),new Set(['frame','banner','title']));
  assert.ok(samples.every(item=>item.collection===collection.id));
 }
 assert.equal(new Set(included).size,48);
 assert.deepEqual(new Set(included),new Set(additions.map(item=>item.id)));
});

test('new cosmetics reuse real profile and comment renderers and have shared CSS',()=>{
 for(const item of additions){
  if(item.type==='title'){
   assert.ok(item.title.length>3);
   assert.match(publicRenderer,/title\.textContent=content/);
   continue;
  }
  const cls=item.frameClass||item.bannerClass||item.cosmeticClass;
  assert.ok(styles.includes('.komi-store-'+cls),'Public CSS missing for '+item.id);
  if(['frame','banner','shape','overlay'].includes(item.type)){
   assert.ok(styles.includes('.'+cls),'Studio CSS missing for '+item.id);
  }
  const owner=item.type==='plate'?commentRenderer:publicRenderer;
  assert.ok(owner.includes(item.type+'_id'),'Real renderer has no slot for '+item.type);
  assert.ok(studioRenderer.includes("'"+item.type+"'"),'Studio renderer has no slot for '+item.type);
 }
 assert.doesNotMatch(styles,/url\(\s*['"]?https?:/);
});

test('XP skins cover native progress engines and name gradients retain forced-colors fallback',()=>{
 assert.match(styles,/progress::-webkit-progress-value\{\s*background:var\(--komi-v7-xp\)/);
 assert.match(styles,/progress::-moz-progress-bar\{\s*background:var\(--komi-v7-xp\)/);
 assert.match(styles,/\.komi-shop-xp-swatch::after\{\s*background:var\(--komi-v7-xp\)/);
 assert.match(styles,/@media\(forced-colors:active\)/);
 assert.match(styles,/-webkit-text-fill-color:CanvasText!important/);
});

test('checkout remains disabled until the server confirms the exact V7 revision',async()=>{
 const current=load();
 assert.equal(current.canCheckout(),false);
 assert.match(sql,new RegExp("select '"+current.revision+"'::text"));
 assert.equal(await current.checkPricing({rpc:async()=>({data:'20261125-shop-v6'})}),false);
 assert.equal(current.canCheckout(),false);
 assert.equal(await current.checkPricing({rpc:async()=>({error:{message:'offline'}})}),false);
 assert.equal(current.canCheckout(),false);
 assert.equal(await current.checkPricing({rpc:async(name)=>{
  assert.equal(name,'komi_shop_catalog_revision');
  return {data:current.revision};
 }}),true);
 assert.equal(current.canCheckout(),true);
});

test('preview hosts cannot enable purchases even if a client offers the right revision',async()=>{
 for(const host of ['localhost','preview.example','komi-branch.vercel.app']){
  const preview=load(host);let requests=0;
  assert.equal(await preview.checkPricing({rpc:async()=>{requests++;return {data:preview.revision};}}),false);
  assert.equal(requests,0);
  assert.equal(preview.canCheckout(),false);
 }
});

test('catalog migration retains transaction and permission boundaries',()=>{
 assert.match(sql,/\nbegin;/);
 assert.match(sql,/\ncommit;\s*$/);
 assert.match(sql,/set local lock_timeout = '5s'/);
 assert.match(sql,/security invoker set search_path = ''/);
 assert.match(sql,/revoke all on function public\.komi_shop_catalog_revision\(\) from public, anon, authenticated/);
 assert.match(sql,/grant execute on function public\.komi_shop_catalog_revision\(\) to authenticated/);
 assert.doesNotMatch(sql,/security definer|disable row level security|create policy|drop table/i);
 assert.doesNotMatch(sql,/update\s+(?:public\.)?komi_anicoin_wallets|delete from|truncate/i);
 assert.doesNotMatch(sql,/create or replace function public\.komi_(?:premium_store|shop_cart_buy_equip)/);
});

test('equipped frame, shape and nickname styles override the ID-scoped profile shell',()=>{
 const shell=read('profile-premium-mono.css');
 // These are real shell rules that previously overrode otherwise working swatches.
 assert.match(shell,/#profile\.komi-profile-premium-mono \.profile-avatar-frame \{[^}]*box-shadow:[^}]*!important/s);
 assert.match(shell,/#profile\.komi-profile-premium-mono \.profile-avatar-inner \{[^}]*overflow:hidden/s);
 for(const item of additions.filter(item=>item.type==='frame')){
  assert.ok(styles.includes('#profile.komi-profile-premium-mono .profile-header-card .profile-avatar-frame.komi-store-'+item.frameClass));
 }
 for(const item of additions.filter(item=>item.type==='shape')){
  assert.ok(styles.includes('#profile.komi-profile-premium-mono .profile-header-card .profile-avatar-box.komi-store-'+item.cosmeticClass));
 }
 assert.match(styles,/\.profile-avatar-inner:has\(> \.profile-avatar-box:is\([^}]+border-radius:0;overflow:visible;background:transparent;box-shadow:none/s);
 for(const item of additions.filter(item=>item.type==='name')){
  assert.ok(styles.includes('#profile.komi-profile-premium-mono .profile-name-row [data-profile-field="display-name"].komi-store-'+item.cosmeticClass));
 }
 for(const cls of ['name-inklight','name-stardust']){
  const start=styles.indexOf('[data-profile-field="display-name"].komi-store-'+cls);
  const rule=styles.slice(start,styles.indexOf('}',start));
  assert.match(rule,/background-image:none!important/);
  assert.match(rule,/-webkit-text-fill-color:currentColor!important/);
 }
});

test('new covers and overlays remain visible above profile pseudoelement defaults',()=>{
 const coverRule=styles.match(/#profile\.komi-profile-premium-mono \.profile-header-card \.profile-cover:is\(([^}]+)\)::after\{([^}]+)\}/);
 assert.ok(coverRule);
 for(const item of additions.filter(item=>item.type==='banner'))assert.ok(coverRule[1].includes('.komi-store-'+item.bannerClass));
 assert.match(coverRule[2],/content:""/);
 assert.match(coverRule[2],/background:var\(--komi-banner-pattern\)/);
 const overlayRule=styles.match(/#profile\.komi-profile-premium-mono \.profile-header-card \.profile-cover:is\(([^}]+)\)::before\{([^}]+)\}/);
 assert.ok(overlayRule);
 for(const item of additions.filter(item=>item.type==='overlay'))assert.ok(overlayRule[1].includes('.komi-store-'+item.cosmeticClass));
 assert.match(overlayRule[2],/background-image:var\(--komi-overlay-pattern\)/);
 assert.match(styles,/@media\(prefers-reduced-motion:reduce\)\{[^}]*\.profile-cover:is\([^}]*animation:none!important/s);
});

test('equipped XP overrides both browser engines in the same profile owner',()=>{
 const owner='#profile.komi-profile-premium-mono .profile-xp-capsule:is(.komi-store-xp-panels,.komi-store-xp-combo,.komi-store-xp-constellation,.komi-store-xp-cue)';
 for(const pseudo of ['::-webkit-progress-value','::-moz-progress-bar']){
  const start=styles.indexOf(owner+' progress'+pseudo);
  assert.ok(start>=0,'Missing scoped XP override for '+pseudo);
  assert.match(styles.slice(start,styles.indexOf('}',start)),/background:var\(--komi-v7-xp\)!important/);
 }
});

test('studio icon mapping changes known cosmetic classes and clears them on removal',()=>{
 const start=studioRenderer.indexOf("    const iconItem=products.find(p=>p.id===activeItem('icon'));"),end=studioRenderer.indexOf("    const shape=products.find",start);
 assert.ok(start>=0&&end>start);
 const block=studioRenderer.slice(start,end);
 const nodes=Object.fromEntries(['preview-shop-icon','comment-shop-icon'].map(id=>{
  const classes=new Set(['komi-shop-preview-icon','unrelated-class','komi-store-icon-crown']);
  return [id,{classes,textContent:'old',hidden:false,classList:{remove(...values){values.forEach(value=>classes.delete(value));},add(value){classes.add(value);}}}];
 }));
 const apply=id=>vm.runInNewContext('(function(){'+block+'})()',{products:catalog.items,activeItem:()=>id,$:name=>nodes[name]});
 apply('icon_leaf');
 for(const node of Object.values(nodes)){
  assert.ok(node.classes.has('komi-store-icon-leaf'));
  assert.ok(!node.classes.has('komi-store-icon-crown'));
  assert.ok(node.classes.has('komi-shop-preview-icon')&&node.classes.has('unrelated-class'));
  assert.equal(node.textContent,catalog.find('icon_leaf').symbol);
  assert.equal(node.hidden,false);
 }
 apply(null);
 for(const node of Object.values(nodes)){
  assert.ok(!node.classes.has('komi-store-icon-leaf'));
  assert.ok(node.classes.has('komi-shop-preview-icon')&&node.classes.has('unrelated-class'));
  assert.equal(node.textContent,'');assert.equal(node.hidden,true);
 }
});
