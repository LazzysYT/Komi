const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

async function checkCommentCooldown(page) {
 await page.evaluate(() => {
   const originalSupabase = _supabase;
   const originalUser = currentUser;
   currentUser = { username:'ci_commenter', authUserId:'ci-commenter' };
   _supabase = {
     from(table) {
       if (table !== 'komi_comments') throw Error('Unexpected table: ' + table);
       return {
         select() { return this; },
         eq() { return this; },
         order() { return this; },
         async limit() { return {data:[],error:null}; },
         async insert() {
           return {error:{code:'PT429',message:'Подождите 10 секунд перед следующим комментарием.'}};
         }
       };
     },
     rpc() { return { abortSignal:async () => ({data:0}) }; }
   };
   window.KomiComments.mount(921102);
   document.getElementById('watchModal').classList.add('active');
   window.restoreCommentFixture = () => {
     closeWatchModal();
     _supabase = originalSupabase;
     currentUser = originalUser;
     delete window.restoreCommentFixture;
   };
 });
 try {
   const comments = page.locator('#komiAnimeComments');
   const input = comments.getByRole('textbox', {name:'Текст комментария'});
   const send = comments.getByRole('button', {name:'Отправить'});
   await input.fill('Черновик комментария');
   await send.click();
   await comments.getByText('Подождите 10 секунд перед следующим комментарием.').waitFor();
   assert.equal(await input.inputValue(), 'Черновик комментария');
   assert.equal(await send.isEnabled(), true);
 } finally {
   await page.evaluate(() => window.restoreCommentFixture());
 }
}

async function checkNotifications(page) {
 await page.evaluate(() => {
   const originalSupabase = _supabase;
   const originalLoadFriends = loadProtectedFriends;
   const owner = { username:'ci_notifications', authUserId:'ci-notification-owner' };
   const notification = { message:'Сообщение <img src=x>', created_at:'2026-01-01T12:00:00Z' };
   let unread = true;
   const updates = [];
   currentUser = owner;
   loadProtectedFriends = async () => {};
   _supabase = {
     from(table) {
       if (table !== 'komi_notifications') throw Error('Unexpected table: ' + table);
       let fields, recipient;
       return {
         select() { return this; },
         update(value) { fields = value; return this; },
         eq(column, value) {
           if (column !== 'recipient_id') throw Error('Missing recipient filter');
           recipient = value;
           return this;
         },
         is(column, value) {
           if (column !== 'read_at' || value !== null) throw Error('Missing unread filter');
           if (!fields) return this;
           updates.push({ fields, recipient });
           if (updates.length === 1) return Promise.resolve({ error:Error('Temporary failure') });
           unread = false;
           return Promise.resolve({ error:null });
         },
         order() { return this; },
         async limit() {
           const data = recipient === owner.authUserId && unread ? [notification] : [];
           return { data, count:data.length, error:null };
         }
       };
     },
     rpc() { return { abortSignal:async () => ({data:0}) }; }
   };
   window.komiNotificationTest = {
     updates,
     async switchAccount() {
       clearKomiAccountData(owner);
       currentUser = { username:'ci_other', authUserId:'ci-other-owner' };
       updateNotificationsUI();
       await loadAccountNotifications();
     },
     restore() {
       clearKomiAccountData(currentUser);
       currentUser = null;
       loadProtectedFriends = originalLoadFriends;
       _supabase = originalSupabase;
       updateNotificationsUI();
       delete window.komiNotificationTest;
     }
   };
 });
 try {
   if (await page.locator('#komiMobileMoreToggle').isVisible()) {
     await page.locator('#komiMobileMoreToggle').click();
     await page.locator('[data-komi-mobile-extra="notifications"]').click();
   } else {
     await page.locator('.komi-side-button[title="Уведомления"]').click();
   }
   const list = page.locator('#notifListContainer');
   await list.getByText('Сообщение <img src=x>', { exact:false }).waitFor();
   assert.equal(await list.locator('img').count(), 0);
   const mark = page.getByRole('button', { name:'Отметить прочитанными' });
   await mark.focus();
   await mark.press('Enter');
   await page.getByText('Не удалось обновить уведомления.', { exact:false }).waitFor();
   assert.equal(await mark.isEnabled(), true);
   await mark.click();
   await list.getByText('Нет новых уведомлений').waitFor();
   const updates = await page.evaluate(() => window.komiNotificationTest.updates);
   assert.equal(updates.length, 2);
   for (const { recipient, fields } of updates) {
     assert.equal(recipient, 'ci-notification-owner');
     assert.deepEqual(Object.keys(fields), ['read_at']);
     assert.ok(Number.isFinite(Date.parse(fields.read_at)));
   }
   await page.evaluate(() => window.komiNotificationTest.switchAccount());
   assert.equal(await page.locator('#notifDropdown').isVisible(), false);
   assert.equal(await page.locator('#notifBadge').isVisible(), false);
 } finally {
   await page.evaluate(() => window.komiNotificationTest.restore());
 }
}

(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.KOMI_CHROME ? {executablePath:process.env.KOMI_CHROME}:{})});
 const output=path.join(__dirname,'../browser-test-results');fs.mkdirSync(output,{recursive:true});
 try {
  for(const width of [1440,768,390,375]) {
   const page=await browser.newPage({viewport:{width,height:900}});const errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.addInitScript(() => {
     localStorage.setItem('komi_current_user', JSON.stringify({username:'legacy',authUserId:'forged-id'}));
   });
   await page.route('https://**/*',route=>route.fulfill({status:200,contentType:'application/json',body:'{}'}));
   await page.goto(process.env.KOMI_TEST_URL || 'http://127.0.0.1:8765');
   await page.waitForFunction(()=>typeof bindKomiPlayer==='function');
   assert.equal(await page.evaluate(() => currentUser), null, 'Cached legacy identity must not sign the visitor in');
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
   assert.equal(await page.locator('#rouletteImage').getAttribute('src'),'/anime-artwork.svg');
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
   if (width === 1440 || width === 390) await checkNotifications(page);
   if (width === 1440) {
     await checkCommentCooldown(page);
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
    const hostileMetadata = '<img data-komi-injected src=x>';
    animeList=[{id:'1',title:'Проверка аниме',originalTitle:'Test',poster:'https://media.test/poster.jpg',
      genres:[hostileMetadata],year:hostileMetadata,shikiRating:hostileMetadata,type:hostileMetadata,
      episodes:[{season:1,number:1,sources:{Direct:'https://media.test/a.mp4',Embed:'<iframe src="https://media.test/player?a=1&amp;b=2"></iframe>'}},{season:1,number:2,sources:{Direct:'https://media.test/b.mp4'}}],komiDetailsLoaded:true}];
    catalogInitialLoadComplete=true;render();
   });
   assert.match(await page.locator('.hero-meta').textContent(), /<img data-komi-injected/);
   assert.equal(await page.locator('[data-komi-injected]').count(), 0);
   await page.evaluate(()=>openWatchModal('1'));
   assert.match(await page.locator('.crunchy-hero-info').textContent(), /<img data-komi-injected/);
   assert.equal(await page.locator('[data-komi-injected]').count(), 0);
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
   assert.ok(cinema.width >= width * .99, 'Cinema modal should use the full viewport width');
   assert.ok(cinema.height >= 800, 'Cinema modal should use the full viewport height');
   assert.ok(cinema.radius <= 1, 'Cinema modal should have no outside rounded frame');
   assert.equal(cinema.stageDisplay,'grid');
   await page.waitForSelector('.komi-episodes-toggle');
   assert.equal(await page.locator('.komi-cinema-topbar').count(),1);
   assert.equal(await page.locator('.komi-native-hud').count(),1);
   assert.equal(await page.locator('.komi-ambient-glow').count(),1);
   assert.equal(await page.locator('.komi-cinema-bigplay').count(),1);
   assert.equal(await page.locator('.komi-source-tabs button').count(),2,'Only real fixture sources should be offered');
   assert.equal(await page.locator('.komi-quality-control select').isDisabled(),true,'MP4 must not promise unavailable quality levels');
   assert.equal(await page.locator('.komi-episodes-toggle').getAttribute('aria-expanded'),String(width>820));
   await page.locator('.komi-episodes-toggle').click();
   assert.equal(await page.locator('.komi-episodes-toggle').getAttribute('aria-expanded'),String(width<=820));
   assert.equal(await page.locator('.komi-watch-sidebar').getAttribute('aria-hidden'),String(width>820));
   await page.locator('.komi-episodes-toggle').click();
   const view = page.locator('.komi-episode-view-toggle');
   assert.equal(await view.count(),1);
   if (width<=820) await page.locator('.komi-episodes-toggle').click();
   await view.getByRole('button',{name:'Показать серии списком'}).click();
   assert.equal(await page.locator('.komi-episode-number-grid.komi-episode-list').count(),1);
   await view.getByRole('button',{name:'Показать серии сеткой'}).click();
   assert.equal(await page.locator('.komi-episode-number-grid.komi-episode-list').count(),0);
   if (width<=820) await page.locator('.komi-episodes-toggle').click();
   await page.screenshot({path:path.join(output,`cinema-watch-${width}.png`)});

   const state=await page.evaluate(()=>{
    currentUser={username:'test_viewer'};
    const video=document.getElementById('animeVideoPlayer');
    video.dataset.owner='test_viewer';
    Object.defineProperty(video,'error',{configurable:true,value:null});
    Object.defineProperty(video,'duration',{configurable:true,value:100});
    Object.defineProperty(video,'currentTime',{configurable:true,writable:true,value:42});
    video.dispatchEvent(new Event('loadedmetadata'));
    saveProgress('1',video,true);
    video.currentTime=0;
    video.dispatchEvent(new Event('error'));
    window.komiFailedTestVideo=video;
    return getKomiProgress('1');
   });
   assert.equal(state.time,42);assert.equal(state.duration,100);
   await page.getByText('Не удалось загрузить видео.',{exact:true}).waitFor();
   await page.getByRole('button',{name:'Повторить загрузку'}).click();
   await page.waitForFunction(()=>!window.komiFailedTestVideo.isConnected && !!document.getElementById('animeVideoPlayer'));
   assert.equal(await page.locator('#komiWatchSourceSelect').inputValue(),'Direct');
   assert.equal(await page.evaluate(()=>getKomiProgress('1').time),42);
   await page.evaluate(()=>document.getElementById('animeVideoPlayer').dispatchEvent(new Event('error')));
   await page.getByRole('button',{name:'Сменить источник'}).click();
   await page.locator('#watchModalContent iframe').waitFor();
   assert.equal(await page.locator('#watchModalContent iframe').getAttribute('src'),'https://media.test/player?a=1&b=2');
   assert.equal(await page.evaluate(()=>getKomiProgress('1').duration),100);
   assert.equal(await page.evaluate(()=>getKomiProgress('1').time),42);
   assert.equal(await page.evaluate(()=>localStorage.getItem('komi_source_1')),'Embed');
   assert.equal(await page.evaluate(()=>window.komiActiveSeason),1);
   assert.equal(await page.evaluate(()=>window.komiActiveEpisode),0);
   await page.evaluate(()=>delete window.komiFailedTestVideo);
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
       const retryVisible=!document.getElementById('rouletteRetry').hidden;
       animeList=oldList;
       return {status,active,retryVisible};
     });
     assert.ok(noPlayable.status.includes('нет аниме с доступными сериями'));
     assert.equal(noPlayable.active,true);
     assert.equal(noPlayable.retryVisible,true,'Random picker should offer a retry on no playable anime');
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
         rpc:()=>({abortSignal:signal=>new Promise(resolve=>{
           if(signal.aborted)resolve({error:{message:'Request cancelled'}});
           else signal.addEventListener('abort',()=>resolve({error:{message:'Request cancelled'}}),{once:true});
         })})
       };
       const status=document.getElementById('onlineCountText');
       status.textContent='Аккаунтов онлайн: проверяем…';
       try {
         await updateOnlinePresence();
         return {label:status.textContent,inFlight:presenceRequestInFlight};
       } finally {
         _supabase=priorClient;
         currentUser=priorUser;
       }
     });
     assert.equal(presence.label,'Аккаунтов онлайн: —','Hung online request must time out instead of staying on checking');
     assert.equal(presence.inFlight,false,'Timed-out online request must release the lock');
   }
   await page.screenshot({path:path.join(output,`regression-${width}.png`),fullPage:true});
   assert.deepEqual(errors,[]);console.log('PASS browser',width,'progress/source/search/auth/close race/overflow');await page.close();
  }
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
