const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const base=process.env.KOMI_TEST_URL||'http://127.0.0.1:8765/';
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.KOMI_CHROME?{executablePath:process.env.KOMI_CHROME}:{})});
 try{
  const page=await browser.newPage({viewport:{width:1200,height:800}});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>typeof KomiDynamicEvents==='object'&&
    typeof KomiDynamicEvents.supports==='function',null,{timeout:15000});
  const coverage=await page.evaluate(()=>{
    const cases={
      click:[
        "closeFriendsDrawer();openAuthModal('login')",
        "openCommunityProfile(window.komiFriendNames[0])",
        "requestCommunityFriend(window.komiFriendNames[0])",
        "playSound();openProfile(window.komiSidebarSearchNames[0])",
        "playSound();sendFriendRequest(window.komiSidebarSearchNames[0])",
        "playSound();openProfile(window.komiSidebarFriendNames[0])",
        "respondProtectedFriendRequest(42, true)",
        "respondProtectedFriendRequest(42, false)",
        "openKomiCollection('recent')",
        "setKomiCatalogYear('Все')",
        "setKomiCatalogYear('2026')",
        "komiResetCatalogFilters()",
        "showMoreCatalog()",
        "showKomiYear('2026')",
        "navigate('catalog')",
        "document.getElementById('komiCalendarSection')?.scrollIntoView({behavior:'smooth',block:'start'})",
        "randomAnimeWithAnimation()",
        "playSound(); openAuthModal('login')",
        "loadDataFromCloud(); render()",
        "resumeKomiAnime('52991')",
        "playSound(); changeSlide(-1)",
        "playSound(); changeSlide(1)",
        "playSound(); openWatchModal('52991')",
        "playSound(); createWatchPartyFromAnime('52991')",
        "playSound(); setSlide(2)",
        "playSound(); navigate('catalog')",
        "playSound(); openKomiCollection('movies')",
        "playSound(); removeFriend(window.komiViewedProfileName)",
        "playSound(); sendFriendRequest(window.komiViewedProfileName)",
        "document.querySelector('.profile-settings-box')?.classList.toggle('is-open')",
        "openAniCoinShop()",
        "playSound(); updateUserProfile(this)",
        "logoutUser('global')",
        "playSound(); profileActiveTab='Просмотрено'; profilePageSection='anime'; render()",
        "profilePageSection='overview';render()",
        "profilePageSection='anime';profileActiveTab='Любимые';render()",
        "playSound(); profileActiveTab=window.komiProfileFolderNames[0]; render()",
        "deleteCustomFolder(window.komiProfileFolderNames[0])",
        "importLocalCustomFolders()",
        "playSound(); createCustomFolder()",
        "playSound(); profileActiveTab='Любимые'; render()",
        "openProfile(window.komiProfileFriendNames[0])",
        "playSound(); postToProfileWall(window.komiWallProfileName)",
        "playSound(); openProfile(window.komiWallAuthorByIndex[0])",
        "playSound(); deleteWallMessage(window.komiWallProfileName, 0)",
        "playSound();openWatchModal('52991')",
        "loadKomiEpisodeSchedule(true)",
        "openWatchModal('52991')",
        "closeWatchModal()",
        "toggleKomiWatchFullscreen()",
        "playSound(); closeWatchModal()",
        "playSound(); toggleFavorite('52991', 'Любимые')",
        "playSound(); createWatchPartyFromAnime('52991', '', false, 0, document.getElementById('komiWatchSourceSelect').value)",
        "playSound(); setAnimeStatus('52991', 'Смотрю')",
        "openWatchModal('52991',1,4)",
        "openWatchModal('52991',1,-1)",
        "leaveWatchPartyRoom()",
        "openWatchPartyHub()",
        "toggleKomiPartyFullscreen()"
      ],
      input:[
        "handleFriendSearchInput(this.value)","komiUpdateCatalogQuery(this.value)",
        "komiFindEpisode(this.value)","updateProfileCollectionSearch(this)"
      ],
      change:[
        "catalogFilterGenre=this.value; render()",
        "catalogFilterYear=this.value; render()",
        "catalogFilterType=this.value; render()",
        "catalogSort=this.value; render()",
        "handleAvatarFileUpload(event)",
        "changePlayerSource('52991',1,0,this.value)"
      ],
      keydown:[
        "if(event.key==='Enter'||event.key===' '){event.preventDefault();openWatchModal('52991')}",
        "if(event.key==='Enter') postToProfileWall(window.komiWallProfileName)"
      ],
      error:[
        "komiCardPosterFallback(this)",
        "this.onerror=null;this.src='https://api.dicebear.com/7.x/bottts/svg?seed=fallback'",
        "this.onerror=null;this.src='https://api.dicebear.com/7.x/bottts/svg?seed=Komi'",
        "this.onerror=null;this.src='/anime-artwork.svg'",
        "this.onerror=null;this.src='./anime-artwork.svg'",
        "this.src='https://api.dicebear.com/7.x/bottts/svg?seed=fallback'",
        "this.style.display='none'"
      ]
    };
    const unsupported=[];
    for(const [type,values] of Object.entries(cases))
      for(const value of values)
        if(!KomiDynamicEvents.supports(type,value))unsupported.push(type+': '+value);
    const malicious=[
      ["click","alert(document.cookie)"],
      ["click","openWatchModal('52991');alert(1)"],
      ["click","profileActiveTab='admin'; render()"],
      ["click","openKomiCollection('constructor')"],
      ["click","openWatchModal('52991');fetch('https://evil.invalid')"],
      ["error","this.src='javascript:alert(1)'"]
    ].filter(([type,value])=>KomiDynamicEvents.supports(type,value)).map(x=>x.join(': '));
    return {unsupported,malicious,count:Object.values(cases).reduce((n,v)=>n+v.length,0)};
  });
  assert.deepEqual(coverage.unsupported,[],'Missing legitimate action support: '+coverage.unsupported.join('; '));
  assert.deepEqual(coverage.malicious,[],'An arbitrary JS expression was accepted');
  await page.locator('#sideCatalogBtn').click();
  assert.equal(await page.evaluate(()=>currentView),'catalog');
  const onscreen=await page.evaluate(()=>{
    const selectors='[data-komi-onclick],[data-komi-oninput],[data-komi-onchange],[data-komi-onkeydown],[data-komi-onerror]';
    const unsupported=[];
    for(const element of document.querySelectorAll(selectors)){
      for(const type of ['click','input','change','keydown','error']){
        const raw=element.getAttribute('data-komi-on'+type);
        if(raw && !KomiDynamicEvents.supports(type,raw))
          unsupported.push(type+': '+raw.slice(0,130));
      }
    }
    return unsupported;
  });
  assert.deepEqual(onscreen,[],'Unsupported actual catalog markup');
  assert.deepEqual(errors,[],'No JS runtime errors expected: '+errors.join('; '));
  console.log('PASS '+coverage.count+' allowlisted dynamic handlers, 6 malicious expressions refused, catalog markup clean');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
