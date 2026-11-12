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
   const socials=page.locator('nav[aria-label="Социальные сети Komi Anime"] a');
   assert.equal(await socials.count(),2);
   for(const link of await socials.all())assert.equal(await link.locator('svg path').count(),1);
   await page.locator('main a[href="#catalog"]').click();
   assert.equal(new URL(page.url()).hash,'#catalog');
   const catalogTop=await page.locator('main section#catalog').evaluate(el=>el.getBoundingClientRect().top);
   assert.ok(catalogTop>=-110&&catalogTop<300,'Catalog link must scroll to catalog: '+catalogTop);
   await page.locator('main a[href="#shop"]').click();
   assert.equal(new URL(page.url()).hash,'#shop');
   const shopTop=await page.locator('main section#shop').evaluate(el=>el.getBoundingClientRect().top);
   assert.ok(shopTop>=-110&&shopTop<850,'Shop link must reach target: '+shopTop);
   console.log('PASS JS-disabled',width,'static catalog, social SVG and anchored navigation');
   await context.close();
  }
 }finally{await browser.close();}
})().catch(err=>{console.error(err);process.exitCode=1;});
