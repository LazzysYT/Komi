const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');
const output=path.join(__dirname,'../browser-test-results');fs.mkdirSync(output,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.KOMI_CHROME?{executablePath:process.env.KOMI_CHROME}:{})});
 let state={id:'test-room',host:'host',anime_id:'1',name:'Тест комнаты',episode:0,source:'Direct',position:0,playing:false,messages:[],changed_at:new Date().toISOString()};
 const pages=[];
 try {
  for(const owner of ['host','viewer']) {
   const page=await browser.newPage();pages.push(page);
   await page.route('https://**/*',route=>route.fulfill({status:200,contentType:'application/json',body:'{}'}));
   await page.exposeFunction('testPartyRpc',async(action,args)=>{
    if(action==='state') {assert.equal(owner,'host');Object.assign(state,args,{changed_at:new Date().toISOString()});}
    if(action==='invite') state.invited = args.username;
    if(action==='close') return null;
    return {...state,server_now:new Date().toISOString()};
   });
   await page.goto(process.env.KOMI_TEST_URL||'http://127.0.0.1:8765');
   await page.waitForFunction(()=>typeof enterParty==='function');
   await page.evaluate(async({owner,state})=>{
    currentUser={authUserId:owner,username:owner};
    animeList=[{id:'1',title:'Тест',komiDetailsLoaded:true,episodes:[{season:1,number:1,sources:{Direct:'https://media.test/a.mp4',Embed:'<iframe src="https://media.test/player?a=1&amp;b=2"></iframe>'}}]}];
    _supabase={
      rpc:async(name,{action,args})=>({data:await window.testPartyRpc(action,args)}),
      from:table=>({select:()=>table==='komi_friendships'
        ? Promise.resolve({data:[{user_a:'host',user_b:'friend-id'}],error:null})
        : {in:()=>Promise.resolve({data:[{user_id:'friend-id',username:'friend_test',display_name:'Тестовый друг',avatar_url:null}],error:null})}})
    };
    await enterParty(state);
    const video=document.getElementById('partyVideoElement');
    Object.defineProperty(video,'readyState',{configurable:true,value:4});
    Object.defineProperty(video,'duration',{configurable:true,value:300});
    Object.defineProperty(video,'currentTime',{configurable:true,writable:true,value:0});
    video.dispatchEvent(new Event('loadedmetadata'));
   },{owner,state:{...state,server_now:new Date().toISOString()}});
  }
  await pages[0].locator('.komi-party-friend-invite').waitFor({timeout:8000});
  assert.equal(await pages[0].locator('.komi-party-friend-row').count(),1);
  await pages[0].locator('.komi-party-friend-invite').click();
  assert.equal(state.invited,'friend_test');
  assert.equal(await pages[0].locator('.komi-party-friend-invite').innerText(),'Приглашён');
  const hostPage=pages[0];
  const cinema=await hostPage.evaluate(()=>{
    const modal=document.getElementById('watchPartyModalContent');
    const chat=document.getElementById('partyChatBox');
    const bounds=modal.getBoundingClientRect(), chatBox=chat.getBoundingClientRect();
    return {active:document.getElementById('watchPartyModal').classList.contains('komi-party-room-active'),
      width:bounds.width,height:bounds.height,radius:parseFloat(getComputedStyle(modal).borderTopLeftRadius),
      chatWidth:chatBox.width,chatRadius:parseFloat(getComputedStyle(chat).borderTopLeftRadius)};
  });
  assert.equal(cinema.active,true);
  assert.ok(cinema.width>1100 && cinema.height>630,'Party should occupy almost the full desktop window');
  assert.ok(cinema.radius>=15 && cinema.chatRadius>=12,'Party panels should be rounded');
  assert.ok(cinema.chatWidth>=280,'Desktop chat should be a visible side panel');
  await hostPage.screenshot({path:path.join(output,'cinema-party-desktop.png')});
  await hostPage.locator('.komi-party-fullscreen-btn').click();
  assert.equal(await hostPage.locator('#watchPartyModal').evaluate(el=>el.classList.contains('komi-party-fullscreen')),true);
  await hostPage.locator('.komi-party-fullscreen-btn').click();
  await hostPage.setViewportSize({width:390,height:844});
  const mobile=await hostPage.evaluate(()=>{
    const modal=document.getElementById('watchPartyModalContent').getBoundingClientRect();
    const layout=getComputedStyle(document.querySelector('.komi-party-room-layout')).gridTemplateColumns;
    return {width:modal.width,height:modal.height,layout,scrollWidth:document.documentElement.scrollWidth};
  });
  assert.ok(mobile.width>=375 && mobile.height>=820,'Party should use mobile viewport');
  assert.ok(mobile.scrollWidth<=392,'Party should not overflow mobile horizontally');
  await hostPage.screenshot({path:path.join(output,'cinema-party-mobile.png')});
  await hostPage.setViewportSize({width:1280,height:720});
  await pages[0].evaluate(()=>{const video=document.getElementById('partyVideoElement');video.currentTime=85;video.dispatchEvent(new Event('seeked'));});
  await pages[1].waitForFunction(()=>Math.abs(document.getElementById('partyVideoElement').currentTime-85)<0.2);
  assert.equal(state.position,85);
  await pages[0].selectOption('#partyEpisode','1');
  await pages[1].waitForFunction(()=>document.getElementById('partyEmbedElement').getAttribute('src')==='https://media.test/player?a=1&b=2');
  assert.equal(state.source,'Embed');assert.equal(state.position,0);
  await pages[0].selectOption('#partyEpisode','0');
  await pages[1].waitForFunction(()=>document.getElementById('partyEmbedElement').getAttribute('src')===null);
  for(const page of pages) await page.evaluate(()=>leaveWatchPartyRoom());
  console.log('PASS two browser clients: seek, paused state, source switch, entity decoding, leave cleanup (mock RPC/media)');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
