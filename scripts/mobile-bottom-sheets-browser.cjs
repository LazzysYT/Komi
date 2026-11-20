'use strict';
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const base=process.env.KOMI_TEST_URL||'http://127.0.0.1:8765/';

(async()=>{
  const browser=await chromium.launch({headless:true,...(process.env.KOMI_CHROME?{executablePath:process.env.KOMI_CHROME}:{})});
  try{
    for(const width of [390,1024]){
      const page=await browser.newPage({viewport:{width,height:844},deviceScaleFactor:1});
      const errors=[];
      page.on('pageerror',e=>errors.push(e.message));
      await page.goto(base,{waitUntil:'domcontentloaded',timeout:45000});
      await page.waitForFunction(()=>window.KomiMobileSheets && typeof window.KomiMobileSheets.openFilters==='function');
      await page.evaluate(()=>{
        const area=document.createElement('div');
        area.id='komiMobileSheetTest';
        area.innerHTML='<div class="anime-card"><div class="anime-poster-box"><div class="komi-card-quick">'+
            '<button class="komi-card-quick-toggle" type="button">+</button></div></div></div>';
        document.body.append(area);
      });
      const plus=await page.locator('#komiMobileSheetTest .komi-card-quick-toggle').evaluate(el=>{
        const style=getComputedStyle(el);
        const line=getComputedStyle(el,'::before');
        return {font:style.fontSize,top:line.top,left:line.left,transform:line.transform};
      });
      assert.equal(plus.font,'0px','plus character should not depend on font baseline');
      assert.ok(parseFloat(plus.top)>0,'plus vertical center is positioned');
      assert.ok(Math.abs(parseFloat(plus.top)-parseFloat(plus.left))<=1,
        'plus bars must share the same optical center');

      await page.evaluate(()=>{
        window.navigate('catalog');
        const root=document.getElementById('mainContainer');
        root.innerHTML='<section class="komi-hub-catalog-toolbar">'+
          '<h1 id="komiFullCatalogTitle">Каталог</h1>'+
          '<button class="komi-mobile-filter-trigger" type="button">Фильтры</button>'+
          '<select id="komiCatalogGenre"><option value="Все">Все</option><option value="Фэнтези">Фэнтези</option></select>'+
          '<select id="komiCatalogYear"><option value="Все">Все</option><option value="2026">2026</option></select>'+
          '<select id="komiCatalogType"><option value="Все">Все</option><option value="Фильм">Фильм</option></select>'+
          '<select id="komiCatalogSort"><option value="popular">Актуальные</option><option value="rating">Рейтинг</option></select>'+
          '<label><input id="komiHideWatched" type="checkbox"></label></section>'+
          '<div id="komiCatalogGrid"></div>';
      });
      if(width>767) {
        assert.equal(await page.locator('.komi-mobile-filter-trigger').isVisible(),false);
        assert.equal(await page.evaluate(()=>window.KomiMobileSheets.openFilters()),false);
      } else {
        await page.locator('.komi-mobile-filter-trigger').click();
        await page.locator('#komiMobileSheet .komi-mobile-sheet-panel').waitFor({state:'visible'});
        await page.locator('#komiMobileSheet select[aria-label="Сортировка"]').selectOption('rating');
        await page.locator('.komi-mobile-sheet-apply').click();
        assert.equal(new URL(page.url()).searchParams.get('sort'),'rating',
          'filter sheet must apply all choices in one URL update');
        assert.equal(await page.locator('#komiMobileSheet').evaluate(el=>el.hidden),true);

        await page.evaluate(()=>{
          const modal=document.getElementById('watchModal');
          modal.classList.add('active');
          const content=document.getElementById('watchModalContent');
          content.replaceChildren();
          content.innerHTML='<div class="komi-watch-stage">'+
            '<div class="komi-watch-controls"><button id="fakeEpisodeTrigger">Серии</button></div>'+
            '<select id="komiWatchSourceSelect"><option value="Kodik">Kodik</option>'+
            '<option value="AniLibria">AniLibria</option></select>'+
            '<aside class="komi-watch-sidebar"><div class="komi-episode-number-grid">'+
            '<button class="komi-episode-number active" aria-current="true">1</button>'+
            '<button class="komi-episode-number">2</button></div></aside></div>';
          window.__sheetChanges=0;
          content.querySelector('#komiWatchSourceSelect').addEventListener('change',()=>window.__sheetChanges++);
        });
        await page.evaluate(()=>window.KomiMobileSheets.openSource(document.getElementById('fakeEpisodeTrigger')));
        await page.locator('.komi-mobile-sheet-option').filter({hasText:'AniLibria'}).click();
        assert.equal(await page.evaluate(()=>window.__sheetChanges),1,
          'source change should reuse the original select handler');
        await page.evaluate(()=>window.KomiMobileSheets.openEpisodes(document.getElementById('fakeEpisodeTrigger')));
        assert.equal(await page.locator('#komiMobileSheet .komi-watch-sidebar').count(),1);
        assert.equal(await page.locator('#watchModalContent .komi-watch-sidebar').count(),0);
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('#watchModalContent .komi-watch-sidebar').count(),1,
          'closed sheet must restore the original sidebar');
        assert.equal(await page.locator('#komiMobileSheet').evaluate(el=>el.hidden),true);
        await page.evaluate(()=>{window.KomiMobileSheets.close(false);document.getElementById('watchModal').classList.remove('active')});
      }
      assert.equal(errors.length,0,'Unexpected client error: '+errors.join('; '));
      console.log('PASS mobile sheets and centered plus at '+width+'px');
      await page.close();
    }
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
