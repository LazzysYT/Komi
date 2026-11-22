/* Isolated guest + mobile shop smoke test, independent of the legacy player regression. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const url=new URL('/#shop',process.env.KOMI_TEST_URL||'http://127.0.0.1:8765/').href;
const output=path.resolve('browser-test-results');
fs.mkdirSync(output,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:1600,height:900}});
 const shop=page.locator('#shop.komi-shop-v3');
 try{
   await page.goto(url,{waitUntil:'domcontentloaded',timeout:45000});
   await shop.waitFor({timeout:20000});
   assert.equal(await page.locator('#shop .sv3-item').count(),85,'Guest must see all 85 products');
   assert.equal(await page.locator('#shop .sv3-unit-price').count(),85,'Every product needs visible guest price');
   assert.ok((await page.locator('#shop .sv3-primary-buy').first().innerText()).includes('Войти'),
     'Guest buy action must request login');
   assert.equal(await page.locator('#shop .sv3-bento>article').count(),2);
   const geometry=await page.evaluate(()=>{
     const section=document.querySelector('#shop.komi-shop-v3');
     const top=section.querySelector('.sv3-topbar');
     const featured=section.querySelector('.sv3-bento');
     const tabs=section.querySelector('.sv3-filters');
     const grid=section.querySelector('.sv3-product-grid');
     const box=e=>{const r=e.getBoundingClientRect();return {top:r.top,bottom:r.bottom,height:r.height,width:r.width};};
     return {headerPosition:getComputedStyle(top).position,
       header:box(top),bento:box(featured),filters:box(tabs),
       columns:getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length,
       horizontalOverflow:document.documentElement.scrollWidth>window.innerWidth+2};
   });
   assert.equal(geometry.headerPosition,'relative',
     'Legacy site header must not make the inner shop topbar sticky');
   assert.ok(geometry.header.bottom+8<=geometry.bento.top,
     'Shop topbar must never overlap weekly Bento cards: '+JSON.stringify(geometry));
   assert.ok(geometry.filters.height<=90,
     'Desktop filter tabs should stay on one row: '+JSON.stringify(geometry));
   assert.ok(geometry.columns>=3,
     'Desktop shelf should use the available width: '+JSON.stringify(geometry));
   assert.equal(geometry.horizontalOverflow,false,'Desktop storefront should not overflow horizontally');

   await page.locator('#shop [data-v3-try="frame_moon"]').click();
   assert.ok((await page.locator('#shop .sv3-selection-list').innerText()).includes('Лунная рамка'),
     'Try-on must retain selected frame without purchase');
   await page.locator('#shop [data-v3-category="shape"]').click();
   assert.equal(await page.locator('#shop .sv3-item').count(),4,'Shapes category must show four products');
   assert.ok((await page.locator('#shop .sv3-selection-list').innerText()).includes('Лунная рамка'),
     'Selecting another category must not clear the fitting room');
   await page.locator('#shop [data-v3-sort]').selectOption('price-up');
   const prices=await page.locator('#shop .sv3-unit-price').allInnerTexts();
   const values=prices.map(x=>Number((x.match(/\d+/)||[])[0]));
   assert.deepEqual(values,[...values].sort((a,b)=>a-b),'Price sorting must be numeric');
   await page.screenshot({path:path.join(output,'shop-v3-desktop.png'),fullPage:true});
   await page.setViewportSize({width:390,height:844});
   const bar=page.locator('#shop .sv3-sheet-toggle');
   await bar.waitFor();
   assert.equal(await bar.isVisible(),true,'Mobile fitting room should use bottom sheet');
   assert.equal(await page.locator('#shop .sv3-fitting').evaluate(el=>getComputedStyle(el).position),'fixed');
   const fitting=page.locator('#shop .sv3-fitting');
   const startedOpen=await fitting.evaluate(el=>el.classList.contains('is-open'));
   await bar.click();
   assert.equal(await fitting.evaluate(el=>el.classList.contains('is-open')),!startedOpen,
     'Mobile sheet button should toggle open/closed state');
   if(startedOpen)await bar.click();
   assert.ok(await fitting.evaluate(el=>el.classList.contains('is-open')),
     'Mobile fitting room should expand');
   assert.equal(await page.locator('#shop .sv3-fitting-body').isVisible(),true);
   const mobileGeometry=await page.evaluate(()=>({
     headerPosition:getComputedStyle(document.querySelector('#shop .sv3-topbar')).position,
     horizontalOverflow:document.documentElement.scrollWidth>window.innerWidth+2,
     filtersHeight:document.querySelector('#shop .sv3-filters').getBoundingClientRect().height
   }));
   assert.equal(mobileGeometry.headerPosition,'relative');
   assert.equal(mobileGeometry.horizontalOverflow,false,
     'Mobile storefront must fit viewport width: '+JSON.stringify(mobileGeometry));
   await page.screenshot({path:path.join(output,'shop-v3-mobile.png'),fullPage:false});
   console.log('PASS Komi Shop V3 guest desktop + mobile: catalog, prices, filters, combo try-on, bottom sheet');
 }finally{await page.close();await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
