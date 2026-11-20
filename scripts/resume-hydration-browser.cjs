/* Reproduce the reported same-tab refresh: a public preview contains only
 * part of the account's history, but the resume row must not change order. */
'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const base=process.env.KOMI_TEST_URL||'http://127.0.0.1:8765/';
const UID='00000000-0000-4000-8000-000000000001';
(async()=>{
 const browser=await chromium.launch({headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:850}});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/rest/v1/komi_catalog_cards*',route=>route.fulfill({
   status:200,contentType:'application/json',body:'[]'
 }));
 try{
  await page.goto(base,{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForFunction(()=>typeof window.KomiResumeCache?.write==='function' &&
    typeof render==='function' && typeof window.KomiHomeDiscovery?.recentProgress==='function',
    {timeout:15000});
  await page.evaluate(uid=>{
    const make=id=>({
      id:String(id),title:'Saved episode '+id,
      poster:'https://images.example.org/'+id+'.jpg',
      screenshots:[],genres:['Экшен'],year:'2026',shikiRating:8,
      type:'Сериал',episodeCount:12,episodes:[]
    });
    const full=[1,2,3,4,5,6].map(make);
    currentUser={username:'fixtureOwner',authUserId:uid};
    komiSessionResolved=true;
    animeList=full;
    komiHomeCatalogReady=true;
    komiHomePreviewCatalog=null;
    komiEpisodeProgress=Object.fromEntries(full.map(a=>[
       'fixtureOwner_'+a.id,
       {season:1,index:0,time:0,duration:90,updated:10000+Number(a.id)}
    ]));
    komiResumeReadyUid=uid;
    komiStoreReadyResume();
    render();
  },UID);
  const cards=page.locator('.komi-home-continue .komi-home-progress-card:not(.komi-resume-placeholder) strong');
  await cards.first().waitFor({timeout:8000});
  const baseline=await cards.allTextContents();
  assert.deepEqual(baseline,[
    'Saved episode 6','Saved episode 5','Saved episode 4',
    'Saved episode 3','Saved episode 2','Saved episode 1'
  ]);
  await page.evaluate(uid=>{
    komiHomeCatalogReady=false;
    komiHomePreviewCatalog=animeList.slice(0,2);
    animeList=komiHomePreviewCatalog;
    komiResumeReadyUid=null;
    komiEpisodeProgress={fixtureOwner_1:{season:1,index:0,time:0,duration:90,updated:10001}};
    komiResumePreview=window.KomiResumeCache.read(uid);
    render();
  },UID);
  await page.waitForTimeout(70);
  assert.deepEqual(await cards.allTextContents(),baseline,
    'Partial public catalog must not remove, insert or reorder watch cards');
  await page.evaluate(()=>{
    currentUser={username:'fixtureOther',authUserId:'00000000-0000-4000-8000-000000000002'};
    komiResumePreview=window.KomiResumeCache.read(currentUser.authUserId);
    komiResumeReadyUid=null;
    render();
  });
  assert.equal(await page.locator('.komi-home-continue .komi-home-progress-card:not(.komi-resume-placeholder)').count(),0,
    'Other account must not inherit resume cards');
  assert.equal(errors.length,0,'Page errors: '+errors.join(';'));
  console.log('PASS resume row is stable through partial preview and owner changes');
 } finally{await context.close();await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
