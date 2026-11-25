'use strict';
// Run with KOMI_PLAYWRIGHT and KOMI_CHROME, or a local Playwright install.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require(process.env.KOMI_PLAYWRIGHT||'playwright');
const root=path.join(__dirname,'..');
const id=(n)=>'00000000-0000-4000-8000-00000000000'+n;
// A two-frame looping GIF: each image has a different color.
const gif=Buffer.from('R0lGODlhAgACAIEAAP8AAAAAAAAAAAAAACH/C05FVFNDQVBFMi4wAwEAAAAh+QQAGwAAACwAAAAAAgACAAAIBgABCAQQEAAh+QQBGwABACwAAAAAAgACAIEA/wAAAAAAAAAAAAAIBgABCAQQEAA7','base64');
const cdn='https://images.example.test/';
const asset=(id,file)=>cdn+'avatars/'+id+'/'+file;
const base=cdn+'regular.svg', missing=cdn+'missing.svg';
const svg='<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><path fill="white" d="M0 0h40v40H0z"/></svg>';
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.KOMI_CHROME||undefined,args:['--no-sandbox']});
 try{
  for(const width of [390,1280]){
   const page=await browser.newPage({viewport:{width,height:760}});
   await page.route('**/*',async route=>{
     const url=route.request().url();
     if(url.endsWith('/fixture'))return route.fulfill({contentType:'text/html',body:'<!doctype html><style>.profile-friend-avatar{display:inline-grid;place-items:center;width:36px;height:36px}.komi-profile-friend{display:flex!important}</style><main id="profile" data-profile-user="owner"><div class="profile-friends-widget"><div class="profile-friends-mini"></div></div><div class="komi-profile-friend-list"></div></main>'});
     if(url.endsWith('/regular.svg'))return route.fulfill({contentType:'image/svg+xml',body:svg});
     if(url.endsWith('/valid.gif')||url.endsWith('/updated.gif'))return route.fulfill({contentType:'image/gif',body:gif});
     if(url.endsWith('/icon.svg'))return route.fulfill({contentType:'image/svg+xml',body:svg});
     return route.fulfill({status:404,body:''});
   });
   await page.goto(cdn+'fixture');
   await page.addScriptTag({path:path.join(root,'profile-premium.js')});
   await page.addScriptTag({path:path.join(root,'komi-premium.js')});
   const ids=[1,2,3,4,5].map(id);
   await page.evaluate(({ids,base,missing,cdn})=>{
    window.currentUser={username:'owner'};
    window.userProfiles={
      'gif_only':{publicAvatarUserId:ids[0],displayName:'Луна'},
      'gif_with_base':{publicAvatarUserId:ids[1],avatar:base,displayName:'Рен'},
      'not_premium':{publicAvatarUserId:ids[2],avatar:base,displayName:'Натсу'},
      'bad_still':{publicAvatarUserId:ids[3],avatar:missing,displayName:'Кай'},
      'valid_still':{publicAvatarUserId:ids[4],avatar:base,displayName:'Мэл'}
    };
    window.openProfile=name=>{window.lastFriend=name;};
    window.mediaRows=[
      {user_id:ids[0],avatar_path:ids[0]+'/valid.gif'},
      {user_id:ids[1],avatar_path:ids[1]+'/unavailable.gif'},
      {user_id:ids[2],avatar_path:ids[2]+'/valid.gif'}
    ];
    window.badges=ids.slice(0,2).map(user_id=>({user_id}));
    const client={
      from:table=>({select:()=>({limit:async()=>({data:table==='komi_premium_badges'?window.badges:table==='komi_premium_media'?window.mediaRows:[]})})}),
      storage:{from:bucket=>({getPublicUrl:path=>({data:{publicUrl:cdn+bucket+'/'+path}})})},
      auth:{onAuthStateChange(){}}
    };
    window.KomiProfileUI.refreshFriends(Object.keys(window.userProfiles));
    window.KomiPremium.setClient(client);
    document.querySelector('.komi-profile-friend-list').addEventListener('click',event=>{
      const buttons=[...document.querySelectorAll('.komi-profile-friend')];
      const i=buttons.indexOf(event.target.closest('button'));
      if(i>=0)window.openProfile(window.komiProfileFriendNames[i]);
    });
   },{ids,base,missing,cdn});
   const row=n=>page.locator('.komi-profile-friend-list button').nth(n).locator('img');
   const first=row(0);
   await page.waitForFunction(url=>{
     const image=document.querySelector('.komi-profile-friend-list img');
     return image.src===url&&image.complete&&image.naturalWidth===2&&image.style.visibility!=='hidden';
   },asset(ids[0],'valid.gif'));
   const firstFrame=await first.screenshot();
   let animated=false;
   for(let i=0;i<8&&!animated;i++){
     await new Promise(r=>setTimeout(r,220));
     animated=!firstFrame.equals(await first.screenshot());
   }
   assert.ok(animated,'GIF changes frames inside the actual Friends card');
   assert.equal(await page.locator('.profile-friends-mini img').first().getAttribute('src'),asset(ids[0],'valid.gif'));
   await page.waitForFunction(url=>{
     const a=[...document.querySelectorAll('.komi-profile-friend-list img')];
     return a[1].src===url&&a[1].naturalWidth===40&&a[2].src===url&&
       a[3].style.visibility==='hidden'&&a[4].naturalWidth===40;
   },base);
   assert.match(await page.locator('.komi-profile-friend-list button').nth(3).innerText(),/Кай/);
   await page.locator('.komi-profile-friend-list button').first().click();
   assert.equal(await page.evaluate(()=>window.lastFriend),'gif_only');
   await page.evaluate(async ids=>{
     window.mediaRows[0].avatar_path=ids[0]+'/updated.gif';
     await window.KomiPremium.refresh(true);
   },ids);
   await page.waitForFunction(url=>document.querySelector('.komi-profile-friend-list img').src===url,asset(ids[0],'updated.gif'));
   await page.evaluate(async()=>{ window.badges=[]; await window.KomiPremium.refresh(true); });
   await page.waitForFunction(()=>document.querySelector('.komi-profile-friend-list img').style.visibility==='hidden');
   assert.equal(await row(1).getAttribute('src'),base);
   await page.close();
  }
  console.log('PASS real animated avatars, regular fallbacks, inactive Premium and refresh, 390px/1280px');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
