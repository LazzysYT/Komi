const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.KOMI_CHROME ? {executablePath:process.env.KOMI_CHROME}:{})});
 const output=path.join(__dirname,'../browser-test-results');fs.mkdirSync(output,{recursive:true});
 try {
  for(const width of [1440,768,390,375]) {
   const page=await browser.newPage({viewport:{width,height:900}});const errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('https://**/*',route=>route.fulfill({status:200,contentType:'application/json',body:'{}'}));
   await page.goto(process.env.KOMI_TEST_URL || 'http://127.0.0.1:8765');
   await page.waitForFunction(()=>typeof bindKomiPlayer==='function');
   await page.evaluate(()=>{
    animeList=[{id:'1',title:'Проверка аниме',originalTitle:'Test',poster:'./anime-artwork.svg',genres:['Драма'],year:2026,shikiRating:8,
      episodes:[{season:1,number:1,sources:{Direct:'https://media.test/a.mp4',Embed:'<iframe src="https://media.test/player?a=1&amp;b=2"></iframe>'}},{season:1,number:2,sources:{Direct:'https://media.test/b.mp4'}}],komiDetailsLoaded:true}];
    catalogInitialLoadComplete=true;render();
   });
   await page.evaluate(()=>openWatchModal('1'));
   await page.waitForSelector('#animeVideoPlayer');
   const cinema = await page.evaluate(() => {
     const modal=document.getElementById('watchModalContent');
     const stage=document.querySelector('#watchModal .komi-watch-stage');
     const rect=modal.getBoundingClientRect();
     const radius=parseFloat(getComputedStyle(modal).borderTopLeftRadius);
     return { width:rect.width,height:rect.height,radius,stageDisplay:getComputedStyle(stage).display,columns:getComputedStyle(stage).gridTemplateColumns };
   });
   assert.ok(cinema.width >= width * .92, 'Watch modal should use almost full screen width');
   assert.ok(cinema.height >= 800, 'Watch modal should use almost full screen height');
   assert.ok(cinema.radius >= 15, 'Watch modal should have rounded corners');
   assert.equal(cinema.stageDisplay,'grid');
   await page.screenshot({path:path.join(output,`cinema-watch-${width}.png`)});

   const state=await page.evaluate(()=>{
    currentUser={username:'test_viewer'};
    const video=document.getElementById('animeVideoPlayer');
    video.dataset.owner='test_viewer';
    Object.defineProperty(video,'duration',{configurable:true,value:100});
    Object.defineProperty(video,'currentTime',{configurable:true,writable:true,value:42});
    video.dispatchEvent(new Event('loadedmetadata'));
    saveProgress('1',video,true);
    closeWatchModal();
    return getKomiProgress('1');
   });
   assert.equal(state.time,42);assert.equal(state.duration,100);
   await page.evaluate(()=>changePlayerSource('1',1,0,'Embed'));
   assert.equal(await page.locator('#watchModalContent iframe').getAttribute('src'),'https://media.test/player?a=1&b=2');
   assert.equal(await page.evaluate(()=>getKomiProgress('1').duration),100);
   await page.evaluate(()=>closeWatchModal());
   await page.locator('#searchInput').fill('Проверка');
   await page.waitForSelector('#komiCatalogGrid .anime-card');
   await page.evaluate(()=>openAuthModal('register'));
   await page.evaluate(()=>switchAuthTab('login'));
   assert.equal(await page.locator('#loginFormContainer').isVisible(),true);
   await page.evaluate(()=>closeAuthModal());
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);
   // Close during an outstanding detail request must not resurrect the modal.
   const race=await page.evaluate(async()=>{
    const original=ensureKomiAnimeDetails;let release;
    animeList[0].komiDetailsLoaded=false;
    ensureKomiAnimeDetails=()=>new Promise(resolve=>{release=resolve;});
    const pending=openWatchModal('1');closeWatchModal();release();await pending;
    ensureKomiAnimeDetails=original;
    return document.getElementById('watchModal').classList.contains('active');
   });assert.equal(race,false);
   await page.screenshot({path:path.join(output,`regression-${width}.png`),fullPage:true});
   assert.deepEqual(errors,[]);console.log('PASS browser',width,'progress/source/search/auth/close race/overflow');await page.close();
  }
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
