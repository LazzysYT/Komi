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
    currentView='catalog';
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
      emptyState,injected:window.__komiSearchInjected};
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
  console.log('PASS safe popular and instant search suggestions, click handling and clear state');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
