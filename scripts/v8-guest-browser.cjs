/* Focused V8 regression: public UI does not reveal personal account controls. */
'use strict';
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const base = process.env.KOMI_TEST_URL || 'http://127.0.0.1:8765/';
(async () => {
 const browser = await chromium.launch({headless:true});
 try {
  for (const width of [1440,390]) {
   const page = await browser.newPage({viewport:{width,height:844}});
   const errors=[];
   page.on('pageerror',error=>errors.push(error.message));
   try {
    await page.goto(base,{waitUntil:'domcontentloaded',timeout:45000});
    await page.waitForFunction(()=>typeof randomAnimeWithAnimation==='function'&&typeof renderHeaderUser==='function');
    await page.evaluate(()=>renderHeaderUser());
    for(const selector of ['#notifBellBtn','#notifDropdown','#komiFriendsMyTab','#komiHeaderAniCoin','[data-komi-mobile-extra="notifications"]']) {
      assert.equal(await page.locator(selector).isVisible(),false,'Guest control visible: '+selector+' at '+width);
    }
    assert.equal(await page.locator('#addAnimeBtn,#adminPanelBtn,#adminModal,#addModal').count(),0);
    const profile=page.locator('.komi-side-account');
    assert.equal(await profile.getAttribute('aria-label'),'Войти');
    assert.equal(await profile.locator('svg').count(),1);
    await profile.click();
    assert.equal(await page.locator('#authModal').evaluate(el=>el.classList.contains('active')),true);
    await page.evaluate(()=>closeAuthModal());
    // Exercise the no-results branch in this isolated browser only; no DB writes.
    await page.evaluate(()=>{
      animeList=[];
      catalogInitialLoadComplete=true;
      document.getElementById('rouletteContainer').classList.add('is-loading');
      randomAnimeWithAnimation();
    });
    assert.equal(await page.locator('#randomRouletteModal').evaluate(el=>el.classList.contains('active')),true);
    assert.equal(await page.locator('#rouletteRetry').isVisible(),true);
    assert.equal(await page.locator('#rouletteContainer').evaluate(el=>el.classList.contains('is-loading')),false);
    await page.evaluate(()=>closeKomiRoulette());
    assert.equal(await page.locator('#randomRouletteModal').evaluate(el=>el.classList.contains('active')),false);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);
    assert.deepEqual(errors,[]);
    console.log('PASS V8 guest UI, auth entry, empty roulette and overflow: '+width);
   } finally { await page.close(); }
  }
 } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1});
