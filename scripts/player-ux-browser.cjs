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
  assert.equal(await skip.isVisible(),false,'No skip control without verified intro timing');
  await page.evaluate(()=>{
   const video=document.getElementById('animeVideoPlayer');
   video.parentElement.parentElement.querySelector('.komi-cinema-toolbar').remove();
   document.querySelector('.komi-cinema-action-status').remove();
   video.replaceWith(video.cloneNode());
   const next=document.getElementById('animeVideoPlayer');
   Object.defineProperties(next,{
    duration:{configurable:true,value:1200},
    currentTime:{configurable:true,writable:true,value:7},
    paused:{configurable:true,writable:true,value:true}
   });
   next.play=async()=>{next.paused=false;};
   next.pause=()=>{next.paused=true;};
   KomiPlayerUX.mount({animeId:'777',userId:'test-account',season:1,index:0,hasNext:true,
     episodeMeta:[{introStart:8,introEnd:42}]});
  });
  assert.equal(await skip.isVisible(),false,'Do not hide the cold open');
  await page.evaluate(()=>{
   const video=document.getElementById('animeVideoPlayer');
   video.currentTime=10;video.dispatchEvent(new Event('timeupdate'));
  });
  assert.equal(await skip.isVisible(),true,'Verified timing makes Skip available inside the intro');
  await skip.click();
  assert.equal(await page.locator('#animeVideoPlayer').evaluate(el=>el.currentTime),42);
  assert.equal(await skip.isVisible(),false,'Skip must disappear after intro');

  await page.evaluate(()=>document.activeElement.blur());
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.locator('#animeVideoPlayer').evaluate(el=>el.currentTime),52);
  await page.keyboard.press('Space');
  assert.equal(await page.locator('#animeVideoPlayer').evaluate(el=>el.paused),false);
  await page.keyboard.press('m');
  assert.equal(await page.locator('#animeVideoPlayer').evaluate(el=>el.muted),true);
  await page.locator('#typeHere').focus();
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.locator('#animeVideoPlayer').evaluate(el=>el.currentTime),52,
   'Keyboard shortcuts must not steal keys from input fields');
  await page.evaluate(()=>document.activeElement.blur());
  await page.keyboard.press('Shift+N');
  assert.deepEqual(await page.evaluate(()=>window.__nextEpisodeArgs),['777',1,1,null,null,{playNative:true}]);
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
   // A real tap includes pointerdown before pointerup. The player ignores
   // stray pointerup events so a swipe cannot accidentally seek video.
   const tap=()=>{
     const coords={bubbles:true,pointerId:1,pointerType:'touch',
       clientX:bounds.left+bounds.width*.8,clientY:bounds.top+20};
     video.dispatchEvent(new PointerEvent('pointerdown',coords));
     video.dispatchEvent(new PointerEvent('pointerup',coords));
   };
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

  // Real two-second VP8 fixture (solid black, no network or licensed media).
  const native=await browser.newPage({viewport:{width:390,height:844}});
  native.on('pageerror',e=>errors.push(e.message));
  const media='https://media.komi-fixture.test/native-next.webm';
  await native.route(media,route=>route.fulfill({
    status:200,contentType:'video/webm',headers:{'access-control-allow-origin':'*'},
    body:Buffer.from('GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibUKHgQJChYECGFOAZwEAAAAAAAKIEU2bdLpNu4tTq4QVSalmU6yBoU27i1OrhBZUrmtTrIHWTbuMU6uEElTDZ1OsggEjTbuMU6uEHFO7a1OsggJy7AEAAAAAAABZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAVSalmsCrXsYMPQkBNgIxMYXZmNjEuNy4xMDNXQYxMYXZmNjEuNy4xMDNEiYhAn0AAAAAAABZUrmvIrgEAAAAAAAA/14EBc8WI+aOTEVQPRpicgQAitZyDdW5kiIEAhoVWX1ZQOIOBASPjg4QO5rKA4JCwgRi6gRCagQJVsIRVuYEBElTDZ/tzc59jwIBnyJlFo4dFTkNPREVSRIeMTGF2ZjYxLjcuMTAzc3PWY8CLY8WI+aOTEVQPRphnyKFFo4dFTkNPREVSRIeUTGF2YzYxLjE5LjEwMSBsaWJ2cHhnyKFFo4hEVVJBVElPTkSHkzAwOjAwOjAyLjAwMDAwMDAwMAAfQ7Z1QMnngQCjo4EAAIAQAgCdASoYABAAAEcIhYWIhYSIAgIACRHrgP7/q1CAo5WBAPoAsQEAARAQABgAGFgv9AAIQACjlYEB9ACxAQABEBAAGAAYWC/0AAhAAKOVgQLuALEBAAEQEAAYABhYL/QACEAAo5WBA+gAsQEAARAQABgAGFgv9AAIQACjlYEE4gCxAQABEBAAGAAYWC/0AAhAAKOVgQXcALEBAAEQEAAYABhYL/QACEAAo5WBBtYAsQEAARAQFGAAYWC/0AAhAAAcU7trkbuPs4EAt4r3gQHxggGj8IED','base64')
  }));
  await native.route('**/__komi_native_transition_fixture__',route=>route.fulfill({
    status:200,contentType:'text/html',
    body:`<!doctype html><html lang="ru"><head><meta charset="utf-8"></head><body>
    <div id="watchModal" class="active"><div id="watchModalContent"></div></div>
    <input id="outside" aria-label="Другой элемент">
    <script src="/player-core.js"></script><script src="/player-controls.js"></script>
    <script src="/player-runtime.js"></script><script src="/player-ux.js"></script></body></html>`
  }));
  await native.goto(new URL('/__komi_native_transition_fixture__',origin).href,{waitUntil:'load',timeout:20000});
  await native.clock.install();
  await native.evaluate(url=>{
    window.currentUser=null;
    window.saveProgress=()=>{};
    window.restoreKomiVideo=video=>{video.currentTime=.25;};
    window.showKomiPlayerError=()=>{ throw Error('Unexpected fixture media failure'); };
    window.testTransitions=[];
    window.openWatchModal=(_id,season,index,_source,_number,options)=>{
      window.testTransitions.push([season,index,options?.playNative === true]);
      const body=document.getElementById('watchModalContent');
      const old=body.querySelector('video');
      if (old) disposeKomiMedia(old);
      body.innerHTML='<div class="player-wrapper"><video controls playsinline preload="metadata" id="animeVideoPlayer"></video></div>';
      const video=body.querySelector('video');
      video.dataset.testEpisode=String(index);
      if (window.rejectNative) {
        const originalPlay=video.play;
        video.play=function () {
          video.play=originalPlay; // Real manual click is allowed.
          return Promise.reject(new DOMException('Autoplay denied','NotAllowedError'));
        };
      }
      bindKomiPlayer('777',season,index,url,index,options?.playNative === true);
      KomiPlayerUX.mount({animeId:'777',season,index,hasNext:true});
    };
    window.openWatchModal('777',1,0);
  },media);
  const video=native.locator('#animeVideoPlayer');
  await native.waitForFunction(()=>document.getElementById('animeVideoPlayer')?.readyState >= 1);
  assert.equal(await video.evaluate(v=>v.paused),true,'Ordinary direct entry remains paused');
  const endEpisode=()=>native.evaluate(()=>document.getElementById('animeVideoPlayer').dispatchEvent(new Event('ended')));
  await endEpisode();
  await native.getByRole('button',{name:'Остаться на этой серии'}).click();
  await native.clock.fastForward(6000);
  assert.equal(await native.evaluate(()=>window.testTransitions.length),1,'Cancel prevents both navigation and playback');
  await endEpisode();
  await native.clock.runFor(5100);
  await native.waitForFunction(()=>{
    const v=document.getElementById('animeVideoPlayer'); return v?.dataset.testEpisode==='1' && !v.paused && v.currentTime>.35;
  });
  assert.deepEqual(await native.evaluate(()=>window.testTransitions),[[1,0,false],[1,1,true]]);
  await video.evaluate(v=>v.pause());

  // An explicit opt-out keeps the manual prompt stable. If the browser denies
  // even the manual next request, focus Play and allow a genuine user retry.
  await native.locator('.komi-native-autonext').click();
  assert.equal(await native.locator('.komi-native-autonext').getAttribute('aria-pressed'),'false');
  await native.evaluate(()=>{ window.rejectNative=true; });
  await endEpisode();
  await native.clock.fastForward(6000);
  assert.equal(await native.evaluate(()=>window.testTransitions.length),2,'Opt-out must not advance');
  await native.getByRole('button',{name:'Смотреть следующую серию сейчас'}).click();
  const play=native.getByRole('button',{name:'Воспроизвести',exact:true});
  await native.waitForFunction(()=>document.activeElement?.getAttribute('data-control')==='play');
  await native.waitForFunction(()=>document.querySelector('.komi-cinema-action-status')?.textContent.includes('Серия готова'));
  assert.equal(await video.evaluate(v=>v.paused),true);
  await play.click();
  await native.waitForFunction(()=>{
    const v=document.getElementById('animeVideoPlayer'); return v?.dataset.testEpisode==='2' && !v.paused && v.currentTime>.35;
  });
  assert.deepEqual(await native.evaluate(()=>window.testTransitions.at(-1)),[1,2,true]);
  assert.notEqual(await native.locator('.komi-cinema-action-status').textContent(),'Серия готова. Нажми «Воспроизвести», чтобы начать.');
  await native.close();
  assert.deepEqual(errors,[],'Unexpected errors from either player fixture');
  console.log('PASS native transition: opt-out, cancel, decoded media playback, autoplay denial, focused manual Play');
  console.log('PASS cinema UX: skip, keyboard, focus, lights, viewed episodes, touch, external iframe limitations');
 } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
