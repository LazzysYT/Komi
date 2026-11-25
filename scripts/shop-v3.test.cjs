const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const js=read('komi-shop-v3.js');
const css=read('komi-shop-v3.css');
const html=read('index.html');
const core=read('anicoin.js');
const social=read('komi-shop-social.js');
const sql=read('supabase/migrations/20261122080000_anicoin_shop_v3_cart.sql');
const racePatch=read('supabase/migrations/20261122081500_shop_cart_charge_only_inserted.sql');
const scripts={};
const container={
 innerHTML:'',
 querySelector(selector){return selector==='#shop.komi-shop-v3'?section:null;}
};
const section={
 addEventListener(type,listener){scripts[type]=listener;},
 querySelectorAll(){return [];}
};
const context={document:{getElementById:()=>container},currentView:'shop'};
context.window={setInterval:()=>1,confirm:()=>true};
vm.createContext(context);
vm.runInContext(read('komi-shop-catalog.js'),context);
vm.runInContext(read('komi-shop-icons.js'),context);
vm.runInContext(js,context);
// Mirror the SPA's real refresh callback so clicks actually rerender in the unit harness.
let actor=()=>guest;
context.renderAniCoinShop=()=>context.window.KomiShopV3.render(container,actor());
const products=context.window.KomiShopCatalog.items;
const guest={owner:'',store:null,wallet:null,displayName:'Гость',avatar:''};
const owned={owner:'uid-one',store:{balance:500,owned:['frame_moon','title_cinema'],frame_id:'frame_moon'},wallet:{balance:500},displayName:'Тестовый зритель',avatar:''};
function reset(){
 actor=()=>guest;
 // Keep each test independent: clear persisted filters through the same UI handler.
 if(scripts.click)scripts.click(eventButton('data-v3-reset-filters'));
 context.window.KomiShopV3.reset();
 context.window.KomiShopV3.render(container,guest);
}
function eventButton(name,id){
 return {target:{closest(selector){
  if(selector!=='button')return null;
  const d={};
  if(name==='data-v3-try')d.v3Try=id;
  if(name==='data-v3-category')d.v3Category=id;
   if(name==='data-v3-sort')d.v3Sort=id;
  if(name==='data-v3-reset')d.v3Reset='';
  if(name==='data-v3-reset-filters')d.v3ResetFilters='';
  return {dataset:d,hasAttribute(k){return k===name;}};
 }}};
}
const countCards=html=>(html.match(/data-shop-item-action=/g)||[]).length;
test('shop v3 JavaScript parses without frameworks and is initialized from the catalog',()=>{
 assert.doesNotThrow(()=>new vm.Script(js));
 assert.equal(products.length,93);
 assert.match(html,/src="\.\/komi-shop-v3\.js\?v=/);
 assert.match(html,/komi\.production\.css\?v=/);
 assert.match(core,/window\.KomiShopV3\?\.render/);
 assert.match(core,/window\.komiShopCheckoutCart/);
 assert.match(social,/section\.classList\.contains\('komi-shop-v3'\)/);
});
test('guest storefront shows all items, rarity, explicit prices and auth button',()=>{
 context.window.KomiShopV3.render(container,guest);
 const count=(container.innerHTML.match(/data-shop-item-action="/g)||[]).length;
 assert.equal(count,93);
 assert.match(container.innerHTML,/Магазин Komi/);
 assert.match(container.innerHTML,/Войти, чтобы купить/);
 assert.equal((container.innerHTML.match(/class="komi-coin-sample sv3-item-scene sv5-preview-button"/g)||[]).length,93);
  assert.doesNotMatch(container.innerHTML,/Рамка для твоего аватара в профиле/);
 assert.match(container.innerHTML,/data-rarity="legendary"/);
 assert.match(container.innerHTML,/data-v3-sort/);
 assert.match(container.innerHTML,/data-v3-hide-owned/);
 assert.match(container.innerHTML,/aria-label="Живая примерочная"/);
 assert.doesNotMatch(container.innerHTML,/Рулетка|шансы выигрыша|roulette/i);
});
test('current account purchased items cost zero when building a preview cart',()=>{
 const calculate=context.window.KomiShopV3.priceOf;
 const moon=products.find(x=>x.id==='frame_moon');
 const legend=products.find(x=>x.id==='frame_shogun');
 assert.equal(calculate([moon],owned.store),0);
 assert.equal(calculate([moon,legend],owned.store),legend.cost);
 assert.equal(calculate([moon],null),moon.cost);
});
test('category switch preserves trials and guest can trial without buying',async()=>{
 reset();
 const frame=products.find(x=>x.id==='frame_moon');
 await scripts.click(eventButton('data-v3-try','frame_moon'));
 assert.deepEqual([...context.window.KomiShopV3.selected()],['frame_moon']);
 await scripts.click(eventButton('data-v3-category','shape'));
 assert.match(container.innerHTML,/data-v3-category="shape" aria-pressed="true"/);
 assert.equal((container.innerHTML.match(/data-shop-item-action=/g)||[]).length,4);
 assert.equal(context.window.KomiShopV3.selected().length,1);
 assert.match(container.innerHTML,/Выбрано для примерки/);
 context.window.KomiShopV3.reset();
});
test('bento fitting room and sorting are responsive and accessible',()=>{
 for(const required of ['#09090B','#131316','#1A1A1F','rgba(255,255,255,.08)',
 'grid-template-columns:repeat(2,minmax(0,1fr))','grid-template-columns:repeat(auto-fill,minmax(200px,1fr))',
 'position:sticky','backdrop-filter:blur(14px)','@media(max-width:960px)','position:fixed',
 'padding-bottom:190px','@media(prefers-reduced-motion:reduce)']){
 assert.ok(css.includes(required),'missing '+required);
 }
 assert.match(js,/role="status"/);
 assert.match(js,/aria-expanded/);
 assert.match(js,/data-v3-checkout/);
 assert.match(js,/data-v3-promo/);
 assert.match(js,/purchased|owned/);
});
test('atomic server-side cart is authenticated, row-locked and rejects dupes',()=>{
 assert.match(sql,/auth\.uid\(\)/);
 assert.match(sql,/u\.is_anonymous is not true/);
 assert.match(sql,/for update/);
 assert.match(sql,/v_wallet\.balance<v_total/);
 assert.match(sql,/v_kind=any\(v_kinds\)/);
 assert.match(sql,/komi_private\.shop_item_prices/);
 assert.match(sql,/premium_store_purchases/);
 assert.match(sql,/revoke all on function public\.komi_shop_cart_buy_equip\(text\[\]\)/);
 assert.match(sql,/grant execute on function public\.komi_shop_cart_buy_equip\(text\[\]\) to authenticated/);
 assert.match(sql,/frame_id=v_id/);
 assert.match(sql,/shape_id=v_id/);
 assert.doesNotMatch(sql,/random\s*\(|roulette|lootbox|gambl/i);
});

test('cart only charges purchases successfully inserted, even when a gift arrives concurrently',()=>{
 assert.match(racePatch,/get diagnostics v_inserted = row_count/);
 assert.match(racePatch,/if v_inserted=1 then v_spent:=v_spent\+v_price/);
 assert.match(racePatch,/balance=balance-v_spent/);
 assert.match(racePatch,/'spent',v_spent/);
 assert.match(racePatch,/v_wallet\.balance<v_total/);
});

test('shop layout overrides the site-wide sticky header and keeps categories in one row',()=>{
 assert.match(css,/#mainContainer > #shop\.komi-shop-v3 > header\.sv3-topbar/);
 assert.match(css,/position:relative!important/);
 assert.match(css,/\.sv3-category-tabs\{[\s\S]*?flex-wrap:nowrap/);
 assert.match(css,/\.sv3-product-grid\{[\s\S]*?grid-template-columns:repeat\(auto-fit/);
 const revision=html.match(/<meta name="komi-ui-revision" content="([^"]+)"/)?.[1];
 assert.match(revision,/^\d{8}-[\w-]+$/);
 assert.equal(html.match(/komi\.production\.css\?v=([^"]+)/)?.[1],revision);
});
test('shop avatars match verified Premium GIF rather than stale normal photo',()=>{
 const start=core.indexOf('function aniCoinCurrentProfileAvatar(');
 const end=core.indexOf("window.addEventListener('komi:premium-refreshed'",start);
 assert.ok(start>=0&&end>start);
 const snippet=core.slice(start,end);
 const premium={
   isActiveId:id=>id==='owner-1',
   getMediaForId:id=>id==='owner-1'?{avatar_path:'owner-1/current.gif'}:null
 };
 const mock={
  URL,
  currentUser:{authUserId:'owner-1'},
  window:{KomiPremium:premium},
  _supabase:{storage:{from:bucket=>({
    getPublicUrl:path=>({data:{publicUrl:'https://cdn.komi.test/'+bucket+'/'+path}})
  })}}
 };
 vm.createContext(mock);
 vm.runInContext(snippet,mock);
 assert.equal(mock.aniCoinCurrentProfileAvatar('owner-1','https://cdn.komi.test/old.jpg'),
   'https://cdn.komi.test/avatars/owner-1/current.gif');
 assert.equal(mock.aniCoinCurrentProfileAvatar('owner-2','https://cdn.komi.test/other.jpg'),'',
   'Never reuse a different owner avatar');
 mock.window.KomiPremium.isActiveId=()=>false;
 assert.equal(mock.aniCoinCurrentProfileAvatar('owner-1','https://cdn.komi.test/static.jpg'),
   'https://cdn.komi.test/static.jpg');
 const p=read('komi-premium.js');
 assert.match(p,/komi:premium-refreshed/);
 assert.match(core,/window\.addEventListener\('komi:premium-refreshed'/);
 assert.match(html,/komi-premium\.js\?v=20261122h/);
});

test('shop V5 presents one weekly collection and filled icons while preserving purchase and gift hooks',()=>{
  const icons=read('komi-shop-icons.js');
  const v5css=read('komi-shop-v5.css');
  const premium=read('komi-premium.js');
  reset();
  const output=container.innerHTML;
  assert.match(output,/class="anicoin-shop komi-shop-v3 komi-shop-v4 komi-shop-v5"/);
  assert.match(output,/Магазин KomiAnime/);
  assert.equal((output.match(/class="sv5-weekly"/g)||[]).length,1);
  assert.equal((output.match(/data-v3-bundle/g)||[]).length,1);
  assert.doesNotMatch(output,/sv4-feature-grid|sv3-bento|Ещё категории/);
  assert.equal((output.match(/data-v3-category=/g)||[]).length,15);
  assert.equal((output.match(/data-v3-sort=/g)||[]).length,4);
  assert.equal((output.match(/data-shop-item-action=/g)||[]).length,93);
  assert.equal((output.match(/data-v3-try=/g)||[]).length,93);
  assert.match(output,/data-v3-hide-owned/);
  assert.match(output,/data-v3-checkout/);
  assert.match(output,/id="komiShopSocialArea"/);
  assert.match(output,/data-v3-promo/);
  assert.match(output,/fill="currentColor"/);
  assert.match(html,/komi-shop-icons\.js\?v=/);
  assert.match(html,/komi-shop-v3\.js\?v=/);
  assert.match(html,/komi-shop-social\.js\?v=/);
  assert.match(html,/komi-shop-v5\.css\?v=/);
  assert.match(icons,/solidPaths=Object\.freeze/);
  assert.match(social,/KomiShopIcons\?\.solid\?\.\('gift'/);
  assert.doesNotMatch(social,/komi-shop-gift-button','🎁'/);
  assert.match(premium,/sv4-perk-badge/);
  assert.match(v5css,/\.sv5-sort-segments/);
  assert.match(v5css,/border-radius:999px/);
  assert.match(v5css,/padding:19px 19px 96px/);
  assert.match(v5css,/prefers-reduced-motion:reduce/);
  assert.doesNotMatch(output,/случайн(?:ые|ая) наград|рулетк[ау]|шанс выпадения/i);
});
test('shop V5 segmented sorting and visual preview preserve selected products',async()=>{
  reset();
  await scripts.click(eventButton('data-v3-sort','price-down'));
  assert.match(container.innerHTML,/data-v3-sort="price-down" aria-pressed="true"/);
  await scripts.click(eventButton('data-v3-try','frame_moon'));
  assert.deepEqual([...context.window.KomiShopV3.selected()],['frame_moon']);
  assert.match(container.innerHTML,/class="komi-coin-card sv3-item is-trying"/);
  context.window.KomiShopV3.reset();
});
test('svg sticker icons are predictable, non-interactive and have a fallback',()=>{
 const icons=context.window.KomiShopIcons;
 for(const name of ['quality','movie','medal','coins','gift','layers','eye','reset','chevron','bag']){
   const markup=icons.svg(name);
   assert.match(markup,/viewBox="0 0 24 24"/);
   assert.match(markup,/aria-hidden="true"/);
   assert.match(markup,/stroke="currentColor"/);
 }
 assert.match(icons.svg('invalid'),/komi-sticker-icon/);
});

test('all product categories have a dedicated filter and showcase/card cosmetics are visible in the fitting room',async()=>{
 reset();
 for(const type of new Set(products.map(row=>row.type))){
  assert.match(container.innerHTML,new RegExp('data-v3-category="'+type+'"'));
  await scripts.click(eventButton('data-v3-category',type));
  assert.equal(countCards(container.innerHTML),products.filter(row=>row.type===type).length,type);
 }
 await scripts.click(eventButton('data-v3-try','showcase_film'));
 await scripts.click(eventButton('data-v3-try','card_glass'));
 assert.match(container.innerHTML,/Витрина топ-3[\s\S]+Карточка профиля/);
 assert.match(container.innerHTML,/class="sv3-unit-price">/);
});

test('hide-owned filter does not blank the owned collection',async()=>{
 reset();actor=()=>owned;
 context.window.KomiShopV3.render(container,owned);
 scripts.change({target:{checked:true,matches:selector=>selector==='[data-v3-hide-owned]'}});
 assert.equal(countCards(container.innerHTML),products.length-owned.store.owned.length);
 await scripts.click(eventButton('data-v3-category','owned'));
 assert.equal(countCards(container.innerHTML),owned.store.owned.length);
 assert.match(container.innerHTML,/data-v3-hide-owned disabled/);
 assert.doesNotMatch(container.innerHTML,/пока нет купленных/);
});

test('migration lowers every existing price, registers eight new goods and keeps all equip ids valid',()=>{
 const migration=read('supabase/migrations/20261125100500_anicoin_shop_v6_catalog.sql');
 const parsePrices=t=>Object.fromEntries([...t.matchAll(/\('([a-z0-9_]+)',\s*(\d+),\s*true\)/g)].map(([,id,cost])=>[id,+cost]));
 const oldPrices=parsePrices(read('supabase/migrations/20261122070000_anicoin_visual_collections.sql'));
 const newPrices=parsePrices(migration);
 assert.equal(Object.keys(oldPrices).length,85);
 assert.deepEqual(newPrices,Object.fromEntries(products.map(row=>[row.id,row.cost])));
 assert.equal(Object.keys(newPrices).filter(id=>!Object.hasOwn(oldPrices,id)).length,8);
 for(const [id,price] of Object.entries(oldPrices))assert.ok(newPrices[id]<price,id);
 const checks=Object.fromEntries([...migration.matchAll(/add constraint (\w+)\s+check \([\s\S]+?\bin \(([\s\S]+?)\n  \)\);/g)]
  .map(([,constraint,list])=>[constraint,[...list.matchAll(/'([a-z0-9_]+)'/g)].map(match=>match[1])]));
 assert.deepEqual(checks.premium_store_purchases_item_id_check,[...products.map(row=>row.id)]);
 for(const type of ['frame','title','banner','icon','plate','xp'])
  assert.deepEqual(checks['komi_premium_cosmetic_equips_'+type+'_id_check'],[...products.filter(row=>row.type===type).map(row=>row.id)]);
 assert.match(migration,/security invoker set search_path = ''/);
 assert.match(migration,new RegExp("select '"+context.window.KomiShopCatalog.revision+"'"));
 assert.doesNotMatch(migration,/update public\.komi_anicoin_wallets|update komi_private\.premium_store_purchases|security definer/i);
 const visuals=read('komi-shop-v6-goods.css');
 for(const row of products.filter(row=>!Object.hasOwn(oldPrices,row.id)&&row.type!=='title'))
  assert.ok(visuals.includes('komi-store-'+(row.frameClass||row.bannerClass||row.cosmeticClass)),row.id);
});

test('server revision must match before debiting and preview blocks even with the matching revision',async()=>{
 reset();
 const real=context.window.KomiShopCatalog;
 assert.equal(real.canCheckout(),false);
 assert.equal(await real.checkPricing({rpc:async()=>({data:'previous'})}),false);
 assert.equal(await real.checkPricing({rpc:async name=>{
   assert.equal(name,'komi_shop_catalog_revision');
   return {data:real.revision};
 }}),true);
 assert.equal(real.canCheckout(),true);
 context.window.location={hostname:'preview.vercel.app'};
 assert.equal(real.canCheckout(),false);
 assert.equal(await real.checkPricing({rpc:async()=>{throw Error('preview must not query');}}),false);
 context.window.KomiShopV3.render(container,guest);
 assert.match(container.innerHTML,/Предпросмотр: показаны новые цены/);
 assert.match(container.innerHTML,/aria-label="Купить «Лунная рамка»" disabled>Только примерка/);
 delete context.window.location;
});
