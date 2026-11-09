const {chromium}=require('playwright');
const assert=require('node:assert/strict');
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
    if(action==='close') return null;
    return {...state,server_now:new Date().toISOString()};
   });
   await page.goto(process.env.KOMI_TEST_URL||'http://127.0.0.1:8765');
   await page.waitForFunction(()=>typeof enterParty==='function');
   await page.evaluate(async({owner,state})=>{
    currentUser={authUserId:owner,username:owner};
    animeList=[{id:'1',title:'Тест',komiDetailsLoaded:true,episodes:[{season:1,number:1,sources:{Direct:'https://media.test/a.mp4',Embed:'<iframe src="https://media.test/player?a=1&amp;b=2"></iframe>'}}]}];
    _supabase={rpc:async(name,{action,args})=>({data:await window.testPartyRpc(action,args)})};
    await enterParty(state);
    const video=document.getElementById('partyVideoElement');
    Object.defineProperty(video,'readyState',{configurable:true,value:4});
    Object.defineProperty(video,'duration',{configurable:true,value:300});
    Object.defineProperty(video,'currentTime',{configurable:true,writable:true,value:0});
    video.dispatchEvent(new Event('loadedmetadata'));
   },{owner,state:{...state,server_now:new Date().toISOString()}});
  }
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
