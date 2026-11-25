const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const base=process.env.KOMI_TEST_URL||'http://127.0.0.1:8765/';
const origin=new URL(base).origin;
const root=path.join(__dirname,'..');

(async()=>{
 const browser=await chromium.launch({headless:true});
 try {
  for(const width of [1440,390]){
   const context=await browser.newContext({viewport:{width,height:850},javaScriptEnabled:false});
   // Python's static CI server does not apply Vercel rewrites. Mirror only the
   // declared /catalog -> /index.html mapping for local navigation checks.
   if (['localhost','127.0.0.1'].includes(new URL(base).hostname)) {
    const config=JSON.parse(fs.readFileSync(path.join(root,'vercel.json'),'utf8'));
    assert.ok(config.rewrites.some(rule=>rule.source==='/catalog'&&rule.destination==='/index.html'));
    await context.route(url=>url.origin===origin&&url.pathname==='/catalog',route=>
      route.fulfill({path:path.join(root,'index.html'),contentType:'text/html; charset=utf-8'}));
   }
   const page=await context.newPage();
   const response=await page.goto(base,{waitUntil:'domcontentloaded',timeout:30000});
   assert.ok(response?.ok());
   const storefront=page.locator('main#mainContainer > .komi-static-storefront');
   const cards=storefront.locator('.komi-home-popular a.komi-discovery-card.komi-seo-card');
   assert.equal(await cards.count(),12,'The static recommendation shelf contains twelve real titles');
   const cardLinks=await cards.evaluateAll(nodes=>nodes.map(node=>node.getAttribute('href')));
   assert.equal(new Set(cardLinks).size,12,'Static recommendations must not repeat titles');
   for(const href of cardLinks) assert.match(href,/^\/anime\/[1-9][0-9]*$/);
   assert.equal(await cards.locator('img[width="240"][height="360"][loading="lazy"]').count(),12,
     'All static posters must reserve their 2:3 geometry and load lazily');
   assert.equal(await storefront.locator('[aria-busy="true"]').count(),0);
   assert.equal(await page.locator('main#mainContainer .komi-catalog-skeleton-card').count(),0);
   assert.equal(await page.locator('main#mainContainer .komi-catalog-skeleton-label').count(),0);
   assert.equal(await page.locator('main#mainContainer section#catalog').count(),0,
     'The full catalog must stay on its own route');
   assert.equal(await page.locator('main#mainContainer section#shop').count(),1);
   // Static first paint must deliver the eight new genre cards, not bulky selects.
   const moods=storefront.locator('.komi-home-genres-section a.komi-mood-card');
   assert.equal(await moods.count(),8,'Eight native mood links must work before JavaScript');
   assert.deepEqual(await moods.evaluateAll(nodes=>nodes.map(node=>node.dataset.komiMoodGenre)),
     ['Экшен','Романтика','Фэнтези','Комедия','Ужасы','Спорт','Исэкай','Психологическое']);
   for(const mood of await moods.all()) {
    const href=new URL(await mood.getAttribute('href'),base);
    assert.equal(href.pathname,'/catalog');
    assert.equal(href.searchParams.get('genre'),await mood.getAttribute('data-komi-mood-genre'),
      'A native genre link must carry its chosen filter');
   }
   assert.equal(await page.locator('#komiStaticMoodTitle').textContent(),'Жанры');
   assert.equal(await storefront.locator('select, .komi-catalog-tools, .komi-catalog-category-pills').count(),0);
   assert.equal(await page.locator('#komiHomeQuickFilters, #anime-grid').count(),0);
   const noJsLink=storefront.locator('footer a.komi-home-catalog-link');
   assert.equal(await noJsLink.count(),1,'The full catalog must remain reachable without JavaScript');
   assert.equal(await noJsLink.getAttribute('href'),'/catalog');
   assert.match(await page.locator('meta[name="komi-ui-revision"]').getAttribute('content'),
     /^20[0-9]{6}-[a-z0-9-]+$/,'The UI revision metadata must be present and versioned');
   assert.equal(await page.locator('aside.komi-side-nav').evaluate(el=>getComputedStyle(el).display),
     'none','Inert fixed sidebar must not cover static links without JavaScript');
   const socials=page.locator('nav[aria-label="Социальные сети Komi Anime"] a');
   assert.equal(await socials.count(),2);
   for(const link of await socials.all())assert.equal(await link.locator('svg path').count(),1);
   await storefront.locator('[data-komi-mood-genre="Экшен"]').click();
   assert.equal(new URL(page.url()).pathname,'/catalog');
   assert.equal(new URL(page.url()).searchParams.get('genre'),'Экшен',
     'The chosen genre survives native navigation with JavaScript disabled');
   await page.goto(base,{waitUntil:'domcontentloaded'});
   await page.locator('.komi-static-storefront footer .komi-home-catalog-link').click();
   assert.equal(new URL(page.url()).pathname,'/catalog');
   assert.equal(new URL(page.url()).search,'','The all-catalog link must not retain a genre');
   await page.goto(base+'#shop',{waitUntil:'domcontentloaded'});
   assert.equal(new URL(page.url()).hash,'#shop');
   const shopTop=await page.locator('main section#shop').evaluate(el=>el.getBoundingClientRect().top);
   assert.ok(shopTop>=-110&&shopTop<850,'Shop link must reach target: '+shopTop);
   console.log('PASS JS-disabled',width,'static recommendations, genre routes, social SVG and shop anchor');
   await context.close();
  }
 }finally{await browser.close();}
})().catch(err=>{console.error(err);process.exitCode=1;});
