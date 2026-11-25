/* Guest-only V7 studio smoke test. Keeps its CI entry-point name; never accepts a purchase. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
// The hash entry works with CI's plain Python static server as well as deployed routing.
const url=new URL('/#shop',process.env.KOMI_TEST_URL||'http://127.0.0.1:8765/').href;
const output=path.resolve('browser-test-results');
fs.mkdirSync(output,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true});
 const context=await browser.newContext({viewport:{width:1600,height:900},serviceWorkers:'block'});
 const page=await context.newPage();
 const attemptedMutations=[];
 const nativeDialogs=[];
 const shop=page.locator('#shop.komi-shop-studio:not(.komi-static-shop)');
 const cards=page.locator('#shop .sv3-item');
 const search=page.locator('#shop [data-v7-search]');
 // Defense in depth even when KOMI_TEST_URL points to production: only read RPCs
 // may reach the shop backend. The confirmation test below has no purchase caller.
 await page.route('**/rest/v1/rpc/**',async route=>{
   const request=route.request(),rpc=new URL(request.url()).pathname.split('/').pop();
   let args={};try{args=request.postDataJSON()||{};}catch{}
   const shopRPC=['komi_premium_store','komi_shop_gifts','komi_shop_booster','komi_anicoin'].includes(rpc);
   if(rpc==='komi_shop_cart_buy_equip'||shopRPC&&args.p_action!=='read'){
     attemptedMutations.push(rpc);await route.abort('blockedbyclient');return;
   }
   await route.continue();
 });
 page.on('dialog',async dialog=>{nativeDialogs.push(dialog.type());await dialog.dismiss();});
 const waitForShop=async()=>{
   await shop.waitFor({timeout:20000});
   await page.waitForFunction(()=>window.KomiShopCatalog?.items?.length&&
     document.querySelector('#shop [data-v7-search]'),null,{timeout:20000});
 };
 const selected=()=>page.evaluate(()=>window.KomiShopV3.selected());
 try{
   await page.goto(url,{waitUntil:'domcontentloaded',timeout:45000});
   await waitForShop();
   assert.equal(await page.evaluate(()=>typeof currentUser==='undefined'||!currentUser?.authUserId),true,
     'This smoke test must remain signed out');
   const metadata=await page.evaluate(()=>({
     items:window.KomiShopCatalog.items.map(({id,type,cost,label,cosmeticClass})=>({id,type,cost,label,cosmeticClass})),
     collections:window.KomiShopCatalog.collections.map(({id,items,preview})=>({id,items,preview}))
   }));
   assert.equal(metadata.items.length,141,'The complete catalogue contains 141 real products');
   assert.equal(metadata.collections.length,6,'Six permanent collections are available');
   assert.equal(await cards.count(),24,'Guest browsing starts with a bounded 24-item page');
   assert.equal(await page.locator('#shop .sv5-preview-button').count(),24,'Every visible product can be tried on');
   assert.match(await page.locator('#shop .sv7-load-more').innerText(),/Показано 24 из 141/);
   const firstAction=page.locator('#shop .sv3-primary-buy').first();
   if(new URL(page.url()).hostname==='komianime.online'){
     assert.match(await firstAction.innerText(),/Войти/,'Guest buy action must request login');
   }else{
     assert.match(await firstAction.innerText(),/Только примерка/,'Preview clearly disables purchases');
     assert.equal(await firstAction.isDisabled(),true);
   }
   const firstId=await cards.first().getAttribute('data-item-id');
   assert.equal(Number((await cards.first().locator('.sv3-unit-price strong').innerText()).replace(/\s/g,'')),
     metadata.items.find(item=>item.id===firstId).cost,'Visible price matches the catalogue');
   assert.equal(await page.locator('#shop [data-v7-collection]').count(),6);
   assert.equal(await page.locator('#shop [data-v7-look]').count(),6);
   assert.equal(await page.locator('#shop .sv5-weekly,#shop .sv4-feature-card').count(),0);
   assert.equal(await page.locator('#shop [data-v3-category]').count(),6,'Desktop offers six quick category filters');
   assert.equal(await page.locator('#shop select[data-v7-category-select] option').count(),14,
     'The native category selector includes All and every product type');
   assert.equal(await page.locator('#shop select[data-v3-sort] option').count(),5);
   assert.equal(await page.locator('#shop .sv3-item-actions .komi-shop-gift-button').count(),24);
   assert.equal(await page.locator('#shop .komi-shop-gift-button .komi-sticker-icon').count(),24,
     'Gift actions still use the shared filled icons');

   const bundleCSS=await page.evaluate(()=>[...document.querySelectorAll('head link[rel="stylesheet"]:not([data-komi-first-paint])')]
     .filter(link=>new URL(link.href).origin===location.origin).map(link=>new URL(link.href).pathname));
   const expectedCSS=['/komi.production.css','/komi-pill-system.css'];
   if(bundleCSS.includes('/komi-icon-rail.css'))expectedCSS.push('/komi-icon-rail.css');
   expectedCSS.push('/komi-shop-v5.css','/komi-shop-v6-goods.css','/button-animations.css',
     '/komi-genre-moods.css','/komi-watch-compact-v6.css','/komi-hero-senku.css','/profile-studio.css');
   assert.deepEqual(bundleCSS,expectedCSS,'Production CSS preserves the shared cascade order');
   const geometry=await page.evaluate(()=>{
     const section=document.querySelector('#shop.komi-shop-studio');
     const top=section.querySelector('.sv3-topbar'),collections=section.querySelector('.sv7-collections');
     const grid=section.querySelector('.sv3-product-grid');
     return {headerPosition:getComputedStyle(top).position,headerBottom:top.getBoundingClientRect().bottom,
       collectionsTop:collections.getBoundingClientRect().top,
       columns:getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length,
       horizontalOverflow:document.documentElement.scrollWidth>window.innerWidth+2};
   });
   assert.equal(geometry.headerPosition,'relative','The inner shop header must not inherit sticky site chrome');
   assert.ok(geometry.headerBottom+8<=geometry.collectionsTop,'Header and collections must not overlap');
   assert.ok(geometry.columns>=3,'Desktop uses the available shelf width');
   assert.equal(geometry.horizontalOverflow,false,'Desktop storefront fits the viewport');

   const collection=metadata.collections[0];
   await page.locator('#shop [data-v7-collection="'+collection.id+'"]').click();
   assert.equal(await cards.count(),collection.items.length,'A collection filters to its actual products');
   assert.equal(new URL(page.url()).searchParams.get('shop_collection'),collection.id);
   await page.locator('#shop [data-v7-look="'+collection.id+'"]').click();
   assert.deepEqual((await selected()).sort(),[...collection.preview].sort(),'One look previews its three real slots');
   await page.locator('#shop [data-v3-reset]').click();
   assert.deepEqual(await selected(),[],'Reset clears the free trial');
   await page.locator('#shop [data-v3-reset-filters]').click();
   assert.equal(await cards.count(),24);
   await page.locator('#shop [data-v7-more]').click();
   assert.equal(await cards.count(),48,'Load more appends the next page');
   assert.equal(await page.locator('#shop .komi-shop-gift-button').count(),48,'New cards receive gift actions');
   for(let loadedPages=2;loadedPages<6&&await page.locator('#shop [data-v7-more]').count();loadedPages++)
     await page.locator('#shop [data-v7-more]').click();
   const allIds=await cards.evaluateAll(nodes=>nodes.map(node=>node.dataset.itemId));
   assert.equal(allIds.length,141);
   assert.equal(new Set(allIds).size,141,'Pagination neither duplicates nor hides products');
   assert.deepEqual([...allIds].sort(),metadata.items.map(item=>item.id).sort());

   await page.locator('#shop select[data-v7-category-select]').selectOption('shape');
   assert.equal(await cards.count(),8,'All eight avatar shapes remain discoverable');
   await page.locator('#shop select[data-v3-sort]').selectOption('price-up');
   const prices=await cards.evaluateAll(nodes=>nodes.map(node=>window.KomiShopCatalog.find(node.dataset.itemId).cost));
   assert.deepEqual(prices,[...prices].sort((a,b)=>a-b),'Price sorting is numeric');
   await page.locator('#shop select[data-v7-category-select]').selectOption('banner');
   assert.equal(await cards.count(),17,'All seventeen profile covers remain discoverable');
   await page.locator('#shop [data-v7-view="owned"]').click();
   assert.equal(await cards.count(),0);
   assert.match(await page.locator('#shop .sv3-no-results').innerText(),/Войди/,'Guests receive an honest inventory state');
   await page.locator('#shop [data-v7-view="catalog"]').click();
   await search.fill('лУнНаЯ РАМКА');
   assert.equal(await cards.count(),1,'Local search ignores case');
   assert.equal(await cards.first().getAttribute('data-item-id'),'frame_moon');
   assert.equal(new URL(page.url()).searchParams.get('shop_q'),'лУнНаЯ РАМКА');
   await page.reload({waitUntil:'domcontentloaded'});
   await waitForShop();
   assert.equal(await search.inputValue(),'лУнНаЯ РАМКА','Reload restores the committed URL query');
   assert.equal(await cards.count(),1);
   await page.locator('#shop [data-v3-try="frame_moon"]').click();
   assert.deepEqual(await selected(),['frame_moon'],'Trying on does not require authentication');
   await page.locator('#shop [data-v7-clear-search]').click();
   assert.equal(await search.inputValue(),'');
   assert.equal(await cards.count(),24);
   assert.equal(await search.evaluate(node=>document.activeElement===node),true,'Clear returns keyboard focus to search');
   assert.deepEqual(await selected(),['frame_moon'],'Filtering preserves the fitting room');
   await search.fill('zz-no-such-cosmetic');
   assert.equal(await cards.count(),0);
   await page.locator('#shop [data-v7-browse]').click();
   assert.equal(await cards.count(),24,'Empty-state recovery restores the catalogue');

   // Exercise the exported dialog primitive, not checkout: no account is forged,
   // no payment caller awaits this promise, and Accept is never activated.
   for(const dismissal of ['escape','cancel']){
     await search.focus();
     await page.evaluate(()=>{
       if(typeof currentUser!=='undefined'&&currentUser?.authUserId)throw Error('Guest-only confirmation check');
       const item=window.KomiShopCatalog.find('frame_moon');
       window.__komiShopSmokeConfirmation={settled:false,accepted:null};
       window.KomiShopV3.confirmPurchase({items:[{...item}],total:item.cost,balance:item.cost+50,owner:'',action:'buy_equip'})
         .then(accepted=>{window.__komiShopSmokeConfirmation={settled:true,accepted};});
     });
     const dialog=page.locator('dialog.sv7-purchase-dialog');
     await dialog.waitFor({state:'visible'});
     assert.equal(await dialog.evaluate(node=>node.open&&node.matches(':modal')),true,'Confirmation uses a native modal dialog');
     assert.equal(await dialog.getAttribute('aria-labelledby'),'sv7PurchaseTitle');
     assert.match(await dialog.locator('.sv7-confirm-items').innerText(),/Лунная рамка/);
     assert.equal(await dialog.locator('[data-confirm-cancel]').evaluate(node=>document.activeElement===node),true,
       'Cancel receives initial keyboard focus');
     if(dismissal==='escape')await page.keyboard.press('Escape');
     else await dialog.locator('[data-confirm-cancel]').click();
     await dialog.waitFor({state:'detached'});
     await page.waitForFunction(()=>window.__komiShopSmokeConfirmation?.settled);
     assert.equal(await page.evaluate(()=>window.__komiShopSmokeConfirmation.accepted),false);
     assert.equal(await search.evaluate(node=>document.activeElement===node),true,'Dismissal restores the originating control');
     assert.deepEqual(await selected(),['frame_moon'],'Cancellation leaves the free trial intact');
   }
   await page.locator('#shop select[data-v7-category-select]').selectOption('frame');
   await page.evaluate(()=>{navigate('home');navigate('shop');});
   await waitForShop();
   assert.equal(new URL(page.url()).search,'','Explicit shop navigation opens a clean route');
   assert.equal(await page.locator('#shop select[data-v7-category-select]').inputValue(),'all',
     'Reentry cannot retain filters absent from the URL');
   assert.equal(await cards.count(),24);
   await page.screenshot({path:path.join(output,'shop-v3-desktop.png'),fullPage:true});

   await page.setViewportSize({width:390,height:844});
   const bar=page.locator('#shop [data-v3-sheet]'),fitting=page.locator('#shop .sv3-fitting');
   await bar.waitFor({state:'visible'});
   assert.equal(await fitting.evaluate(node=>getComputedStyle(node).position),'fixed');
   if(await fitting.evaluate(node=>node.classList.contains('is-open')))await bar.click();
   assert.equal(await page.locator('#shop .sv3-fitting-body').isVisible(),false);
   await bar.click();
   assert.equal(await bar.getAttribute('aria-expanded'),'true');
   assert.equal(await page.locator('#shop .sv3-fitting-body').isVisible(),true);
   assert.equal(await page.locator('#shop [data-v3-reset]').isVisible(),true,'Mobile keeps the Reset action');
   assert.equal(await page.locator('#shop .sv3-comment').isVisible(),true,'Mobile keeps the actual comment preview');
   const mobileGeometry=await page.evaluate(()=>{
     const panel=document.querySelector('#shop .sv3-fitting').getBoundingClientRect();
     return {headerPosition:getComputedStyle(document.querySelector('#shop .sv3-topbar')).position,
       columns:getComputedStyle(document.querySelector('#shop .sv3-product-grid')).gridTemplateColumns.split(' ').filter(Boolean).length,
       horizontalOverflow:document.documentElement.scrollWidth>window.innerWidth+2,
       fittingTop:panel.top,fittingBottom:panel.bottom,viewportHeight:window.innerHeight};
   });
   assert.equal(mobileGeometry.headerPosition,'relative');
   assert.equal(mobileGeometry.columns,2,'Phone catalogue uses two columns');
   assert.equal(mobileGeometry.horizontalOverflow,false,'Phone storefront fits the viewport');
   assert.ok(mobileGeometry.fittingTop>=0&&mobileGeometry.fittingBottom<=mobileGeometry.viewportHeight+1,
     'Expanded fitting room stays inside the viewport');
   await page.locator('#shop [data-v3-checkout]').scrollIntoViewIfNeeded();
   assert.equal(await page.locator('#shop [data-v3-checkout]').isVisible(),true);
   await page.screenshot({path:path.join(output,'shop-v3-mobile.png'),fullPage:false});
   await page.keyboard.press('Escape');
   assert.equal(await bar.getAttribute('aria-expanded'),'false','Escape closes the nonmodal mobile sheet');
   assert.deepEqual(attemptedMutations,[],'The guest smoke test never attempts a paid or inventory mutation');
   assert.deepEqual(nativeDialogs,[],'Product UI must not use browser alert/confirm/prompt');
   console.log('PASS Komi Shop V7 guest desktop + mobile: 141 products, 24-item pages, six collections, search, URL restoration, sorting, free previews, native confirmation cancellation and mobile sheet; no purchase attempted');
 }finally{await context.close();await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
