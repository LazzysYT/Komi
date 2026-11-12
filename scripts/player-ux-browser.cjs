const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const base=process.env.KOMI_TEST_URL||'http://127.0.0.1:8765/';
const origin=new URL(base);
const fixture=new URL('/__komi_player_ux_fixture__',origin).href;

(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.KOMI_CHROME?{executablePath:process.env.KOMI_CHROME}:{})});
 try {
  const page=await browser.newPage({viewport:{width:1280,height:850}});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/__komi_player_ux_fixture__',route=>route.fulfill({
   status:200,contentType:'text/html',
   body:`<!doctype html><html lang="ru"><head><meta charset="utf-8"></head><body>
    <div id="watchModal" class="active"><div id="watchModalContent">
      <div class="komi-watch-main"><div class="player-wrapper"><video id="animeVideoPlayer" style="width:640px;height:360px"></video></div>
      <div class="komi-episode-number-grid"><button type="button">1</button><button type="button">2</button></div></div>
    </div></div><input id="typeHere" aria-label="Печатать текст">
    <script src="/player-ux.js"></script></body></html>`
  }));
  await page.goto(fixture,{waitUntil:'load',timeout:20000});
  await page.evaluate(()=>{
   const video=document.getElementById('animeVideoPlayer');
   Object.defineProperty(video,'duration',{configurable:true,value:1200});
   Object.defineProperty(video,'currentTime',{configurable:true,writable:true,value:10});
   Object.defineProperty(video,'paused',{configurable:true,writable:true,value:true});
   video.play=async()=>{video.paused=false;};
   video.pause=()=>{video.paused=true;};
   window.openWatchModal=(...args)=>{window.__nextEpisodeArgs=args;};
   window.KomiPlayerUX.mount({animeId:'777',userId:'test-account',season:1,index:0,hasNext:true});
  });
  const skip=page.locator('.komi-cinema-skip');
  assert.equal(await skip.isVisible(),true,'Skip button should be available early in long native video');
  await skip.click();
  assert.equal(await page.locator('#animeVideoPlayer').evaluate(el=>el.currentTime),95);
  await page.evaluate(()=>document.activeElement.blur());
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.locator('#animeVideoPlayer').evaluate(el=>el.currentTime),105);
  await page.keyboard.press('Space');
  assert.equal(await page.locator('#animeVideoPlayer').evaluate(el=>el.paused),false);
  await page.keyboard.press('m');
  assert.equal(await page.locator('#animeVideoPlayer').evaluate(el=>el.muted),true);
  await page.locator('#typeHere').focus();
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.locator('#animeVideoPlayer').evaluate(el=>el.currentTime),105,
   'Keyboard shortcuts must not steal keys from input fields');
  await page.evaluate(()=>document.activeElement.blur());
  await page.keyboard.press('Shift+N');
  assert.deepEqual(await page.evaluate(()=>window.__nextEpisodeArgs),['777',1,1]);
  const light=page.locator('.komi-cinema-lights');
  await light.click();
  assert.equal(await light.getAttribute('aria-pressed'),'true');
  assert.equal(await page.locator('#watchModal').evaluate(el=>el.classList.contains('komi-lights-off')),true);
  await light.click();
  assert.equal(await light.getAttribute('aria-pressed'),'false');
  // Reach 92% while logged in: marker belongs only to this account.
  await page.evaluate(()=>{
   const video=document.getElementById('animeVideoPlayer');
   video.currentTime=1110;
   video.dispatchEvent(new Event('timeupdate'));
  });
  assert.equal(await page.locator('.komi-episode-number-grid .komi-episode-watched').count(),1);
  assert.equal(await page.evaluate(()=>KomiPlayerUX.readWatched('different-account','777').length),0);
  assert.equal(await page.evaluate(()=>KomiPlayerUX.readWatched('test-account','777').length),1);
  // Test mobile double tap without masking native video controls.
  await page.evaluate(()=>{
   const video=document.getElementById('animeVideoPlayer');
   video.currentTime=150;
   const bounds=video.getBoundingClientRect();
   const tap=()=>video.dispatchEvent(new PointerEvent('pointerup',{
     bubbles:true,pointerType:'touch',clientX:bounds.left+bounds.width*.8,clientY:bounds.top+20
   }));
   tap();tap();
  });
  assert.equal(await page.locator('#animeVideoPlayer').evaluate(el=>el.currentTime),160);
  // A cross-origin embed only receives the theater button and an honest limitation.
  await page.evaluate(()=>{
   document.querySelector('.komi-watch-main').innerHTML=
     '<div class="player-wrapper"><iframe src="about:blank"></iframe></div><div class="komi-episode-number-grid"><button>1</button></div>';
   KomiPlayerUX.mount({animeId:'777',userId:'test-account',season:1,index:0,hasNext:false});
  });
  assert.equal(await page.locator('.komi-cinema-skip').count(),0,'Iframe must not offer fake skip/seek');
  assert.match(await page.locator('.komi-cinema-external-note').innerText(),/Внешний плеер/);
  assert.deepEqual(errors,[],'Unexpected errors from player enhancement script');
  console.log('PASS cinema UX: skip, keyboard, focus, lights, viewed episodes, touch, external iframe limitations');
 } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
