'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const fs=require('node:fs'), path=require('node:path');
const root=path.resolve(__dirname,'..');
const a='11111111-1111-4111-8111-111111111111';
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.KOMI_CHROME||undefined,args:['--no-sandbox']});
 try{
  for(const width of [390,1280]){
   const page=await browser.newPage({viewport:{width,height:740}});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   const sessions=new Map();
   await page.exposeFunction('saveTestSession',(id,ms)=>{sessions.set(id,Math.max(sessions.get(id)||0,ms));return true;});
   await page.exposeFunction('readTestSeconds',()=>Math.floor([...sessions.values()].reduce((a,b)=>a+b,0)/1000));
   await page.route('https://komi-test.example/profile',route=>route.fulfill({contentType:'text/html',body:
     '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><main id="profile" data-profile-user="tester" data-profile-owner="true"></main><video id="animeVideoPlayer" data-owner="'+a+'" data-anime-id="42" data-season="1" data-episode="0"></video>'}));
   await page.addInitScript(uid=>{
    window.currentUser={username:'tester',authUserId:uid}; window.clockAt=0;
    Object.defineProperty(performance,'now',{value:()=>window.clockAt});
    window._supabase={
     from:table=>({select:()=>({eq:(_key,value)=>({abortSignal:async()=>{
       if(table!=='komi_watched_episodes'||value!==uid)throw Error('Unexpected profile count');
       return {count:2};
     }})})}),
     rpc:(action,p)=>{
      if(p.p_owner!==uid)throw Error('Unexpected owner');
      return {abortSignal:async()=>{
       if(action==='komi_save_watch_session')return window.offline?{error:'offline'}:{data:await saveTestSession(p.p_session,p.p_milliseconds)};
       if(action==='komi_read_profile_watch_seconds')return {data:await readTestSeconds()};
       throw Error('Unexpected RPC');
      }};
     }
    };
   },a);
   const setup=async()=>{
    await page.addStyleTag({path:path.join(root,'profile-studio.css')});
    await page.addScriptTag({path:path.join(root,'komi-watch-stats.js')});
    const ui=fs.readFileSync(path.join(root,'profile-premium.js'),'utf8').replace('root.KomiProfileUI={guest,','root.KomiProfileUI={readViewingStats,guest,');
    await page.addScriptTag({content:ui});
    await page.evaluate(()=>{
     const profile=document.getElementById('profile');
     profile.innerHTML=KomiProfileUI.summary({canReadMetrics:true});
     window.refresh=()=>KomiProfileUI.readViewingStats(profile,true);
     const video=document.querySelector('video');
     let paused=false,position=0,seeking=false;
     Object.defineProperties(video,{paused:{get:()=>paused},currentTime:{get:()=>position},seeking:{get:()=>seeking}});
     window.frame=(delta,elapsed=1000)=>{clockAt+=elapsed;position+=delta;video.dispatchEvent(new Event('timeupdate'));};
     window.pause=()=>{paused=true;video.dispatchEvent(new Event('pause'));};
     window.seek=()=>{seeking=true;video.dispatchEvent(new Event('seeking'));position+=200;seeking=false;video.dispatchEvent(new Event('seeked'));};
     KomiWatchStats.bind(video);video.dispatchEvent(new Event('playing'));
    });
   };
   await page.goto('https://komi-test.example/profile'); await setup(); await page.evaluate(()=>refresh());
   const get=name=>page.locator('[data-profile-field="'+name+'"]').innerText();
   assert.equal(await get('hours'),'0 мин');assert.equal(await get('episodes'),'2');
   await page.evaluate(async()=>{window.offline=true;for(let i=0;i<39;i++)frame(1);frame(.5,500);pause();await refresh();});
   assert.equal(await page.locator('[data-profile-watch-pending]').isVisible(),true);
   await page.reload();await setup();
   await page.evaluate(async()=>{for(let i=0;i<20;i++)frame(1);frame(.7,700);seek();pause();for(let i=0;i<5;i++)frame(0);await KomiWatchStats.flush();await refresh();});
   await page.waitForFunction(()=>document.querySelector('[data-profile-field="hours"]').textContent==='1 минута');
   assert.equal(await get('episodes'),'2');assert.equal(await page.locator('[data-profile-watch-pending]').isVisible(),false);
   assert.equal([...sessions.values()].reduce((a,b)=>a+b,0),60200);
   assert.ok(await page.locator('[data-profile-field="hours"]').isVisible());
   assert.deepEqual(errors,[]);await page.close();console.log('PASS watch-time profile '+width+' px');
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
