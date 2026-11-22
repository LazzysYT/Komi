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
const products=context.window.KomiShopCatalog.items;
const guest={owner:'',store:null,wallet:null,displayName:'Гость',avatar:''};
const owned={owner:'uid-one',store:{balance:500,owned:['frame_moon','title_cinema'],frame_id:'frame_moon'},wallet:{balance:500},displayName:'Тестовый зритель',avatar:''};
function reset(){
 context.window.KomiShopV3.reset();
 context.window.KomiShopV3.render(container,guest);
}
function eventButton(name,id){
 return {target:{closest(selector){
  if(selector!=='button')return null;
  const d={};
  if(name==='data-v3-try')d.v3Try=id;
  if(name==='data-v3-category')d.v3Category=id;
  if(name==='data-v3-reset')d.v3Reset='';
  return {dataset:d,hasAttribute(k){return k===name;}};
 }}};
}
test('shop v3 JavaScript parses without frameworks and is initialized from the catalog',()=>{
 assert.doesNotThrow(()=>new vm.Script(js));
 assert.equal(products.length,85);
 assert.match(html,/src="\.\/komi-shop-v3\.js\?v=/);
 assert.match(html,/komi\.production\.css\?v=/);
 assert.match(core,/window\.KomiShopV3\?\.render/);
 assert.match(core,/window\.komiShopCheckoutCart/);
 assert.match(social,/section\.classList\.contains\('komi-shop-v3'\)/);
});
test('guest storefront shows all items, rarity, explicit prices and auth button',()=>{
 context.window.KomiShopV3.render(container,guest);
 const count=(container.innerHTML.match(/data-shop-item-action="/g)||[]).length;
 assert.equal(count,85);
 assert.match(container.innerHTML,/Магазин Komi/);
 assert.match(container.innerHTML,/Войти, чтобы купить/);
 assert.match(container.innerHTML,/sv3-unit-price/);
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
 context.window.KomiShopV3.render(container,guest);
 const frame=products.find(x=>x.id==='frame_moon');
 await scripts.click(eventButton('data-v3-try','frame_moon'));
 assert.deepEqual([...context.window.KomiShopV3.selected()],['frame_moon']);
 await scripts.click(eventButton('data-v3-category','shape'));
 assert.ok(container.innerHTML.includes('aria-pressed="true"'));
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
 assert.match(html,/komi\.production\.css\?v=20261122h/);
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

test('shop V4 follows monochrome sticker reference while preserving all purchase handlers',()=>{
 const icons=read('komi-shop-icons.js');
 const premium=read('komi-premium.js');
 const hero=read('komi-shop-hero.svg');
 const prodCSS=read('komi.production.css');
 context.window.KomiShopV3.render(container,guest);
 assert.match(container.innerHTML,/class="anicoin-shop komi-shop-v3 komi-shop-v4"/);
 assert.match(container.innerHTML,/Магазин KomiAnime/);
 assert.equal((container.innerHTML.match(/class="sv4-feature-card"/g)||[]).length,6);
 assert.match(container.innerHTML,/4K качество/);
 assert.match(container.innerHTML,/при наличии|доступно у источника/i);
 assert.match(container.innerHTML,/\+500 AniCoin/);
 assert.match(container.innerHTML,/Подарки друзьям/);
 assert.match(container.innerHTML,/Готовые наборы/);
 assert.match(container.innerHTML,/sv4-hero/);
 assert.match(container.innerHTML,/sv4-sticker/);
 const vectorCount=(container.innerHTML.match(/class="komi-sticker-icon"/g)||[]).length;
 const tryCount=(container.innerHTML.match(/data-v3-try="/g)||[]).length;
 assert.ok(vectorCount>=tryCount+6,
   'Icon kit should cover all visible try-on buttons and six feature badges');
 assert.match(html,/komi-shop-icons\.js\?v=20261122h/);
 assert.match(html,/komi-shop-v3\.js\?v=20261122h/);
 assert.match(html,/komi-shop-social\.js\?v=20261122h/);
 assert.match(icons,/Object\.freeze/);
 assert.match(social,/KomiShopIcons\?\.svg\('gift'/);
 assert.doesNotMatch(social,/komi-shop-gift-button','🎁'/);
 assert.match(premium,/sv4-perk-badge/);
 assert.match(css,/\.sv4-feature-grid/);
 assert.match(css,/\.sv3-primary-buy/);
 assert.match(css,/border-radius:999px/);
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.match(css,/shop\.komi-shop-v4 \.sv4-hero > header\.sv3-topbar/);
 assert.match(prodCSS,/sv4-feature-grid/);
 assert.match(prodCSS,/sv4-perk-badge/);
 assert.match(hero,/<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
 assert.doesNotMatch(hero,/<script|href="https?:/i);
 assert.doesNotMatch(container.innerHTML,/случайн(?:ые|ая) наград|рулетк[ау]|шанс выпадения/i);
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
