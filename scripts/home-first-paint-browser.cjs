/* Cold and returning-user reload regression: no temporary low-ID hero. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const base=process.env.KOMI_TEST_URL||'http://127.0.0.1:8765/';
const make=(id,year,score)=>({
  shikimori_id:id,updated_at:new Date().toISOString(),
  data:{title:'First paint '+id,poster:'https://cdn.example.org/'+id+'.jpg',
    year:String(year),shikiRating:score,type:'Сериал',
    genres:['Экшен'],episodeCount:12,episodes:[]}
});
(async()=>{
  const browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:1280,height:800}});
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  const first=Array.from({length:48},(_,i)=>make(i+1,2007,7));
  const second=[...Array.from({length:9},(_,i)=>make(i+49,2026,8+i/10)),
    {...make(58,2027,0),data:{...make(58,2027,0).data,episodeCount:0}}];
  let firstSeen;
  const firstFetched=new Promise(resolve=>firstSeen=resolve);
  let releaseSecond;
  let secondFetched=new Promise(resolve=>releaseSecond=resolve);
  let secondSeen;
  let secondRequested=new Promise(resolve=>secondSeen=resolve);
  await page.route('**/rest/v1/komi_catalog_cards*',async route=>{
    const url=new URL(route.request().url());
    const cursor=url.searchParams.get('shikimori_id')||'';
    if(cursor==='gt.0'){
      await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(first)});
      firstSeen();
      return;
    }
    if(cursor==='gt.48'){
      secondSeen();
      await secondFetched;
      await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(second)});
      return;
    }
    // The optimized loader continues scanning until an empty page, even when
    // PostgREST caps a requested 1000-row page. Keep this fixture isolated
    // from the real Supabase catalog after our 58 synthetic rows.
    await route.fulfill({status:200,contentType:'application/json',body:'[]'});
  });
  try{
    await page.goto(base,{waitUntil:'domcontentloaded',timeout:45000});
    await firstFetched;
    await Promise.race([secondRequested,new Promise((_,reject)=>
      setTimeout(()=>reject(new Error('Second catalog page not requested')),5000))]);
    // V7+ ships a public seed selection, replacing SEO markup with an
    // interactive preview before the network finishes. The essential invariant
    // is that a partial low-ID page must never replace that selection.
    const hero=page.locator('#mainContainer .komi-home-hero .hero-slide.active h1');
    await hero.waitFor({timeout:10000});
    const preview=await page.evaluate(()=>{
      const ids=[...document.querySelectorAll('#mainContainer .komi-home-hero .hero-slide[data-komi-anime-id]')].map(el=>String(el.dataset.komiAnimeId));
      const expected=new Set(window.KomiHomeSnapshot.featured(window.KomiHomeSeed,komiAnimeYear).map(a=>String(a.id)));
      return {ids,expected:[...expected],ready:komiHomeCatalogReady};
    });
    assert.ok(preview.ids.length>0,'Public seed carousel must be visible');
    assert.ok(preview.ids.every(id=>preview.expected.includes(id)),'Only public seed selection may render before the final catalog');
    assert.equal(preview.ready,false,'The first 48 records must not be marked as complete');
    assert.doesNotMatch(await hero.innerText(),/First paint (?:[1-9]|[1-4][0-8])$/);
    releaseSecond();
    await page.waitForFunction(()=>komiHomeCatalogReady&&/^First paint (?:49|5[0-7])$/.test(document.querySelector('#mainContainer .komi-home-hero .hero-slide.active h1')?.textContent.trim()),null,{timeout:20000});
    const finalHero=await hero.innerText();
    assert.match(finalHero,/First paint (?:49|5[0-7])/);

    await page.waitForFunction(()=>{try{return JSON.parse(localStorage.getItem('komi.public.home.preview.v2')||'null')?.items?.some(a=>a.id==='57')}catch{return false}},null,{timeout:20000});
    // The public snapshot is now cached; keep the same finished hero visible
    // during the next refresh, even while the first 48 IDs are fetched again.
    secondFetched=new Promise(resolve=>releaseSecond=resolve);
    secondRequested=new Promise(resolve=>secondSeen=resolve);
    await page.reload({waitUntil:'domcontentloaded',timeout:45000});
    await secondRequested;
    const cachedHero=page.locator('#mainContainer .komi-home-hero .hero-slide.active h1');
    await cachedHero.waitFor({timeout:10000});
    const cachedTitle=await cachedHero.innerText();
    assert.match(cachedTitle,/^First paint (?:49|5[0-7])$/,'A returning visitor must see the complete cached selection, never the first 48');
    assert.equal(cachedTitle,finalHero,'Returning visitor should retain the same featured selection');
    releaseSecond();
    await page.waitForFunction(()=>komiHomeCatalogReady,{timeout:20000});
    assert.equal(await cachedHero.innerText(),finalHero);
    assert.equal(errors.length,0,'No page exceptions: '+errors.join('; '));
    console.log('PASS cold and cached reload: no low-ID hero flash');
  }finally{await context.close();await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
