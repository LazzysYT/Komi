/* Verify the real built first-paint fallback while the full CSS is delayed. */
'use strict';
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  for(const width of [1440,390]){
   const page=await browser.newPage({viewport:{width,height:844}});
   let release;const gate=new Promise(resolve=>release=resolve);
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   try{
    await page.route('**/komi.production.css?*',async route=>{await gate;await route.continue();});
    await page.goto(process.env.KOMI_TEST_URL||'http://127.0.0.1:8766/',{waitUntil:'commit'});
    await page.locator('link[data-komi-first-paint]').waitFor({state:'attached'});
    await page.waitForFunction(()=>!!document.querySelector('link[data-komi-first-paint]')?.sheet);
    const title=page.locator('.komi-boot-real-hero .hero-slide.active h1, .komi-home-discovery .hero-slide.active h1');
    await title.first().waitFor({state:'visible',timeout:15000});
    assert.equal(await page.locator('#authModal').isVisible(),false);
    assert.equal(await page.locator('#watchModal').isVisible(),false);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);
    release();
    await page.waitForFunction(()=>!document.querySelector('link[data-komi-first-paint]')&&document.querySelector('link[data-komi-deferred-style="base"]')?.media==='all');
    assert.deepEqual(errors,[]);
    console.log('PASS critical CSS fallback and original cascade '+width);
   } finally {release();await page.close();}
  }
 } finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
