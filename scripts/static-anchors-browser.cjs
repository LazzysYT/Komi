const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const base=process.env.KOMI_TEST_URL||'http://127.0.0.1:8765/';

(async()=>{
 const browser=await chromium.launch({headless:true});
 try {
  for(const width of [1440,390]){
   const context=await browser.newContext({viewport:{width,height:850},javaScriptEnabled:false});
   const page=await context.newPage();
   const response=await page.goto(base,{waitUntil:'domcontentloaded',timeout:30000});
   assert.ok(response?.ok());
   const cards=page.locator('main#mainContainer #anime-grid .komi-seo-card');
   assert.ok(await cards.count()>=36,'SEO cards must exist before JavaScript');
   assert.equal(await page.locator('#anime-grid').getAttribute('aria-busy'),'false');
   assert.equal(await page.locator('main#mainContainer .komi-catalog-skeleton-card').count(),0);
   assert.equal(await page.locator('main#mainContainer .komi-catalog-skeleton-label').count(),0);
   assert.equal(await page.locator('main#mainContainer section#catalog').count(),1);
   assert.equal(await page.locator('main#mainContainer section#shop').count(),1);
   const quickFilters=page.locator('main#mainContainer #komiHomeQuickFilters select[data-komi-home-filter]');
   assert.equal(await quickFilters.count(),4,'Quick filters should be in server-delivered HTML before JS');
   assert.deepEqual(await quickFilters.evaluateAll(elements=>elements.map(el=>el.dataset.komiHomeFilter)),
     ['genre','year','type','sort']);
   const placeholders=await quickFilters.evaluateAll(elements=>elements.map(el=>({
     placeholder:el.options[0].textContent.trim(),
     label:document.querySelector('label[for="'+el.id+'"]')?.textContent.trim()||'',
     visible:!!document.querySelector('label[for="'+el.id+'"]')?.getBoundingClientRect().height
   })));
   assert.deepEqual(placeholders.map(row=>row.placeholder),['Все жанры','Все годы','Все типы','Сортировка']);
   assert.deepEqual(placeholders.map(row=>row.label),['Жанр','Год','Тип','Сортировка']);
   assert.ok(placeholders.every(row=>row.visible),'Filter labels must be visually present before JS');
   assert.equal(await page.locator('#komiHomeQuickFilters .section-see-all').getAttribute('href'),'/#catalog');
   assert.equal(await page.locator('#komiHomeQuickFilters .section-see-all').getAttribute('data-komi-click'),
     'home-quick-filters-all','First-paint anchor must activate the full catalog after hydration');
   assert.equal(await page.locator('meta[name="komi-ui-revision"]').getAttribute('content'),
     '20261120-admin-guest-gates');
   const catalogContainsFilters=await page.evaluate(() => {
     const filters=document.getElementById('komiHomeQuickFilters');
     const catalog=document.getElementById('catalog');
     return catalog.contains(filters);
   });
   assert.equal(catalogContainsFilters,true,'Media Hub places first-paint filters inside the static catalog');
   assert.equal(await page.locator('aside.komi-side-nav').evaluate(el=>getComputedStyle(el).display),
     'none','Inert fixed sidebar must not cover static links without JavaScript');
   const socials=page.locator('nav[aria-label="Социальные сети Komi Anime"] a');
   assert.equal(await socials.count(),2);
   for(const link of await socials.all())assert.equal(await link.locator('svg path').count(),1);
   await page.locator('#komiHomeQuickFilters .section-see-all').click();
   assert.equal(new URL(page.url()).hash,'#catalog',
     'With JS disabled the first-paint link must still reach the static catalog');
   const catalogTop=await page.locator('main section#catalog').evaluate(el=>el.getBoundingClientRect().top);
   assert.ok(catalogTop>=-110&&catalogTop<300,'Catalog link must scroll to catalog: '+catalogTop);
   await page.goto(base+'#shop',{waitUntil:'domcontentloaded'});
   assert.equal(new URL(page.url()).hash,'#shop');
   const shopTop=await page.locator('main section#shop').evaluate(el=>el.getBoundingClientRect().top);
   assert.ok(shopTop>=-110&&shopTop<850,'Shop link must reach target: '+shopTop);
   console.log('PASS JS-disabled',width,'static catalog, social SVG and anchored navigation');
   await context.close();
  }
 }finally{await browser.close();}
})().catch(err=>{console.error(err);process.exitCode=1;});
