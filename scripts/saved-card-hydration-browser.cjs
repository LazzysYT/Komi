const {chromium}=require('playwright');
const assert=require('node:assert/strict');

(async()=>{
 const browser=await chromium.launch({headless:true,
   ...(process.env.KOMI_CHROME?{executablePath:process.env.KOMI_CHROME}:{})});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:850}});
  await page.route('https://**/*',route=>route.fulfill({status:200,contentType:'application/json',body:'{}'}));
  await page.goto(process.env.KOMI_TEST_URL||'http://127.0.0.1:8765');
  await page.waitForFunction(()=>typeof komiHydrateSavedAnimeCards==='function' &&
    typeof renderProfileView==='function');
  const result=await page.evaluate(async()=>{
   const qaName='qa_hydrate_owner',otherName='qa_hydrate_other',id='979797';
   const original={
    currentUser,animeList,supabase:_supabase,render,
    target:profileTargetUser,section:profilePageSection,
    tab:profileActiveTab,query:profileCollectionSearchQuery,
    firstProfile:userProfiles[qaName],secondProfile:userProfiles[otherName],
    firstStatuses:userAnimeStatuses[qaName],secondStatuses:userAnimeStatuses[otherName],
    firstFavorites:userFavorites[qaName],secondFavorites:userFavorites[otherName],
    owner:komiSavedCardsOwner,cards:new Map(komiSavedAnimeCards)
   };
   const container=document.createElement('div');document.body.append(container);
   try{
    render=()=>{}; // Keep the test self-contained; renderProfileView is tested explicitly.
    animeList=[];
    currentUser={username:qaName,authUserId:'qa-u1'};
    userProfiles[qaName]={displayName:'Hydration QA',status:'Отаку',avatar:'https://example.test/a.png'};
    userAnimeStatuses[qaName]={[id]:'Просмотрено'};
    userFavorites[qaName]={};
    profileTargetUser=qaName;profilePageSection='anime';profileActiveTab='Просмотрено';
    profileCollectionSearchQuery='';
    _supabase={from(table){
      if(table!=='komi_catalog_cards')throw Error('unexpected '+table);
      return {select(){return this;},in(column,values){
        if(column!=='shikimori_id'||!values.includes(Number(id)))throw Error('unexpected query');
        return Promise.resolve({data:[{shikimori_id:Number(id),updated_at:'2026-11-11',
          data:{title:'Кэшированная карточка QA',genres:['Драма'],poster:'',episodeCount:2}}],error:null});
      }};
    }};
    renderProfileView(container);
    const before=container.querySelector('.komi-profile-notice')?.textContent||'';
    await komiHydrateSavedAnimeCards('qa-u1');
    renderProfileView(container);
    const loaded=container.textContent.includes('Кэшированная карточка QA');
    const savedCards=container.querySelectorAll('.anime-card').length;
    const noticeAfter=container.querySelector('.komi-profile-notice')?.textContent||'';
    currentUser={username:otherName,authUserId:'qa-u2'};
    userProfiles[otherName]={displayName:'Other QA',status:'Новичок',avatar:''};
    userAnimeStatuses[otherName]={[id]:'Просмотрено'};
    userFavorites[otherName]={};
    profileTargetUser=otherName;
    renderProfileView(container);
    const otherCount=container.querySelectorAll('.anime-card').length;
    const otherNotice=container.querySelector('.komi-profile-notice')?.textContent||'';
    return {before,loaded,savedCards,noticeAfter,otherCount,otherNotice};
   }finally{
    render=original.render;
    currentUser=original.currentUser;animeList=original.animeList;_supabase=original.supabase;
    profileTargetUser=original.target;profilePageSection=original.section;
    profileActiveTab=original.tab;profileCollectionSearchQuery=original.query;
    for(const [store,name,value] of [
      [userProfiles,qaName,original.firstProfile],[userProfiles,otherName,original.secondProfile],
      [userAnimeStatuses,qaName,original.firstStatuses],[userAnimeStatuses,otherName,original.secondStatuses],
      [userFavorites,qaName,original.firstFavorites],[userFavorites,otherName,original.secondFavorites]
    ]){if(value===undefined)delete store[name];else store[name]=value;}
    komiSavedAnimeCards.clear();for(const [id,card] of original.cards)komiSavedAnimeCards.set(id,card);
    komiSavedCardsOwner=original.owner;
    container.remove();
   }
  });
  assert.match(result.before,/1 сохранённых аниме/);
  assert.equal(result.loaded,true);
  assert.equal(result.savedCards,1);
  assert.equal(result.noticeAfter,'');
  assert.equal(result.otherCount,0);
  assert.match(result.otherNotice,/1 сохранённых аниме/);
  console.log('PASS early saved-card hydration and verified account isolation');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
