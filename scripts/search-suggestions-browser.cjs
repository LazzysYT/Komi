const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.KOMI_CHROME?{executablePath:process.env.KOMI_CHROME}:{})});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:800}});
  await page.route('https://**/*',route=>route.fulfill({status:200,contentType:'application/json',body:'{}'}));
  await page.goto(process.env.KOMI_TEST_URL || 'http://127.0.0.1:8765',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>typeof showSearchDropdown==='function'&&
    typeof handleInstantSearch==='function'&&!!document.getElementById('searchDropdown'));
  const result=await page.evaluate(()=>{
   const maliciousId="123');window.__komiSearchInjected=1;//";
   const maliciousTitle='Evil <img src=x onerror="window.__komiSearchInjected=1">';
   const original={animeList,openWatchModal,refresh:komiRefreshCatalogGrid,
     view:currentView,search:catalogSearchQuery,field:document.getElementById('searchInput')?.value};
   const dd=document.getElementById('searchDropdown');
   window.__komiSearchInjected=0;
   window.__selectedSearchId=null;
   const anime={id:maliciousId,title:maliciousTitle,poster:'javascript:alert(1)',
     genres:['Evil'],year:'2026',shikiRating:'9.0'};
   try{
    animeList=[anime];
    currentView='home';
    komiRefreshCatalogGrid=()=>{};
    openWatchModal=id=>{window.__selectedSearchId=id};
    const field=document.getElementById('searchInput');
    field.value='';
    showSearchDropdown();
    const popular=dd.querySelector('.search-dropdown-item');
    const popularResult={
      title:popular.querySelector('b')?.textContent,
      hasInlineHandler:popular.hasAttribute('onclick'),
      posterSrc:popular.querySelector('img')?.getAttribute('src'),
      fakeImageNodes:dd.querySelectorAll('img[src="x"]').length
    };
    popular.click();
    const popularSelected=window.__selectedSearchId;
    window.__selectedSearchId=null;
    handleInstantSearch('Evil');
    const viewAfterTyping=currentView;
    const allResultsAction=dd.querySelector('.komi-search-view-all')?.textContent;
    const matched=dd.querySelector('.search-dropdown-item');
    const searchedResult={
      title:matched?.querySelector('b')?.textContent,
      hasInlineHandler:matched?.hasAttribute('onclick'),
      posterSrc:matched?.querySelector('img')?.getAttribute('src'),
      fakeImageNodes:dd.querySelectorAll('img[src="x"]').length
    };
    matched.click();
    const instantSelected=window.__selectedSearchId;
    handleInstantSearch('');
    const emptyState={open:dd.classList.contains('active'),children:dd.children.length};
    return {popularResult,searchedResult,popularSelected,instantSelected,maliciousId,maliciousTitle,
      emptyState,injected:window.__komiSearchInjected,viewAfterTyping,allResultsAction};
   }finally{
    animeList=original.animeList;openWatchModal=original.openWatchModal;
    komiRefreshCatalogGrid=original.refresh;currentView=original.view;
    catalogSearchQuery=original.search;
    const field=document.getElementById('searchInput');
    if(field)field.value=original.field||'';
    dd.replaceChildren();dd.classList.remove('active');
   }
  });
  for(const item of [result.popularResult,result.searchedResult]){
   assert.equal(item.title,result.maliciousTitle);
   assert.equal(item.hasInlineHandler,false);
   assert.equal(item.posterSrc,'/anime-artwork.svg');
   assert.equal(item.fakeImageNodes,0);
  }
  assert.equal(result.popularSelected,result.maliciousId);
  assert.equal(result.instantSelected,result.maliciousId);
  assert.deepEqual(result.emptyState,{open:false,children:0});
  assert.equal(result.injected,0);
  assert.equal(result.viewAfterTyping,'home','Typing in header must not replace the homepage');
  assert.match(result.allResultsAction,/Все результаты/);
  for(const width of [1440,390]){
   await page.setViewportSize({width,height:800});
   await page.evaluate(()=>{
     animeList=[{id:'16498',title:'Атака титанов',originalTitle:'Shingeki no Kyojin',shikiRating:9},...Array.from({length:32},(_,i)=>({id:String(80000+i),title:'Аниме '+(i+1),shikiRating:7,year:'2026'}))];
     ++komiCatalogRevision;currentView='home';window.scrollTo(0,0);
   });
   const field=page.locator('#searchInput'),dropdown=page.locator('#searchDropdown');
   await field.fill('Atack on Titan');
   await page.waitForFunction(()=>document.querySelector('#searchDropdown .search-dropdown-item b')?.textContent==='Атака титанов');
   await field.fill('Атака титанів');
   await page.waitForFunction(()=>document.querySelector('#searchDropdown .search-dropdown-item b')?.textContent==='Атака титанов');
   await field.fill('аниме');
   await page.waitForFunction(()=>document.querySelectorAll('#searchDropdown .search-dropdown-item').length===24);
   assert.equal(await field.getAttribute('autocomplete'),'off');
   const before=await dropdown.evaluate(el=>({scroll:el.scrollTop,client:el.clientHeight,total:el.scrollHeight,overflow:getComputedStyle(el).overflowY}));
   assert.equal(before.overflow,'auto');assert.ok(before.total>before.client+100,JSON.stringify(before));
   const box=await dropdown.boundingBox();
   await page.mouse.move(box.x+box.width/2,box.y+Math.min(130,box.height/2));
   await page.mouse.wheel(0,550);
   await page.waitForFunction(()=>document.getElementById('searchDropdown').scrollTop>100);
   await page.mouse.wheel(0,5000);
   await page.waitForFunction(()=>{const d=document.getElementById('searchDropdown');return d.scrollTop+d.clientHeight>=d.scrollHeight-3;});
   const last=await dropdown.locator('.komi-search-view-all').boundingBox(),visible=await dropdown.boundingBox();
   assert.ok(last.y+last.height<=visible.y+visible.height+1&&last.y>=visible.y,'All-results action is reachable');
   assert.match(await dropdown.locator('.komi-search-view-all').textContent(),/32/);
   await field.focus();
   await field.press('ArrowDown');
   assert.equal(await page.evaluate(()=>document.activeElement.classList.contains('search-dropdown-item')),true);
   assert.ok(await dropdown.evaluate(el=>el.scrollTop<100),'Keyboard returns to first result');
   await field.press('Escape');await dropdown.waitFor({state:'hidden'});
  }
  console.log('PASS safe popular and instant search suggestions, click handling, typo and localized search, and independent desktop/mobile scrolling');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
