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
    const malicious='Evil"><img src=x onerror="window.__komiProfileXss=1">';
    const username='qa-profile-security';
    const originals={
      currentUser,animeList,profileTargetUser,profilePageSection,profileActiveTab,
      profileCollectionSearchQuery,profile:userProfiles[username],
      statuses:userAnimeStatuses[username],friends:userFriends[username],
      folders:userCustomFolders[username],walls:profileWalls[username],
      evilProfile:userProfiles[malicious]
    };
    const container=document.createElement('div');
    container.id='qa-profile-test';
    document.body.append(container);
    window.__komiProfileXss=0;
    try{
      currentUser={username,authUserId:'qa-secure'};
      animeList=[{id:'123',title:'Sample',genres:[malicious],
        poster:'/anime-artwork.svg',year:'2026',episodeCount:1,shikiRating:7.3}];
      userProfiles[username]={displayName:'QA profile',status:'QA',regDate:'Today',
        avatar:'https://example.com/avatar.png'};
      userProfiles[malicious]={displayName:malicious,avatar:'javascript:alert(1)'};
      userAnimeStatuses[username]={'123':'Просмотрено'};
      userFriends[username]=[malicious];
      userCustomFolders[username]={[malicious]:['123']};
      profileWalls[username]=[{author:malicious,time:'Now',text:malicious}];
      profileTargetUser=username;
      profilePageSection='friends';
      profileActiveTab='В планах';
      profileCollectionSearchQuery='';
      renderProfileView(container);
      const buttons=Array.from(container.querySelectorAll('button'));
      const friend=buttons.find(x=>x.classList.contains('komi-profile-friend'));
      const folder=buttons.find(x=>x.classList.contains('season-tab-btn')&&x.textContent.includes('Evil'));
      // Genres appear on Overview, while the friends list appears on Friends.
      const overview=document.createElement('div');
      profilePageSection='overview';
      renderProfileView(overview);
      const genreText=overview.querySelector('.komi-genre-row span')?.textContent||'';
      return {
        fakeImageNodes:container.querySelectorAll('img[src="x"]').length,
        invalidSvgNodes:container.querySelectorAll('img[src^="javascript:"]').length,
        encodedText:container.innerHTML.includes('&lt;img src=x'),
        friendText:friend?.textContent||'',
        friendHandler:friend?.getAttribute('onclick')||'',
        folderText:folder?.textContent||'',
        folderHandler:folder?.getAttribute('onclick')||'',
        genreText,
        wallAvatar:container.querySelector('.wall-message-author img')?.getAttribute('src')||'',
        wallHandlers:Array.from(container.querySelectorAll('[onclick]')).map(e=>e.getAttribute('onclick')),
      };
    }finally{
      currentUser=originals.currentUser;animeList=originals.animeList;
      profileTargetUser=originals.profileTargetUser;profilePageSection=originals.profilePageSection;
      profileActiveTab=originals.profileActiveTab;profileCollectionSearchQuery=originals.profileCollectionSearchQuery;
      for(const [target,original] of [
        [userProfiles,originals.profile],[userAnimeStatuses,originals.statuses],
        [userFriends,originals.friends],[userCustomFolders,originals.folders],
        [profileWalls,originals.walls]
      ]){
        if(target===userProfiles){if(original===undefined)delete target[username];else target[username]=original;}
        else if(original===undefined)delete target[username];else target[username]=original;
      }
      if(originals.evilProfile===undefined)delete userProfiles[malicious];
      else userProfiles[malicious]=originals.evilProfile;
      container.remove();
    }
  });
  assert.equal(result.fakeImageNodes,0);
  assert.equal(result.invalidSvgNodes,0);
  assert.equal(result.encodedText,true);
  assert.match(result.friendText,/Evil/);
  assert.match(result.folderText,/Evil/);
  assert.match(result.genreText,/Evil/);
  assert.match(result.friendHandler,/window\.komiProfileFriendNames\[0\]/);
  assert.match(result.folderHandler,/window\.komiProfileFolderNames\[0\]/);
  assert.ok(result.wallAvatar.startsWith('https://api.dicebear.com/'));
  assert.ok(result.wallHandlers.every(h=>!h.includes('Evil')));
  await page.waitForTimeout(50);
  assert.equal(await page.evaluate(()=>window.__komiProfileXss),0);
  console.log('PASS profile markup security: untrusted names, folders, genres and wall avatars remain inert');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
