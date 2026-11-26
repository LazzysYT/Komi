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
 const context=await browser.newContext({viewport:{width:1536,height:686},serviceWorkers:'block',reducedMotion:'reduce'});
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
 const settleLayout=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 const checkCatalogueGeometry=async(label,{initial=false}={})=>{
   await settleLayout();
   const result=await page.evaluate(initial=>{
     const shop=document.querySelector('#shop.komi-shop-studio'),errors=[];
     const box=node=>node.getBoundingClientRect();
     const inside=(child,parent)=>child.left>=parent.left-2&&child.right<=parent.right+2&&child.top>=parent.top-2&&child.bottom<=parent.bottom+2;
     const check=(condition,message)=>{if(!condition)errors.push(message);};
     const toolbar=shop.querySelector('.sv7-toolbar'),filters=shop.querySelector('.sv7-filter-row');
     const browse=shop.querySelector('.sv7-browse-head'),search=shop.querySelector('.sv7-search'),tabs=shop.querySelector('.sv7-view-tabs');
     const sectionBox=box(shop),toolbarBox=box(toolbar),filterBox=box(filters),style=getComputedStyle(shop);
     check(Math.abs(toolbarBox.width-(sectionBox.width-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight)))<=3,'toolbar does not use the available shop width');
     check(Math.abs(filterBox.width-toolbarBox.width)<=3,'category/sort row is constrained to an intrinsic-width track');
     check(inside(box(search),box(browse))&&inside(box(tabs),box(browse)),'search or inventory tabs are clipped by their row');
     check(Math.abs(box(search).right-box(browse).right)<=3,'search leaves disconnected empty space on its right');
     for(const node of filters.querySelectorAll('.sv7-select,.sv7-toggles,.sv3-hide-toggle'))check(inside(box(node),filterBox),'a filter extends outside the filter row');
     check(getComputedStyle(shop.querySelector('.sv3-topbar')).position==='relative','shop header inherited sticky site chrome');
     check(document.documentElement.scrollWidth<=innerWidth+2,'document has horizontal overflow');
     const grid=shop.querySelector('.sv3-product-grid'),gridBox=box(grid);
     const columns=getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length;
     check(innerWidth<=767?columns===2:columns>=3,'unexpected product columns: '+columns);
     for(const card of grid.querySelectorAll('.sv3-item')){
       const id=card.dataset.itemId,cardBox=box(card),scene=card.querySelector('.sv3-item-scene');
       check(cardBox.left>=gridBox.left-2&&cardBox.right<=gridBox.right+2,id+': card extends beyond its grid');
       const copy=card.querySelector('.sv3-item-copy'),actions=card.querySelector('.sv3-item-actions');
       for(const part of [scene,copy,actions])check(inside(box(part),cardBox),id+': media, text or actions are clipped by the card');
       for(const action of actions.querySelectorAll('button'))check(inside(box(action),box(actions))&&inside(box(action),cardBox),id+': a purchase/gift button is clipped');
       const gift=actions.querySelector('.komi-shop-gift-button');
       if(gift)check(Math.abs(box(gift).top-box(actions.querySelector('.sv3-primary-buy')).top)<=2,id+': gift action wraps onto an unintended second row');
       check(box(scene).bottom<=box(copy).top+2&&box(copy).bottom<=box(actions).top+2,id+': card content overlaps');
       const visual=scene.firstElementChild,tryLabel=scene.querySelector('.sv7-try-label');
       check(box(visual).width>=12&&box(visual).height>=12&&inside(box(visual),box(scene)),id+': product example is empty, too small or clipped');
       check(box(visual).bottom<=box(tryLabel).top+2,id+': product example overlaps the Try action');
       const title=copy.querySelector('h3');
       check(title.scrollHeight<=title.clientHeight+2&&title.scrollWidth<=title.clientWidth+2,id+': product name is clipped');
     }
     let firstScene;
     if(initial){
       firstScene=box(grid.querySelector('.sv3-item-scene'));
       const panel=shop.querySelector('.sv3-fitting');
       const visibleBottom=getComputedStyle(panel).position==='fixed'&&panel.getClientRects().length?Math.min(innerHeight,box(panel).top):innerHeight;
       check(firstScene.top>=0&&firstScene.bottom<=visibleBottom+2,
         'initial viewport does not show the whole first product example: '+Math.round(firstScene.top)+'–'+Math.round(firstScene.bottom)+'; usable bottom '+Math.round(visibleBottom));
       check(!shop.querySelector('.sv7-collections').open,'collections unexpectedly displace the first products');
     }
     return {errors,columns,toolbarWidth:toolbarBox.width,filterWidth:filterBox.width,firstSceneBottom:firstScene?.bottom};
   },initial);
   assert.deepEqual(result.errors,[],label+': '+JSON.stringify(result));
 };
 const checkFittingGeometry=async label=>{
   await page.locator('#shop .sv3-fitting').scrollIntoViewIfNeeded();
   await settleLayout();
   const layout=await page.evaluate(()=>{
     const root=document.querySelector('#shop .sv3-fitting'),rect=selector=>root.querySelector(selector).getBoundingClientRect();
     const panel=root.getBoundingClientRect(),header=rect('.sv7-fitting-header'),scroll=rect('.sv7-fitting-scroll'),footer=rect('.sv7-checkout-footer');
     return {headerBottom:header.bottom,scrollTop:scroll.top,scrollBottom:scroll.bottom,footerTop:footer.top,
       footerBottom:footer.bottom,panelTop:panel.top,panelBottom:panel.bottom,viewportHeight:innerHeight,scrollHeight:scroll.height};
   });
   assert.ok(layout.headerBottom<=layout.scrollTop+2&&layout.scrollBottom<=layout.footerTop+2,
     label+': preview scrollport overlaps header/checkout '+JSON.stringify(layout));
   assert.ok(layout.footerBottom<=layout.panelBottom+2&&layout.panelTop>=-1&&layout.panelBottom<=layout.viewportHeight+1,
     label+': checkout or panel extends outside its visible bounds '+JSON.stringify(layout));
   for(const selector of ['.sv3-profile-cover','.sv3-profile-name','.sv3-comment','.sv3-selection-chip:last-child']){
     const target=page.locator('#shop '+selector);
     if(!await target.isVisible())continue;
     await page.evaluate(selector=>{
       const scroll=document.querySelector('#shop .sv7-fitting-scroll'),target=document.querySelector('#shop '+selector);
       scroll.scrollTop+=target.getBoundingClientRect().top-scroll.getBoundingClientRect().top-parseFloat(getComputedStyle(scroll).paddingTop);
     },selector);
     await settleLayout();
     const visibility=await target.evaluate(node=>{
       const rect=node.getBoundingClientRect(),scroll=node.closest('.sv7-fitting-scroll').getBoundingClientRect();
       const points=[[rect.left+rect.width/2,rect.top+3],[rect.left+rect.width/2,rect.bottom-3]];
       return {top:rect.top,bottom:rect.bottom,scrollTop:scroll.top,scrollBottom:scroll.bottom,
         unobscured:points.every(([x,y])=>{const hit=document.elementFromPoint(x,y);return hit===node||node.contains(hit);})};
     });
     assert.ok(visibility.top>=visibility.scrollTop-2&&visibility.bottom<=visibility.scrollBottom+2&&visibility.unobscured,
       label+': '+selector+' cannot be read without clipping or an overlay '+JSON.stringify(visibility));
   }
 };
 const checkAvatarStates=async()=>{
   // A CSS probe uses the actual rendered wrappers and a decoded local image.
   // No account, auth session, avatar upload or backend data is fabricated.
   const failures=await page.evaluate(async()=>{
     const section=document.querySelector('#shop.komi-shop-studio'),errors=[];
     const probe=document.createElement('div');probe.className='sv3-item-scene';probe.setAttribute('aria-hidden','true');
     probe.style.cssText='position:fixed;left:-1000px;top:0;width:240px;height:180px;pointer-events:none';section.append(probe);
     try{
       for(const selector of ['.komi-coin-frame','.sv3-shape','.sv3-avatar-cut','.sv3-comment-avatar','.sv7-collection-avatar','.sv7-card-avatar']){
         const original=section.querySelector(selector);
         if(!original){errors.push(selector+': missing avatar example');continue;}
         const wrapper=original.cloneNode(false),img=document.createElement('img'),fallback=document.createElement('span');
         img.alt='';img.src='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="#9c8fc3"/></svg>');
         fallback.textContent='6';fallback.hidden=true;wrapper.append(img,fallback);probe.replaceChildren(wrapper);await img.decode();
         const rect=wrapper.getBoundingClientRect(),image=img.getBoundingClientRect(),style=getComputedStyle(wrapper);
         const contentWidth=rect.width-parseFloat(style.borderLeftWidth)-parseFloat(style.borderRightWidth)-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight);
         if(getComputedStyle(fallback).display!=='none'||getComputedStyle(img).display==='none')errors.push(selector+': loaded image and fallback are not exclusive');
         if(image.width<contentWidth-2||image.height<12)errors.push(selector+': loaded avatar is squeezed');
         img.hidden=true;fallback.hidden=false;
         if(getComputedStyle(img).display!=='none'||getComputedStyle(fallback).display==='none')errors.push(selector+': failed image and fallback are not exclusive');
       }
     }finally{probe.remove();}
     return errors;
   });
   assert.deepEqual(failures,[],'Decoded avatar and failed-image fallback remain mutually exclusive');
 };
 try{
   await page.goto(url,{waitUntil:'domcontentloaded',timeout:45000});
   await waitForShop();
   assert.equal(await page.evaluate(()=>typeof currentUser==='undefined'||!currentUser?.authUserId),true,
     'This smoke test must remain signed out');
   const metadata=await page.evaluate(()=>({
     items:window.KomiShopCatalog.items.map(({id,type,cost,label,cosmeticClass})=>({id,type,cost,label,cosmeticClass})),
     collections:window.KomiShopCatalog.collections.map(({id,items,preview})=>({id,items,preview}))
   }));
   assert.equal(metadata.items.length,152,'The product registry retains 152 products, including archived items');
   assert.equal(metadata.collections.length,7,'Seven permanent collections are available');
   assert.equal(await cards.count(),24,'Guest browsing starts with a bounded 24-item page');
   assert.equal(await page.locator('#shop .sv5-preview-button').count(),24,'Every visible product can be tried on');
   assert.match(await page.locator('#shop .sv7-load-more').innerText(),/Показано 24 из 148/);
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
   assert.equal(await page.locator('#shop [data-v3-category]').count(),0,'A single complete selector replaces clipped category pills');
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
     '/komi-genre-moods.css','/komi-watch-compact-v6.css','/komi-hero-senku.css','/profile-studio.css',
     '/public-info.css');
   assert.deepEqual(bundleCSS,expectedCSS,'Production CSS preserves the shared cascade order');
   await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));
   await checkCatalogueGeometry('Short desktop first viewport',{initial:true});

   const collection=metadata.collections[0];
   await page.locator('#shop .sv7-collections > summary').click();
   await settleLayout();
   await page.locator('#shop [data-v7-collection="'+collection.id+'"]').click();
   assert.equal(await cards.count(),collection.items.length,'A collection filters to its actual products');
   assert.equal(new URL(page.url()).searchParams.get('shop_collection'),collection.id);
   await page.locator('#shop [data-v7-look="'+collection.id+'"]').click();
   assert.deepEqual((await selected()).sort(),[...collection.preview].sort(),'One look previews its three real slots');
   await checkFittingGeometry('Desktop fitting with three selected items');
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
   assert.equal(allIds.length,148);
   assert.equal(new Set(allIds).size,148,'Pagination neither duplicates nor hides products');
   assert.deepEqual([...allIds].sort(),metadata.items.map(item=>item.id).sort());
   await checkCatalogueGeometry('Complete desktop catalogue');
   await checkAvatarStates();
   const reactionArt=page.locator('#shop .sv3-item-scene .komi-shop-reaction-swatch [role="img"]');
   assert.equal(await reactionArt.count(),9,'All nine sold reactions have accessible examples');
   assert.equal(await reactionArt.locator('svg.komi-reaction-art').count(),9,'Reaction previews use local artwork, not unsupported font glyphs');
   assert.ok((await reactionArt.evaluateAll(nodes=>nodes.map(node=>node.getAttribute('aria-label')))).every(Boolean));

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
   await page.locator('#shop [data-v7-preview="comment"]').click();
   assert.equal(await page.locator('#sv7ProfilePreview').isVisible(),false);
   assert.equal(await page.locator('#sv7CommentPreview').isVisible(),true);
   await checkFittingGeometry('Desktop comment preview');
   await page.locator('#shop [data-v7-preview="profile"]').click();
   await page.screenshot({path:path.join(output,'shop-v3-desktop.png'),fullPage:true});

   await page.setViewportSize({width:390,height:844});
   await page.goto(url,{waitUntil:'domcontentloaded'});
   await waitForShop();
   await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));
   const bar=page.locator('#shop [data-v3-sheet]'),fitting=page.locator('#shop .sv3-fitting');
   await bar.waitFor({state:'hidden'});
   assert.equal(await fitting.isVisible(),false,'Empty fitting room cannot cover products');
   assert.equal(await page.locator('#shop .sv3-fitting-body').isVisible(),false);
   await checkCatalogueGeometry('Phone first viewport',{initial:true});
   await cards.first().locator('.sv3-item-scene').click();
   assert.equal(await bar.getAttribute('aria-expanded'),'true');
   assert.equal(await fitting.evaluate(node=>getComputedStyle(node).position),'fixed');
   assert.equal(await page.locator('#shop .sv3-fitting-body').isVisible(),true);
   assert.equal(await page.locator('#shop [data-v3-reset]').isVisible(),true,'Mobile keeps the Reset action');
   await checkFittingGeometry('Phone profile preview');
   await page.locator('#shop [data-v7-preview="comment"]').click();
   assert.equal(await page.locator('#sv7ProfilePreview').isVisible(),false);
   assert.equal(await page.locator('#shop .sv3-comment').isVisible(),true,'Phone can display the actual comment example');
   await checkFittingGeometry('Phone comment preview');
   assert.equal(await page.locator('#shop [data-v3-checkout]').isVisible(),true);
   await page.screenshot({path:path.join(output,'shop-v3-mobile.png'),fullPage:false});
   await page.locator('#shop [data-v3-reset]').click();
   assert.equal(await page.locator('#shop [data-v3-checkout]').isVisible(),false,'Empty fitting room has no dead checkout action');
   assert.equal(await fitting.isVisible(),false,'Reset removes the empty mobile fitting room');
   assert.equal(await search.evaluate(node=>document.activeElement===node),true,'Reset returns focus to search');
   await page.locator('#shop [data-v3-bundle="first-session"]').click();
   assert.deepEqual(await selected(),['frame_matte','title_cinema']);
   assert.match(await page.locator('#shop .sv3-checkout-info').innerText(),/25/);
   await page.keyboard.press('Escape');
   assert.equal(await bar.getAttribute('aria-expanded'),'false','Escape closes the nonmodal mobile sheet');
   await bar.click();
   await page.locator('#shop [data-v3-reset]').click();
   await search.fill('Дождь в комментариях');
   await page.locator('#shop [data-v3-try="plate_rain"]').click();
   assert.equal(await page.locator('#sv7CommentPreview').isVisible(),true);
   await page.locator('#shop [data-v3-reset]').click();
   await search.fill('Дождь на обложке');
   await page.locator('#shop [data-v3-try="overlay_rain"]').click();
   assert.equal(await page.locator('#sv7ProfilePreview').isVisible(),true);
   await page.locator('#shop [data-v3-reset]').click();
   await search.fill('Реакции «Кино»');
   await page.locator('#shop [data-v3-try="reaction_cinema"]').click();
   assert.equal(await page.locator('#sv7ReactionPreview').isVisible(),true);
   assert.equal(await page.locator('#sv7ProfilePreview').isVisible(),false);
   await page.locator('#shop [data-v3-reset]').click();
   assert.equal(await fitting.isVisible(),false);
   assert.deepEqual(attemptedMutations,[],'The guest smoke test never attempts a paid or inventory mutation');
   assert.deepEqual(nativeDialogs,[],'Product UI must not use browser alert/confirm/prompt');
   console.log('PASS Komi Shop V7 guest desktop + mobile: 148 discoverable products, 24-item pages, seven collections, full-width filters, visible first products, unclipped cards, exclusive avatar fallback, nine SVG reactions, unobscured fitting scrollport, search, URL restoration, sorting and native confirmation cancellation; no purchase attempted');
 }finally{await context.close();await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
