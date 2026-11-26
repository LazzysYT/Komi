/* Exercise the actual guest page and real routing. No purchases are sent. */
'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict');
const origin=process.env.KOMI_TEST_URL||'http://127.0.0.1:8765/';
const entry=new URL('/#shop',origin).href;
const expectedIds=['title_crimson_hunter','title_moon_ronin','title_yokai_whisper'];
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.KOMI_CHROMIUM||undefined});
 try{
  for(const width of [1536,390]){
   const page=await browser.newPage({viewport:{width,height:860},reducedMotion:'reduce',serviceWorkers:'block'});
   const writes=[];
   await page.route('**/rest/v1/rpc/**',async route=>{
    const rpc=new URL(route.request().url()).pathname.split('/').at(-1);let args={};try{args=route.request().postDataJSON()||{};}catch{}
    if(rpc==='komi_shop_cart_buy_equip'||(['komi_premium_store','komi_shop_gifts','komi_shop_booster','komi_anicoin'].includes(rpc)&&args.p_action!=='read')){writes.push(rpc);return route.abort();}
    return route.continue();
   });
   await page.goto(entry,{waitUntil:'domcontentloaded'});
   const shop=page.locator('#shop.komi-shop-studio:not(.komi-static-shop)');
   await shop.waitFor({timeout:20000});
   const cards=shop.locator('.sv3-item');
   assert.equal(await cards.count(),24);
   assert.equal(await shop.locator('.sv12-gallery').count(),1);
   assert.equal(await shop.locator('[data-v7-category-select]').count(),0);
   for(const id of expectedIds)assert.equal(await shop.locator('[data-item-id="'+id+'"]').count(),1);
   assert.equal(await shop.locator('.sv3-item:not([data-item-type="title"])').count(),0);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   await shop.locator('[data-v7-more]').click();
   assert.equal(await cards.count(),34);
   assert.equal(await shop.locator('.sv12-gallery').count(),0);
   const search=shop.locator('[data-v7-search]');
   await search.fill('ронИн');
   assert.equal(await cards.count(),1);
   assert.equal(await cards.first().getAttribute('data-item-id'),'title_moon_ronin');
   await cards.first().locator('[data-v3-try]').click();
   assert.deepEqual(await page.evaluate(()=>window.KomiShopV3.selected()),['title_moon_ronin']);
   assert.equal(await shop.locator('.sv3-fitting [data-komi-title-id="title_moon_ronin"]').evaluate(n=>getComputedStyle(n,'::after').animationName),'none');
   await shop.locator('[data-v7-view="owned"]').click();
   assert.equal(await cards.count(),0);
   assert.match(await shop.locator('.sv3-no-results').textContent(),/Войди/);
   assert.deepEqual(writes,[]);
   await page.close();
   console.log('PASS '+width+'px: real title-only shop, search, pagination, fitting, guest inventory');
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
