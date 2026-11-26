const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const js=read('komi-shop-v3.js');
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
vm.runInContext(read('komi-shop-reactions.js'),context);
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
 if(scripts.click)scripts.click(eventButton('data-v7-view','catalog'));
 context.window.KomiShopV3.reset();
 if(/aria-controls="sv7FittingBody" aria-expanded="true"/.test(container.innerHTML))
   scripts.click(eventButton('data-v3-sheet'));
 context.window.KomiShopV3.render(container,guest);
}
function eventButton(name,id){
 return {target:{closest(selector){
  if(selector!=='button')return null;
  const key=name.replace(/^data-/,'').replace(/-([a-z])/g,(_,letter)=>letter.toUpperCase());
  const d={[key]:id??''};
  return {dataset:d,hasAttribute(k){return k===name;}};
 }}};
}
const countCards=html=>(html.match(/data-shop-item-action=/g)||[]).length;
test('shop v3 JavaScript parses without frameworks and is initialized from the catalog',()=>{
 assert.doesNotThrow(()=>new vm.Script(js));
 assert.equal(products.length,146);
 assert.match(html,/src="\.\/komi-shop-v3\.js\?v=/);
 assert.match(html,/komi\.production\.css\?v=/);
 assert.match(core,/window\.KomiShopV3\?\.render/);
 assert.match(core,/window\.komiShopCheckoutCart/);
 assert.match(social,/section\.classList\.contains\('komi-shop-v3'\)/);
});
test('guest storefront shows a bounded first page, explicit prices and auth button',()=>{
 reset();
 context.window.KomiShopV3.render(container,guest);
 const count=(container.innerHTML.match(/data-shop-item-action="/g)||[]).length;
 assert.equal(count,24);
 assert.match(container.innerHTML,/id="anicoin-title">Магазин оформления<\/h1>/);
 assert.match(container.innerHTML,/Войти, чтобы купить/);
 assert.equal((container.innerHTML.match(/class="komi-coin-sample sv3-item-scene sv5-preview-button"/g)||[]).length,24);
  assert.doesNotMatch(container.innerHTML,/Рамка для твоего аватара в профиле/);
 assert.equal((container.innerHTML.match(/data-rarity="(?:common|rare|epic|legendary)"/g)||[]).length,24);
 assert.match(container.innerHTML,/Показано 24 из 142/);
 assert.match(container.innerHTML,/data-v3-sort/);
 assert.match(container.innerHTML,/data-v3-hide-owned/);
 assert.match(container.innerHTML,/aria-label="Примерочная"/);
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
 scripts.change({target:{value:'shape',matches:selector=>selector==='[data-v7-category-select]'}});
 assert.match(container.innerHTML,/<option value="shape" selected>/);
 assert.equal((container.innerHTML.match(/data-shop-item-action=/g)||[]).length,8);
 assert.equal(context.window.KomiShopV3.selected().length,1);
 assert.match(container.innerHTML,/<strong>В образе <span>1<\/span><\/strong>/);
 context.window.KomiShopV3.reset();
});
test('fitting room exposes labelled controls, free-preview explanation and an accessible result status',()=>{
 reset();
 assert.match(container.innerHTML,/role="status" aria-live="polite"/);
 assert.match(container.innerHTML,/aria-controls="sv7FittingBody" aria-expanded="false"/);
 assert.match(container.innerHTML,/data-v3-checkout/);
 assert.match(container.innerHTML,/data-v3-promo/);
 assert.match(container.innerHTML,/Примерка не меняет твой профиль/);
 assert.match(container.innerHTML,/<select data-v3-sort aria-label="Сортировка">/);
 assert.match(container.innerHTML,/<label class="sv7-sr-only" for="sv7Search">Найти оформление/);
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

test('shop release keeps shared stylesheet revision synchronized with the page',()=>{
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
 assert.match(html,/komi-premium\.js\?v=20261125-friend-avatars/);
});

test('shop studio presents seven permanent collections and a featured entry and filled icons while preserving purchase and gift hooks',()=>{
  const icons=read('komi-shop-icons.js');
  const premium=read('komi-premium.js');
  reset();
  const output=container.innerHTML;
  assert.match(output,/class="anicoin-shop komi-shop-v3 komi-shop-v4 komi-shop-v5 komi-shop-studio"/);
  assert.match(output,/id="anicoin-title">Магазин оформления<\/h1>/);
  assert.equal((output.match(/data-v7-collection=/g)||[]).length,8);
  assert.equal((output.match(/data-v7-look=/g)||[]).length,8);
  assert.doesNotMatch(output,/sv4-feature-grid|sv3-bento|Ещё категории/);
  assert.equal((output.match(/data-v3-category=/g)||[]).length,0,'One complete category selector replaces the clipped quick-filter rail');
  assert.match(output,/class="sv7-toolbar" role="search" aria-label="Поиск товаров"/);
  const categorySelect=output.match(/<select data-v7-category-select[^>]*>([\s\S]*?)<\/select>/)?.[1];
  const sortSelect=output.match(/<select data-v3-sort[^>]*>([\s\S]*?)<\/select>/)?.[1];
  assert.equal((categorySelect.match(/<option /g)||[]).length,14);
  assert.equal((sortSelect.match(/<option /g)||[]).length,5);
  assert.equal((output.match(/data-shop-item-action=/g)||[]).length,24);
  assert.equal((output.match(/data-v3-try=/g)||[]).length,24);
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
  assert.doesNotMatch(output,/случайн(?:ые|ая) наград|рулетк[ау]|шанс выпадения/i);
});
test('shop studio price sorting and visual preview preserve selected products',async()=>{
  reset();
  scripts.change({target:{value:'price-down',matches:selector=>selector==='[data-v3-sort]'}});
  assert.match(container.innerHTML,/<option value="price-down" selected>/);
  const ids=[...container.innerHTML.matchAll(/data-item-id="([^"]+)"/g)].map(match=>match[1]);
  assert.deepEqual(ids,Array.from(products).sort((a,b)=>b.cost-a.cost||a.label.localeCompare(b.label,'ru')).slice(0,24).map(item=>item.id));
  await scripts.click(eventButton('data-v3-try','frame_moon'));
  assert.deepEqual([...context.window.KomiShopV3.selected()],['frame_moon']);
  scripts.change({target:{value:'frame',matches:selector=>selector==='[data-v7-category-select]'}});
  await scripts.click(eventButton('data-v7-more'));
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
  assert.match(container.innerHTML,new RegExp('<option value="'+type+'"'));
  scripts.change({target:{value:type,matches:selector=>selector==='[data-v7-category-select]'}});
  const expected=products.filter(row=>row.type===type&&!context.window.KomiShopCatalog.isArchived(row.id));
  assert.equal(countCards(container.innerHTML),Math.min(24,expected.length),type);
  if(expected.length>24)await scripts.click(eventButton('data-v7-more'));
  assert.equal(countCards(container.innerHTML),expected.length,type);
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
 assert.equal(countCards(container.innerHTML),24);
 assert.doesNotMatch(container.innerHTML,/data-item-id="(?:frame_moon|title_cinema)"/);
 await scripts.click(eventButton('data-v7-view','owned'));
 assert.equal(countCards(container.innerHTML),owned.store.owned.length);
 assert.match(container.innerHTML,/data-v3-hide-owned disabled/);
 assert.doesNotMatch(container.innerHTML,/пока нет купленных/);
});

test('V6 migration retains its original price cut and eight goods without redefining V7 additions',()=>{
 const migration=read('supabase/migrations/20261125100500_anicoin_shop_v6_catalog.sql');
 const parsePrices=t=>Object.fromEntries([...t.matchAll(/\('([a-z0-9_]+)',\s*(\d+),\s*true\)/g)].map(([,id,cost])=>[id,+cost]));
 const oldPrices=parsePrices(read('supabase/migrations/20261122070000_anicoin_visual_collections.sql'));
 const newPrices=parsePrices(migration);
 const v6Products=products.filter(row=>Object.hasOwn(newPrices,row.id));
 assert.equal(Object.keys(oldPrices).length,85);
 assert.equal(v6Products.length,93);
 assert.deepEqual(newPrices,Object.fromEntries(v6Products.map(row=>[row.id,row.cost])));
 assert.equal(Object.keys(newPrices).filter(id=>!Object.hasOwn(oldPrices,id)).length,8);
 for(const [id,price] of Object.entries(oldPrices))assert.ok(newPrices[id]<price,id);
 const checks=Object.fromEntries([...migration.matchAll(/add constraint (\w+)\s+check \([\s\S]+?\bin \(([\s\S]+?)\n  \)\);/g)]
  .map(([,constraint,list])=>[constraint,[...list.matchAll(/'([a-z0-9_]+)'/g)].map(match=>match[1])]));
 assert.deepEqual(checks.premium_store_purchases_item_id_check,[...v6Products.map(row=>row.id)]);
 for(const type of ['frame','title','banner','icon','plate','xp'])
  assert.deepEqual(checks['komi_premium_cosmetic_equips_'+type+'_id_check'],[...v6Products.filter(row=>row.type===type).map(row=>row.id)]);
 assert.match(migration,/security invoker set search_path = ''/);
 assert.match(migration,/select '20261125-shop-v6'/);
 assert.doesNotMatch(migration,/update public\.komi_anicoin_wallets|update komi_private\.premium_store_purchases|security definer/i);
 const visuals=read('komi-shop-v6-goods.css');
 for(const row of v6Products.filter(row=>!Object.hasOwn(oldPrices,row.id)&&row.type!=='title'))
  assert.ok(visuals.includes('komi-store-'+(row.frameClass||row.bannerClass||row.cosmeticClass)),row.id);
});

test('server revision must match before debiting and preview blocks even with the matching revision',async()=>{
 reset();
 const real=context.window.KomiShopCatalog;
 assert.equal(real.canCheckout(),false);
 assert.equal(await real.checkPricing({rpc:async()=>({data:'previous'})}),false);
 assert.equal(await real.checkPricing({rpc:async name=>{
   assert.equal(name,'komi_shop_station_revision');
   return {data:real.revision};
 }}),true);
 assert.equal(real.canCheckout(),true);
 context.window.location={hostname:'preview.vercel.app'};
 assert.equal(real.canCheckout(),false);
 assert.equal(await real.checkPricing({rpc:async()=>{throw Error('preview must not query');}}),false);
 context.window.KomiShopV3.render(container,guest);
 assert.match(container.innerHTML,/Предпросмотр оформления\. Покупки и подарки здесь отключены/);
 assert.equal((container.innerHTML.match(/disabled>Только примерка<\/button>/g)||[]).length,24);
 delete context.window.location;
});

test('first session uses existing IDs and verified prices without charging owned items',async()=>{
 reset();
 const ids=['frame_matte','title_cinema'],picks=ids.map(id=>context.window.KomiShopCatalog.find(id));
 const price=context.window.KomiShopV3.priceOf;
 assert.equal(price(picks,null),25);
 assert.equal(price(picks,{owned:['frame_matte']}),10);
 assert.equal(price(picks,{owned:['title_cinema']}),15);
 assert.equal(price(picks,{owned:ids}),0);
 assert.match(container.innerHTML,/Первый сеанс[\s\S]*?25 AniCoin/);
 await scripts.click(eventButton('data-v3-try','overlay_rain'));
 await scripts.click(eventButton('data-v3-bundle','first-session'));
 assert.deepEqual([...context.window.KomiShopV3.selected()],ids);
 assert.match(container.innerHTML,/data-fitting-active="true"/);
 reset();
 assert.match(container.innerHTML,/data-fitting-active="false"/);
});
test('rain IDs and prices stay stable; selection opens the appropriate context',async()=>{
 reset();
 const cat=context.window.KomiShopCatalog;
 assert.equal(cat.find('overlay_rain').label,'Дождь на обложке');
 assert.equal(cat.find('overlay_rain').cost,50);
 assert.equal(cat.find('plate_rain').label,'Дождь в комментариях');
 assert.equal(cat.find('plate_rain').cost,45);
 await scripts.click(eventButton('data-v3-try','overlay_rain'));
 assert.match(container.innerHTML,/id="sv7ProfilePreview">/);
 await scripts.click(eventButton('data-v3-try','plate_rain'));
 assert.match(container.innerHTML,/id="sv7CommentPreview">/);
 await scripts.click(eventButton('data-v3-try','reaction_cinema'));
 assert.match(container.innerHTML,/id="sv7ReactionPreview">/);
 assert.deepEqual([...context.window.KomiShopV3.selected()],['overlay_rain','plate_rain']);
 await scripts.click(eventButton('data-v3-reset'));
 assert.match(container.innerHTML,/data-fitting-active="false"/);
 assert.doesNotMatch(container.innerHTML,/id="sv7ReactionPreview"/);
 assert.match(container.innerHTML,/aria-controls="sv7FittingBody" aria-expanded="false"/);
});
