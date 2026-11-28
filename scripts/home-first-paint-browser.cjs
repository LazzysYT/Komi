/* Cold and returning-user reload: keep the daily hero paired through hydration. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const base=process.env.KOMI_TEST_URL||'http://127.0.0.1:8765/';
const curatedIds=['61316','61469','61967','60636','59978'];
const dailyLead=curatedIds[0];
const dailyArtworkPath='/assets/hero/daily/61316-f7StpjhGI5xdIecti2jQkQY38ov.webp';
const dailyArtwork=new URL(dailyArtworkPath,base).href;
const seed={};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../komi-home-seed.js'),'utf8'),seed);
const dailySeedTitle=seed.KomiHomeSeed.find(anime=>String(anime.id)===dailyLead)?.title;
assert.ok(dailySeedTitle,'The daily lead must have a bundled seed title');
const imageFixture='<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720"><rect width="1280" height="720" fill="#43606f"/></svg>';
const deferred=()=>{let resolve;const promise=new Promise(done=>resolve=done);return {promise,resolve};};
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
  const appMainUrl=/\/app-main\.js(?:\?|$)/;
  let appMain=deferred();
  let closing=false;
  // Match the versioned filename in source and minified deployments alike.
  // A held deferred script must not prevent the head boot from painting a hero.
  await page.route(appMainUrl,async route=>{
    const held=appMain;
    await held.promise;
    try{await route.continue();}
    catch(error){if(!closing&&!route.request().failure())throw error;}
  });
  // Keep image decoding deterministic while preserving the production artwork URL.
  await page.route('**/assets/hero/daily/*.webp',route=>route.fulfill({
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
  const assertFooterBelowFirstViewport=async label=>{
    const original=page.viewportSize();
    try{
      for(const viewport of [{width:1280,height:800},{width:390,height:844}]){
        await page.setViewportSize(viewport);
        await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
        const footer=await page.locator('body > .komi-public-footer').evaluate(node=>{
          const rect=node.getBoundingClientRect(),style=getComputedStyle(node);
          return {top:rect.top,height:rect.height,viewport:innerHeight,
            visible:!node.hidden&&style.display!=='none'&&style.visibility!=='hidden',
            links:[...node.querySelectorAll('a')].map(link=>link.getAttribute('href'))};
        });
        assert.ok(footer.visible&&footer.height>0,label+': the native public footer must remain available');
        assert.ok(footer.top>=footer.viewport-1,
          label+': public footer must stay below the first '+viewport.width+'px viewport while app-main is held');
        assert.deepEqual(footer.links,['/','/catalog','/about','/contacts','/partners','/security','/copyright','https://www.tiktok.com/@komi_animeofficial','https://t.me/+X9yUQPEBldo2MzNi']);
      }
    }finally{await page.setViewportSize(original);}
  };
  const captureBootPreview=async label=>{
    const boot=page.locator('#mainContainer .komi-home-discovery[data-komi-boot-preview]');
    await boot.waitFor({state:'visible',timeout:10000});
    const state=await boot.evaluate(preview=>{
      const first=window.KomiHeroDaily?.firstImage;
      const image=preview.querySelector('.hero-slide.active .komi-hub-hero-art');
      const watch=preview.querySelector('.hero-slide.active .komi-hub-play');
      const buttons=[...preview.querySelectorAll('.komi-home-hero button')];
      return {appStarted:typeof window.render==='function',readyState:document.readyState,
        id:first?.id,src:first?.src,ready:first?.ready,
        hasPromise:typeof first?.promise?.then==='function',sameImage:first?.image===image,
        decoded:!!image?.complete&&image.naturalWidth>=2,
        nativeWatch:watch?.tagName==='A'&&!watch.closest('[inert]')&&
          watch.getAttribute('aria-disabled')!=='true'&&!watch.hasAttribute('disabled'),
        buttons:buttons.length,allDisabled:buttons.every(button=>button.disabled)};
    });
    assert.equal(state.appStarted,false,label+': the preview must render before app-main executes');
    assert.equal(state.readyState,'interactive',label+': the held deferred app must still block DOMContentLoaded');
    assert.equal(state.id,dailyLead);
    assert.equal(state.src,dailyArtworkPath);
    assert.equal(state.ready,true,label+': the shared first image must have finished decoding');
    assert.equal(state.hasPromise,true);
    assert.equal(state.sameImage,true,label+': the decoded boot image must be the visible DOM node');
    assert.equal(state.decoded,true);
    assert.equal(state.nativeWatch,true,label+': the watch link must work before JavaScript handlers exist');
    assert.ok(state.buttons>0,'The preview must retain its pending JavaScript controls');
    assert.equal(state.allDisabled,true,label+': JavaScript-only hero controls must wait for hydration');
    await assertFooterBelowFirstViewport(label);
    const frame=await readActiveHero();
    assertDailyPair(frame,dailySeedTitle);
    const image=await activeHero.locator('.komi-hub-hero-art').elementHandle();
    assert.ok(image,'The early lead image must be retained for identity checks');
    return {frame,image};
  };
  const assertAdoptedImage=async(image,label)=>{
    await page.waitForFunction(()=>{
      const home=document.querySelector('#mainContainer .komi-home-discovery');
      const controls=[...(home?.querySelectorAll('.komi-home-hero button:not([data-komi-hero-toggle])')||[])];
      // Reduced motion intentionally disables Pause, but manual navigation and
      // list actions must become available after their real owners initialize.
      return home&&!home.hasAttribute('data-komi-boot-preview')&&controls.length>0&&
        controls.every(button=>!button.disabled);
    },null,{timeout:10000});
    const retained=await page.evaluate(original=>{
      const image=document.querySelector('#mainContainer .komi-home-hero .hero-slide.active .komi-hub-hero-art');
      return {same:original===image,connected:original.isConnected,
        shared:window.KomiHeroDaily.firstImage.image===original};
    },image);
    assert.deepEqual(retained,{same:true,connected:true,shared:true},
      label+': hydration must adopt the decoded lead image, not replace it with an identical URL');
  };
  const openWithAppHeld=async reload=>{
    await Promise.all([
      page.waitForRequest(appMainUrl,{timeout:10000}),
      reload?page.reload({waitUntil:'commit',timeout:45000}):page.goto(base,{waitUntil:'commit',timeout:45000})
    ]);
  };
  try{
    await openWithAppHeld(false);
    const coldBoot=await captureBootPreview('Cold load');
    appMain.resolve();
    await page.waitForLoadState('domcontentloaded',{timeout:45000});
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
    await assertAdoptedImage(coldBoot.image,'Cold partial catalog');
    releaseSecond();
    await page.waitForFunction(lead=>komiHomeCatalogReady&&
      document.querySelector('#mainContainer .komi-home-hero .hero-slide.active h1')?.textContent.trim()==='First paint '+lead,
    dailyLead,{timeout:20000});
    const finalFrame=await readActiveHero();
    assertDailyPair(finalFrame,'First paint '+dailyLead);
    await assertAdoptedImage(coldBoot.image,'Cold complete catalog');
    await coldBoot.image.dispose();

    await page.waitForFunction(ids=>{try{
      const items=JSON.parse(localStorage.getItem('komi.public.home.preview.v2')||'null')?.items;
      return ids.every(id=>items?.some(a=>a.id===id&&a.title==='First paint '+id));
    }catch{return false}},curatedIds,{timeout:20000});
    // The public snapshot is now cached; keep the same finished hero visible
    // during the next refresh, even while the first 48 IDs are fetched again.
    secondFetched=new Promise(resolve=>releaseSecond=resolve);
    secondRequested=new Promise(resolve=>secondSeen=resolve);
    appMain=deferred();
    await openWithAppHeld(true);
    const cachedBoot=await captureBootPreview('Cached reload');
    assert.deepEqual(cachedBoot.frame,coldBoot.frame,'Boot must choose the same daily seed before either app load');
    appMain.resolve();
    await page.waitForLoadState('domcontentloaded',{timeout:45000});
    await secondRequested;
    await page.waitForFunction(lead=>
      document.querySelector('#mainContainer .komi-home-hero .hero-slide.active h1')?.textContent.trim()==='First paint '+lead,
    dailyLead,{timeout:10000});
    const cachedFrame=await readActiveHero();
    assertDailyPair(cachedFrame,'First paint '+dailyLead);
    assert.deepEqual(cachedFrame,finalFrame,'A returning visitor must retain the fully hydrated daily frame');
    await assertAdoptedImage(cachedBoot.image,'Cached partial refresh');
    // A complete usable cache is already ready. Awaiting secondRequested while
    // secondFetched remains unresolved proves the background refresh is pending.
    releaseSecond();
    await page.waitForFunction(()=>komiHomeCatalogReady&&!komiCatalogLoadPending,null,{timeout:20000});
    assert.deepEqual(await readActiveHero(),finalFrame);
    await assertAdoptedImage(cachedBoot.image,'Cached complete refresh');
    await cachedBoot.image.dispose();

    // Exercise the pre-app anchor itself after the retention assertions. A
    // deterministic local destination proves native navigation without opening
    // a live provider or relying on an SPA handler that is deliberately held.
    const watchPath='/anime/'+dailyLead;
    await page.route(url=>url.pathname===watchPath,route=>route.fulfill({
      status:200,contentType:'text/html',body:'<!doctype html><title>Native watch fixture</title><h1>Native watch navigation</h1>'
    }));
    appMain=deferred();
    await openWithAppHeld(true);
    const nativeBoot=await captureBootPreview('Native watch');
    await nativeBoot.image.dispose();
    await Promise.all([
      page.waitForURL(url=>url.pathname===watchPath&&url.hash==='#player',{waitUntil:'domcontentloaded',timeout:10000}),
      activeHero.locator('.komi-hub-play').click()
    ]);
    assert.equal(await page.locator('h1').textContent(),'Native watch navigation');
    assert.equal(errors.length,0,'No page exceptions: '+errors.join('; '));
    console.log('PASS early, cold and cached reload: daily title/art/watch route paired, decoded image node retained, native watch link works before app-main, public footer stays below desktop/mobile first viewport');
  }finally{closing=true;appMain.resolve();releaseSecond();await context.close();await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
