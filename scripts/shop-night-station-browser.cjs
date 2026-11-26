/* Uses actual local assets and cart renderer; no backend requests allowed. */
'use strict';
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const origin='http://127.0.0.1:8767';
const output=process.env.KOMI_SHOP_OUTPUT;
const styles=['komi.production.css','komi-shop-v5.css','komi-shop-v6-goods.css'];
const scripts=['komi-shop-icons.js','komi-shop-reactions.js','komi-shop-catalog.js','komi-shop-v3.js','komi-premium-store.js'];
const artwork=['assets/shop-station/last-train.svg','assets/shop-station/moon-platform.svg'];
const retired=['banner_grid','frame_pixel','xp_hatch','xp_dots'];
const names=['banner_last_train','banner_moon_platform','frame_platform_light','overlay_station_rain','title_last_departure'];
const html='<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">'+styles.map(x=>'<link rel="stylesheet" href="/'+x+'">').join('')+'</head><body style="background:#09090b;color:#fff"><main style="width:min(1320px,100%);margin:auto" id="mainContainer"></main>'+scripts.map(x=>'<script src="/'+x+'"></script>').join('')+'</body></html>';
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.KOMI_CHROMIUM||undefined});
 try{
  for(const width of [1440,390,320]){
   const page=await browser.newPage({viewport:{width,height:1250},reducedMotion:'reduce'});
   page.setDefaultTimeout(7500);
   const read=new Set();
   await page.route('**/*',route=>{
    const url=new URL(route.request().url());
    if(url.origin!==origin)return route.abort();
    if(url.pathname==='/shop')return route.fulfill({contentType:'text/html',body:html});
    const name=url.pathname.slice(1);
    if(![...styles,...scripts,...artwork].includes(name))return route.abort();
    if(artwork.includes(name))read.add(name);
    return route.fulfill({contentType:name.endsWith('.svg')?'image/svg+xml':name.endsWith('.css')?'text/css':'application/javascript',body:fs.readFileSync(path.join(__dirname,'..',name),'utf8')});
   });
   await page.goto(origin+'/shop?shop_page=6');
   await page.evaluate(({retired})=>{
     window.currentView='shop';
     const render=()=>window.KomiShopV3.render(document.getElementById('mainContainer'),{owner:'demo',store:{owned:retired,balance:150,frame_id:'frame_pixel'},displayName:'Гость'});
     window.renderAniCoinShop=render;render();
   },{retired});
   assert.equal(await page.locator('.sv3-item').count(),142);
   const poster=page.locator('.sv10-station');
   assert.equal(await poster.isVisible(),true);
   if(output&&width===1440)await poster.screenshot({path:path.join(output,'KomiAnime-Station-0017.png')});
   for(const id of retired)assert.equal(await page.locator('[data-item-id="'+id+'"]').count(),0);
   await poster.getByRole('button',{name:'Примерить образ'}).click();
   assert.deepEqual(await page.evaluate(()=>window.KomiShopV3.selected()),['frame_platform_light','banner_last_train','title_last_departure']);
   assert.match(await page.locator('.sv3-checkout-info strong').textContent(),/90/);
   assert.match(await page.locator('.sv3-profile-cover').evaluate(n=>getComputedStyle(n).backgroundImage),/last-train\.svg/);
   await page.evaluate(()=>window.KomiShopV3.reset());
   await poster.getByRole('button',{name:'Смотреть 5 предметов'}).click();
   assert.equal(await page.locator('.sv3-item').count(),5);
   for(const id of names)assert.equal(await page.locator('[data-item-id="'+id+'"]').count(),1);
   assert.equal(await page.locator('[data-v3-reset-filters]').evaluate(el=>el===document.activeElement),true);
   await page.evaluate(async()=>{await Promise.all(['last-train','moon-platform'].map(n=>{const i=new Image();i.src='/assets/shop-station/'+n+'.svg';return i.decode();}));});
   assert.equal(read.size,2);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   if(output&&width===390)await page.locator('.sv3-product-grid').screenshot({path:path.join(output,'KomiAnime-Station-0017-mobile.png')});
   await page.locator('[data-v7-view="owned"]').click();
   assert.deepEqual((await page.locator('.sv3-item').evaluateAll(nodes=>nodes.map(n=>n.dataset.itemId))).sort(),retired.slice().sort());
   assert.match(await page.locator('[data-item-id="frame_pixel"] .sv3-owned').textContent(),/Надето/);
   assert.match(await page.locator('[data-item-id="banner_grid"] .sv7-item-kind').textContent(),/Архив/);
   await page.locator('[data-v3-try="frame_pixel"]').click();
   assert.deepEqual(await page.evaluate(()=>window.KomiShopV3.selected()),['frame_pixel']);
   await page.evaluate(()=>{
    const main=document.getElementById('mainContainer');
    main.innerHTML='<div id="profile" class="komi-profile-premium-mono" data-profile-user="demo"><div class="profile-header-card"><div data-profile-cover class="profile-cover"></div><div class="profile-avatar-frame"></div></div></div>';
    window.KomiPremium={idForUsername:()=>'demo'};
    window.KomiPremiumStore.setClient({from:()=>({select:()=>({limit:async()=>({data:[{user_id:'demo',banner_id:'banner_moon_platform',frame_id:'frame_platform_light',overlay_id:'overlay_station_rain'}]})})})});
   });
   await page.waitForFunction(()=>document.querySelector('.komi-store-banner-moon-platform'));
   const render=await page.locator('.profile-cover').evaluate(n=>[getComputedStyle(n,'::after').backgroundImage,getComputedStyle(n,'::before').animationName]);
   assert.match(render[0],/moon-platform\.svg/);
   assert.equal(render[1],'none');
   console.log('PASS '+width+'px: two covers, five products, real try-on, archive inventory, reduced motion and no backend');
   await page.close();
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
