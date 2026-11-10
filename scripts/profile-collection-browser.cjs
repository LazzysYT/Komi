const {chromium}=require('playwright');
const assert=require('node:assert/strict');

(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.KOMI_CHROME?{executablePath:process.env.KOMI_CHROME}:{})});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:850}});
  await page.route('https://**/*',route=>route.fulfill({status:200,contentType:'application/json',body:'{}'}));
  await page.goto(process.env.KOMI_TEST_URL||'http://127.0.0.1:8765');
  await page.waitForFunction(()=>typeof renderProfileView==='function');
  const result=await page.evaluate(()=>{
   const originalUser=currentUser, originalStatuses=userAnimeStatuses.qa_saved,
     originalProfile=userProfiles.qa_saved, originalFolder=userCustomFolders.qa_saved,
     originalList=animeList, originalSection=profilePageSection, originalTab=profileActiveTab,
     originalTarget=profileTargetUser, originalQuery=profileCollectionSearchQuery;
   const container=document.createElement('div');
   document.body.append(container);
   try {
    currentUser={username:'qa_saved',authUserId:'qa-verified'};
    userProfiles.qa_saved={displayName:'QA saved owner',avatar:'/anime-artwork.svg',status:'Участник'};
    userAnimeStatuses.qa_saved={'989898':'Просмотрено'};
    userCustomFolders.qa_saved={};
    profileTargetUser=null;
    profilePageSection='anime';
    profileActiveTab='Просмотрено';
    profileCollectionSearchQuery='';
    animeList=[];
    renderProfileView(container);
    const missing=container.querySelector('.komi-profile-notice')?.textContent||'';
    const empty=container.querySelector('.empty-state')?.textContent||'';
    const count=container.querySelector('.profile-stat-card.active')?.textContent||'';
    animeList=[{id:'989898',title:'Тестовое сохранённое аниме',genres:['Драма'],
      poster:'/anime-artwork.svg',year:2026,episodeCount:1,shikiRating:7.3}];
    renderProfileView(container);
    return {missing,empty,count,
      shownCards:container.querySelectorAll('.anime-card').length,
      titleShown:container.textContent.includes('Тестовое сохранённое аниме'),
      noticeAfter:!!container.querySelector('.komi-profile-notice')};
   } finally {
    currentUser=originalUser;
    animeList=originalList;
    profilePageSection=originalSection;profileActiveTab=originalTab;
    profileTargetUser=originalTarget;profileCollectionSearchQuery=originalQuery;
    if(originalStatuses===undefined)delete userAnimeStatuses.qa_saved;
    else userAnimeStatuses.qa_saved=originalStatuses;
    if(originalProfile===undefined)delete userProfiles.qa_saved;
    else userProfiles.qa_saved=originalProfile;
    if(originalFolder===undefined)delete userCustomFolders.qa_saved;
    else userCustomFolders.qa_saved=originalFolder;
    container.remove();
   }
  });
  assert.match(result.missing,/1 сохранённых аниме/,'Missing catalog card must not be represented as an empty saved list');
  assert.match(result.empty,/Ожидаем карточки каталога/);
  assert.match(result.count,/1/);
  assert.equal(result.shownCards,1,'Card should appear after its catalog metadata becomes available');
  assert.equal(result.titleShown,true);
  assert.equal(result.noticeAfter,false);
  console.log('PASS saved watched collection: missing card notice, count preserved, metadata card appears');
  await page.close();
 } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
