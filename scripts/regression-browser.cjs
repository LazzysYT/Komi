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
   if (width === 1440) {
     const direct = await browser.newPage({viewport:{width:1280,height:800}});
     await direct.route('https://**/*',route=>route.fulfill({status:200,contentType:'application/json',body:'{}'}));
     const base=process.env.KOMI_TEST_URL || 'http://127.0.0.1:8765';
     await direct.goto(base+'#shop');
     await direct.waitForSelector('#anicoin-title');
     assert.equal(await direct.evaluate(()=>currentView),'shop','Direct #shop must show store');
     await direct.goto(base+'#catalog');
     await direct.waitForFunction(()=>currentView==='catalog');
     assert.ok(await direct.locator('#mainContainer h1').count());
     await direct.goto(base+'#profile');
     await direct.waitForSelector('#authModal.active');
     await direct.close();
   }
   const favicon=await page.locator('link[rel="icon"]').getAttribute('href');
   assert.equal(favicon,'./icon.svg','Favicon must use a real static SVG file');
   const faviconResponse=await page.request.get(new URL('icon.svg',page.url()).href);
   assert.equal(faviconResponse.status(),200);
   assert.ok((await faviconResponse.text()).includes('<svg'),'Favicon should serve valid SVG');
   assert.equal(await page.locator('#rouletteImage').getAttribute('src'),'./anime-artwork.svg');
   assert.equal(await page.locator('#rouletteImage').getAttribute('alt'),'Обложка случайного аниме');
   await page.waitForFunction(()=>document.getElementById('authModal').hasAttribute('inert'));
   const initialA11y=await page.evaluate(()=>({
      modalHidden:document.getElementById('authModal').getAttribute('aria-hidden'),
      modalInert:document.getElementById('authModal').hasAttribute('inert'),
      drawerInert:document.getElementById('komiFriendsDrawer').hasAttribute('inert'),
      drawerHidden:getComputedStyle(document.getElementById('komiFriendsDrawer')).visibility
   }));
   assert.equal(initialA11y.modalHidden,'true');
   assert.equal(initialA11y.modalInert,true);
   assert.equal(initialA11y.drawerInert,true);
   assert.equal(initialA11y.drawerHidden,'hidden');
   if (width === 1440) {
     const friends = await page.evaluate(() => {
       const originalUser=currentUser;
       const origVerified=komiCommunityVerifiedNames;
       const origSent=protectedFriendSent;
       const names=['ci_verified_visitor','ci_legacy_visitor'];
       const originals=names.map(name=>userProfiles[name]);
       const search=document.getElementById('komiFriendsSearch');
       const originalQuery=search.value;
       const originalTab=komiFriendsTab;
       try {
         currentUser={username:'ci_test_owner',authUserId:'ci-auth-uid'};
         userProfiles[names[0]]={displayName:'Проверенный друг',avatar:'https://example.com/ci.jpg'};
         userProfiles[names[1]]={displayName:'Старый профиль',avatar:''};
         komiCommunityVerifiedNames=new Set([names[0]]);
         protectedFriendSent={owner:currentUser.authUserId,names:new Set()};
         komiFriendsTab='all';
         search.value='';
         renderFriendsDrawer();
         const list=document.getElementById('komiFriendsDrawerList');
         const verified=list.querySelector('.komi-friends-person:has(.komi-friends-add)');
         const unverified=[...list.querySelectorAll('.komi-friends-person')].find(el=>el.textContent.includes('Старый профиль'));
         const before={
           addVisible:verified?.textContent.includes('Проверенный друг'),
           legacyUnavailable:unverified?.querySelector('.komi-friends-unavailable')?.textContent.includes('Недоступно')
         };
         protectedFriendSent.names.add(names[0]);
         renderFriendsDrawer();
         const pending=[...list.querySelectorAll('.komi-friends-person')].find(el=>el.textContent.includes('Проверенный друг'));
         search.value='Проверенный';
         renderFriendsDrawer();
         const searched=[...list.querySelectorAll('.komi-friends-person')].some(el=>el.textContent.includes('Проверенный друг'));
         return {...before,pending:pending?.textContent.includes('Ожидание'),searched};
       } finally {
         names.forEach((name,i)=>{if(originals[i]===undefined)delete userProfiles[name];else userProfiles[name]=originals[i]});
         komiCommunityVerifiedNames=origVerified;
         protectedFriendSent=origSent;
         currentUser=originalUser;
         komiFriendsTab=originalTab;
         search.value=originalQuery;
         renderFriendsDrawer();
       }
     });
     assert.equal(friends.addVisible,true,'Verified Komi profiles must have Add friend button');
     assert.equal(friends.legacyUnavailable,true,'Unlinked legacy accounts must not accept friend invites');
     assert.equal(friends.pending,true,'Sent friend requests must show pending state');
     assert.equal(friends.searched,true,'Friend search must match display names');

     const profile = await page.evaluate(async () => {
       const originalUser=currentUser, originalSupabase=_supabase, originalDraft=avatarDraft;
       const username='ci_profile_owner',uid='ci-auth-profile';
       const originalProfile=userProfiles[username];
       const wrapper=document.createElement('div');
       wrapper.innerHTML='<input id="newDisplayName" value="Профиль Komi"><input id="newStatusText" value="Проверка">';
       document.body.append(wrapper);
       const saved={};
       try {
         currentUser={username,authUserId:uid};
         userProfiles[username]={avatar:'',status:'Новичок'};
         avatarDraft={owner:uid,image:Promise.resolve(new Blob(['jpeg'],{type:'image/jpeg'})),url:null};
         _supabase={
           from(table) {
             if(table!=='komi_profiles')throw Error('Unexpected table '+table);
             return {update(fields) {
               saved.fields=fields;
               return {eq(key,value) {
                 saved.ownerFilter={key,value};
                 return {select() {return {maybeSingle:async()=>({
                   data:{...fields,created_at:new Date().toISOString()},error:null
                 })}}};
               }};
             }};
           },
           storage:{from(bucket) {
             saved.bucket=bucket;
             return {
               upload:async(path,blob,opts)=>{saved.upload={path,contentType:opts.contentType};return {error:null}},
               getPublicUrl:()=>({data:{publicUrl:'https://cdn.example.com/avatars/ci.jpg'}})
             };
           }}
         };
         await updateUserProfile();
         return {name:userProfiles[username]?.displayName,
           avatar:userProfiles[username]?.avatar,fields:saved.fields,
           owner:saved.ownerFilter,bucket:saved.bucket,upload:saved.upload};
       } finally {
         currentUser=originalUser;
         _supabase=originalSupabase;
         avatarDraft=originalDraft;
         if(originalProfile===undefined)delete userProfiles[username];else userProfiles[username]=originalProfile;
         wrapper.remove();
         render();
       }
     });
     assert.equal(profile.name,'Профиль Komi','Display name must save independently');
     assert.equal(profile.owner?.key,'user_id');
     assert.equal(profile.owner?.value,'ci-auth-profile','Profile updates must target the current auth uid');
     assert.equal(profile.bucket,'avatars');
     assert.equal(profile.upload?.contentType,'image/jpeg');
     assert.ok(profile.upload?.path.startsWith('ci-auth-profile/'),'Avatar uploads must use their owner folder');
     assert.ok(profile.avatar.startsWith('https://cdn.example.com/'),'Saved profile must use uploaded avatar URL');
   }
   await page.evaluate(()=>openAuthModal('login'));
   await page.waitForFunction(()=>!document.getElementById('authModal').hasAttribute('inert'));
   await page.evaluate(()=>closeAuthModal());
   await page.waitForFunction(()=>document.getElementById('authModal').hasAttribute('inert'));
   await page.evaluate(()=>{location.hash='#shop'});
   await page.waitForSelector('#anicoin-title');
   await page.evaluate(()=>{location.hash='#catalog'});
   await page.waitForFunction(()=>currentView==='catalog');
   await page.evaluate(()=>{location.hash=''});
   await page.waitForFunction(()=>currentView==='home');

   await page.evaluate(()=>{
    animeList=[{id:'1',title:'Проверка аниме',originalTitle:'Test',poster:'./anime-artwork.svg',genres:['Драма'],year:2026,shikiRating:8,
      episodes:[{season:1,number:1,sources:{Direct:'https://media.test/a.mp4',Embed:'<iframe src="https://media.test/player?a=1&amp;b=2"></iframe>'}},{season:1,number:2,sources:{Direct:'https://media.test/b.mp4'}}],komiDetailsLoaded:true}];
    catalogInitialLoadComplete=true;render();
   });
   await page.evaluate(()=>openWatchModal('1'));
   const mono = await page.evaluate(() => ({
     primary:getComputedStyle(document.documentElement).getPropertyValue('--primary').trim().toLowerCase(),
     bodyColor:getComputedStyle(document.body).backgroundColor,
     link:[...document.querySelectorAll('link[rel="stylesheet"]')].some(el=>el.href.endsWith('/mono-ui.css'))
   }));
   assert.equal(mono.primary,'#ffffff','Global theme must use pure white accents');
   assert.ok(mono.link,'Global monochrome CSS must be loaded');
   const emblems = await page.evaluate(() => {
      const get = selector => {
        const element = document.querySelector(selector);
        const style = getComputedStyle(element);
        return {background:style.backgroundColor,color:style.color,border:style.borderTopColor};
      };
      return {side:get('.komi-side-logo'),header:get('.logo-box'),heading:get('.logo-text')};
   });
   for (const [label,icon] of [['sidebar',emblems.side],['header',emblems.header]]) {
     assert.equal(icon.background,'rgb(0, 0, 0)',label+' Komi emblem must be black');
     assert.equal(icon.color,'rgb(255, 255, 255)',label+' Komi emblem K must be white');
   }
   assert.equal(emblems.heading.color,'rgb(255, 255, 255)','Brand name must be pure white');

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
   if (width === 1440) {
     const random=await page.evaluate(async()=>{
       const catalogBefore=animeList;
       const originalOpen=openWatchModal;
       let opened=null;
       animeList=[
         {id:'not-playable',title:'Аниме без серий',poster:'https://media.test/not-playable.jpg',episodeCount:0,episodes:[]},
         {id:'posterless-title',title:'Аниме без постера',poster:null,episodeCount:12}
       ];
       openWatchModal=id=>{opened=String(id);};
       randomAnimeWithAnimation();
       await new Promise(resolve=>setTimeout(resolve,4800));
       const shown=document.getElementById('rouletteTitle').textContent;
       const source=document.getElementById('rouletteImage').getAttribute('src');
       animeList=catalogBefore;openWatchModal=originalOpen;
       return {opened,shown,source};
     });
     assert.equal(random.opened,'posterless-title','Random anime must include playable entries without posters, but exclude zero-episode entries');
     assert.equal(random.shown,'Аниме без постера');
     assert.ok(random.source.includes('anime-artwork.svg'),'When artwork providers fail, use neutral placeholder');
     assert.ok(!/not-playable/.test(random.opened));
   }
   if(width===1440) {
     const noPlayable = await page.evaluate(async()=>{
       const oldList=animeList;
       animeList=[{id:'empty-anime',title:'Нет серий',episodeCount:0,episodes:[]}];
       randomAnimeWithAnimation();
       const status=document.getElementById('rouletteTitle').textContent;
       const active=document.getElementById('randomRouletteModal').classList.contains('active');
       animeList=oldList;
       document.getElementById('randomRouletteModal').classList.remove('active');
       return {status,active};
     });
     assert.ok(noPlayable.status.includes('нет аниме с доступными сериями'));
     assert.equal(noPlayable.active,true);
     const retry=await page.locator('#rouletteRetry').isVisible();
     assert.equal(retry,true,'Random picker should offer a retry on no playable anime');
     const close=await page.evaluate(()=>{
       const before=komiRouletteRun;
       closeKomiRoulette();
       return {closed:!document.getElementById('randomRouletteModal').classList.contains('active'),runAdvanced:komiRouletteRun>before};
     });
     assert.equal(close.closed,true,'Random picker close must work without waiting for timer');
     assert.equal(close.runAdvanced,true,'Closing must invalidate earlier roulette callbacks');
   }
   if (width === 1440) {
     const presence=await page.evaluate(async()=>{
       const priorClient=_supabase, priorUser=currentUser;
       presenceRequestInFlight=false;
       currentUser=null;
       _supabase={
         from:()=>({
           upsert:()=>({abortSignal:signal=>new Promise(resolve=>{
             if(signal.aborted)resolve({error:{message:'Request cancelled'}});
             else signal.addEventListener('abort',()=>resolve({error:{message:'Request cancelled'}}),{once:true});
           })})
         })
       };
       const status=document.getElementById('onlineCountText');
       status.textContent='Онлайн: проверяем…';
       try {
         await updateOnlinePresence();
         return {label:status.textContent,inFlight:presenceRequestInFlight};
       } finally {
         _supabase=priorClient;
         currentUser=priorUser;
       }
     });
     assert.equal(presence.label,'Онлайн: —','Hung online request must time out instead of staying on checking');
     assert.equal(presence.inFlight,false,'Timed-out online request must release the lock');
   }
   await page.screenshot({path:path.join(output,`regression-${width}.png`),fullPage:true});
   assert.deepEqual(errors,[]);console.log('PASS browser',width,'progress/source/search/auth/close race/overflow');await page.close();
  }
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
