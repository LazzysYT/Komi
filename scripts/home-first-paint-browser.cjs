/* Cold and returning-user reload: keep the daily hero paired through hydration. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const base=process.env.KOMI_TEST_URL||'http://127.0.0.1:8765/';
const curatedIds=['61316','61469','61967','60636','59978'];
const dailyLead=curatedIds[0];
const dailyArtwork='https://image.tmdb.org/t/p/w1280/f7StpjhGI5xdIecti2jQkQY38ov.jpg';
const imageFixture='<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720"><rect width="1280" height="720" fill="#43606f"/></svg>';
const make=(id,year,score)=>({
  shikimori_id:id,updated_at:new Date().toISOString(),
  data:{title:'First paint '+id,poster:'https://cdn.example.org/'+id+'.jpg',
    year:String(year),shikiRating:score,type:'Сериал',
    genres:['Экшен'],episodeCount:12,episodes:[]}
});
(async()=>{
  const browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:1280,height:800},reducedMotion:'reduce'});
  const page=await context.newPage();
  // The daily lead is fixed for this regression, including the cached reload.
  await page.clock.setFixedTime(new Date('2026-11-25T12:00:00Z'));
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  const first=Array.from({length:48},(_,i)=>make(i+1,2007,7));
  const second=[...Array.from({length:9},(_,i)=>make(i+49,2026,8+i/10)),
    {...make(58,2027,0),data:{...make(58,2027,0).data,episodeCount:0}},
    ...curatedIds.map((id,i)=>make(Number(id),2026,9.1+i/100))]
    .sort((a,b)=>a.shikimori_id-b.shikimori_id);
  let firstSeen;
  const firstFetched=new Promise(resolve=>firstSeen=resolve);
  let releaseSecond;
  let secondFetched=new Promise(resolve=>releaseSecond=resolve);
  let secondSeen;
  let secondRequested=new Promise(resolve=>secondSeen=resolve);
  // Keep image decoding deterministic while preserving the production artwork URL.
  await page.route('https://image.tmdb.org/**',route=>route.fulfill({
    status:200,contentType:'image/svg+xml',body:imageFixture
  }));
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
    // from the real Supabase catalog after our synthetic rows.
    await route.fulfill({status:200,contentType:'application/json',body:'[]'});
  });
  const activeHero=page.locator('#mainContainer .komi-home-hero .hero-slide.active');
  const readActiveHero=async()=>{
    await activeHero.waitFor({timeout:10000});
    await page.waitForFunction(()=>{
      const image=document.querySelector('#mainContainer .komi-home-hero .hero-slide.active .komi-hub-hero-art');
      return image?.complete&&image.naturalWidth>=2;
    },null,{timeout:10000});
    return activeHero.evaluate(async slide=>{
      const image=slide.querySelector('.komi-hub-hero-art');
      await image.decode();
      return {id:slide.dataset.komiAnimeId,title:slide.querySelector('h1').textContent.trim(),
        image:image.currentSrc,link:slide.querySelector('.komi-hub-play').getAttribute('href')};
    });
  };
  const assertDailyPair=(frame,title)=>{
    assert.equal(frame.id,dailyLead,'The daily lead must survive partial and complete catalog loads');
    assert.equal(frame.title,title,'The title must hydrate from the matching catalog row');
    assert.equal(frame.image,dailyArtwork,'The decoded artwork must match the daily lead');
    assert.equal(frame.link,'/anime/'+dailyLead+'#player','The watch link must match the title and artwork');
  };
  try{
    await page.goto(base,{waitUntil:'domcontentloaded',timeout:45000});
    await firstFetched;
    await Promise.race([secondRequested,new Promise((_,reject)=>
      setTimeout(()=>reject(new Error('Second catalog page not requested')),5000))]);
    // The neutral boot gives way to the decoded daily seed, never a temporary
    // selection from the first 48 IDs. Catalog hydration updates the same IDs.
    const seedFrame=await readActiveHero();
    const preview=await page.evaluate(()=>{
      const ids=[...document.querySelectorAll('#mainContainer .komi-home-hero .hero-slide[data-komi-anime-id]')].map(el=>String(el.dataset.komiAnimeId));
      const seedTitle=window.KomiHomeSeed.find(a=>String(a.id)===window.KomiHeroDaily.first)?.title;
      return {ids,seedTitle,ready:komiHomeCatalogReady,
        slides:document.querySelectorAll('#mainContainer .komi-home-hero .hero-slide').length};
    });
    assert.deepEqual(preview.ids,curatedIds,'The public seed must retain the daily curated order');
    assert.equal(preview.slides,6,'The five daily titles retain the additional promo slide');
    assert.ok(preview.seedTitle,'The daily lead must have a bundled seed title');
    assert.equal(preview.ready,false,'The first 48 records must not be marked as complete');
    assertDailyPair(seedFrame,preview.seedTitle);
    assert.doesNotMatch(seedFrame.title,/^First paint /);
    releaseSecond();
    await page.waitForFunction(lead=>komiHomeCatalogReady&&
      document.querySelector('#mainContainer .komi-home-hero .hero-slide.active h1')?.textContent.trim()==='First paint '+lead,
    dailyLead,{timeout:20000});
    const finalFrame=await readActiveHero();
    assertDailyPair(finalFrame,'First paint '+dailyLead);

    await page.waitForFunction(ids=>{try{
      const items=JSON.parse(localStorage.getItem('komi.public.home.preview.v2')||'null')?.items;
      return ids.every(id=>items?.some(a=>a.id===id&&a.title==='First paint '+id));
    }catch{return false}},curatedIds,{timeout:20000});
    // The public snapshot is now cached; keep the same finished hero visible
    // during the next refresh, even while the first 48 IDs are fetched again.
    secondFetched=new Promise(resolve=>releaseSecond=resolve);
    secondRequested=new Promise(resolve=>secondSeen=resolve);
    await page.reload({waitUntil:'domcontentloaded',timeout:45000});
    await secondRequested;
    const cachedFrame=await readActiveHero();
    assertDailyPair(cachedFrame,'First paint '+dailyLead);
    assert.deepEqual(cachedFrame,finalFrame,'A returning visitor must retain the fully hydrated daily frame');
    // A complete usable cache is already ready. Awaiting secondRequested while
    // secondFetched remains unresolved proves the background refresh is pending.
    releaseSecond();
    await page.waitForFunction(()=>komiHomeCatalogReady,{timeout:20000});
    assert.deepEqual(await readActiveHero(),finalFrame);
    assert.equal(errors.length,0,'No page exceptions: '+errors.join('; '));
    console.log('PASS cold and cached reload: daily title, decoded artwork and watch route stay paired');
  }finally{await context.close();await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
