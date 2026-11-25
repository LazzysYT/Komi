'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require(process.env.KOMI_PLAYWRIGHT||'playwright');
const root=path.join(__dirname,'..');
const read=n=>fs.readFileSync(path.join(root,n),'utf8');
const app=read('app-main.js');
const start=app.indexOf('        const komiProfileLifetimeWatch=');
const end=app.indexOf('        // Quest XP always comes from',start);
assert.ok(end>start&&start>0);
const script=app.slice(start,end);
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.KOMI_CHROME||undefined,args:['--no-sandbox']});
 try{
  for(const width of [390,1280]){
   const page=await browser.newPage({viewport:{width,height:740}});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.route('https://komi-test.example/profile',route=>route.fulfill({contentType:'text/html',body:`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><main id="profile" data-profile-user="tester"></main><video id="animeVideoPlayer" data-owner="a" data-anime-id="42" data-season="1" data-episode="0"></video>`}));
   await page.goto('https://komi-test.example/profile');
   await page.addStyleTag({content:`#profile .profile-summary{display:grid;gap:5px;grid-template-columns:repeat(5,minmax(0,1fr))}
    @media(max-width:580px){#profile .profile-summary{grid-template-columns:repeat(2,minmax(0,1fr))}}`+read('profile-studio.css')});
   await page.evaluate(()=>{
    window.currentUser={username:'tester',authUserId:'a'};
    window.clockAt=0;
    Object.defineProperty(performance,'now',{value:()=>window.clockAt});
    const sessionRows=new Map();
    window.finished=2;
    window._supabase={
     from:table=>({select:()=>({eq:(_key,value)=>({abortSignal:async()=>{
       if(table!=='komi_watched_episodes'||value!==window.currentUser.authUserId)throw Error('Unsafe episode read');
       return {count:window.finished};
     }})})}),
     rpc:(action,p)=>{
      if(p.p_owner!==window.currentUser.authUserId)throw Error('Unexpected owner');
      const reply=()=>{
       if(action==='komi_save_watch_session'){
        sessionRows.set(p.p_session,Math.max(sessionRows.get(p.p_session)||0,p.p_seconds));
        return {data:true};
       }
       return {data:[...sessionRows.values()].reduce((a,b)=>a+b,0)};
      };
      return {then:(yes,no)=>Promise.resolve(reply()).then(yes,no),abortSignal:async()=>reply()};
     }
    };
   });
   await page.addScriptTag({path:path.join(root,'profile-premium.js')});
   await page.addScriptTag({path:path.join(root,'komi-watch-stats.js')});
   await page.addScriptTag({content:script+'\nwindow.readWatch=komiProfileLifetimeRead;'});
   await page.evaluate(async()=>{
    const profile=document.getElementById('profile');
    profile.className='komi-profile-studio komi-profile-premium-mono';
    profile.innerHTML=KomiProfileUI.summary({ownWatchStats:true});
    const video=document.querySelector('video');
    let paused=false,position=0,seeking=false;
    Object.defineProperties(video,{paused:{get:()=>paused},currentTime:{get:()=>position},seeking:{get:()=>seeking}});
    window.playAt=(delta)=>{clockAt+=1000;position+=delta;video.dispatchEvent(new Event('timeupdate'));};
    window.pauseAt=()=>{paused=true;video.dispatchEvent(new Event('pause'));};
    window.seek=()=>{seeking=true;video.dispatchEvent(new Event('seeking'));position+=200;
      seeking=false;video.dispatchEvent(new Event('seeked'));};
    KomiWatchStats.bind(video);
    video.dispatchEvent(new Event('playing'));
    await window.readWatch('a');
   });
   const get=key=>page.locator('[data-profile-field="'+key+'"]').innerText();
   assert.equal(await get('hours'),'0 минут');
   assert.equal(await get('episodes'),'2');
   await page.evaluate(async()=>{
    for(let i=0;i<60;i++){window.playAt(1);if(i%10===9)await KomiWatchStats.flush('a');}
    window.seek();
    window.pauseAt();
    for(let i=0;i<15;i++)window.playAt(0);
    await window.readWatch('a',true);
   });
   assert.equal(await get('hours'),'1 минута');
   assert.equal(await get('episodes'),'2','a partial episode must not change the completed count');
   assert.ok(await page.locator('[data-profile-field="hours"]').isVisible());
   await page.evaluate(async()=>{
    window.finished++;
    window.dispatchEvent(new CustomEvent('komi:watch-completed',{detail:'a'}));
    await window.readWatch('a',true);
   });
   assert.equal(await get('episodes'),'3');
   await page.evaluate(async()=>{
    const profile=document.getElementById('profile');
    profile.dataset.profileUser='someone_else';
    profile.innerHTML=KomiProfileUI.summary({ownWatchStats:false});
    await window.readWatch('a',true);
   });
   assert.equal(await get('hours'),'—');
   assert.equal(await page.locator('[data-profile-watch-retry]').count(),0);
   assert.deepEqual(errors,[]);
   await page.close();
  }
  console.log('PASS Chromium 390/1280: private profile, one minute, pause/seek, independent episode count, no data on other profile');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
