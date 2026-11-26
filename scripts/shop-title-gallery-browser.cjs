/* Actual title styles in shop, fitting and public profile; no real database or purchase. */
'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..');
const styles=['komi.production.css','komi-shop-v5.css','komi-shop-v6-goods.css'];
const scripts=['komi-shop-icons.js','komi-shop-reactions.js','komi-shop-catalog.js','komi-shop-v3.js','komi-premium-store.js'];
const origin='http://komi-titles.test';
const ids=['crimson_hunter','moon_ronin','yokai_whisper','awakening_mode','sakura_vow','last_cut'];
const output=process.env.KOMI_SHOP_OUTPUT;
const html='<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">'+styles.map(f=>'<link rel="stylesheet" href="/'+f+'">').join('')+'</head><body style="background:#09090b;color:#fff"><main id="mainContainer" style="max-width:1300px;margin:auto"></main>'+scripts.map(f=>'<script src="/'+f+'"></script>').join('')+'</body></html>';
(async()=>{
 const b=await chromium.launch({headless:true,executablePath:process.env.KOMI_CHROMIUM||undefined});
 try{
  for(const width of [1440,390,320]){
   const p=await b.newPage({viewport:{width,height:width===1440?1450:1020}});
   p.setDefaultTimeout(6500);
   await p.route('**/*',route=>{
    const u=new URL(route.request().url()),f=u.pathname.slice(1);
    if(u.origin!==origin)return route.abort();
    if(u.pathname==='/shop')return route.fulfill({contentType:'text/html',body:html});
    if(![...styles,...scripts].includes(f)&&!/^assets\/shop-title-foil\/[a-z]+\.svg$/.test(f)&&!/^assets\/shop-station\/[a-z-]+\.svg$/.test(f))return route.abort();
    return route.fulfill({contentType:f.endsWith('.svg')?'image/svg+xml':f.endsWith('.css')?'text/css':'application/javascript',body:fs.readFileSync(path.join(root,f),'utf8')});
   });
   await p.goto(origin+'/shop?shop_category=frame&shop_collection=station-0017&shop_page=2');
   await p.evaluate(()=>{
     window.currentView='shop';
     const render=()=>window.KomiShopV3.render(document.querySelector('#mainContainer'),{owner:'demo',store:{owned:['frame_pixel','banner_last_train','title_cinema','plate_manga'],balance:150,frame_id:'frame_pixel'},displayName:'Гость'});
     window.renderAniCoinShop=render;render();
   });
   const count=await p.locator('.sv3-item').count();assert.equal(count,34);
   const out=await p.evaluate(()=>{
     const nodes=[...document.querySelectorAll('.sv3-item [data-komi-title-id]')];
     return {ids:nodes.map(el=>el.dataset.komiTitleId),errors:nodes.filter(n=>{
        const r=n.getBoundingClientRect(),container=n.closest('.sv9-plate').getBoundingClientRect();
        return n.scrollWidth>n.clientWidth+1||!r.height||r.left<container.left-1||r.right>container.right+1||getComputedStyle(n,'::before').maskImage==='none';
     }).map(n=>n.dataset.komiTitleId),wide:document.documentElement.scrollWidth};
   });
   assert.deepEqual(out.ids.slice(0,6).sort(),ids.map(id=>'title_'+id).sort());
   assert.deepEqual(out.errors,[]);assert.ok(out.wide<=width);
   const chip=p.locator('.sv3-item [data-komi-title-id="title_crimson_hunter"]');
   const getStyle=()=>chip.evaluate(n=>{const s=getComputedStyle(n,'::after');return [s.animationName,s.animationPlayState,s.backgroundPosition];});
   assert.deepEqual((await getStyle()).slice(0,2),['komi-foil-scarlet','paused']);
   const treatments={title_moon_ronin:'blade',title_yokai_whisper:'yokai',title_awakening_mode:'ember',title_sakura_vow:'petals'};
   for(const [id,name] of Object.entries(treatments)){
     const key=await p.locator('.sv3-item [data-komi-title-id="'+id+'"]').evaluate(n=>getComputedStyle(n,'::after').animationName);
     assert.equal(key,'komi-foil-'+name);
   }
   assert.equal(await p.locator('[data-v7-category-select]').count(),0);
   assert.equal(await p.locator('.sv3-item:not([data-item-type="title"])').count(),0);
   assert.equal(await p.locator('.sv10-station,.sv7-starter,.sv7-collections').count(),0);
   await chip.hover();
   assert.equal((await getStyle())[1],'running');
   const before=(await getStyle())[2];
   await p.waitForFunction(before=>getComputedStyle(document.querySelector('.sv3-item [data-komi-title-id="title_crimson_hunter"]'),'::after').backgroundPosition!==before,before);
   if(output&&width===1440){
     const grid=await p.locator('.sv3-product-grid').boundingBox(),last=await p.locator('.sv3-item').nth(5).boundingBox();
     await p.screenshot({path:path.join(output,'KomiAnime-title-gallery.png'),clip:{x:Math.floor(grid.x),y:Math.floor(grid.y),width:Math.floor(grid.width),height:Math.floor(last.y+last.height-grid.y)}});
     if(process.env.KOMI_FOIL_FRAMES){
       const frameDir=process.env.KOMI_FOIL_FRAMES;fs.mkdirSync(frameDir,{recursive:true});
       const top=await p.locator('.sv3-item').first().boundingBox();
       const previewStyle=await p.addStyleTag({content:'#shop.komi-shop-studio .sv3-item [data-komi-title-id]::after{animation-play-state:paused!important;animation-delay:var(--film-time)!important;animation-duration:5.7s!important}'});
       for(let f=0;f<43;f++){
         await p.evaluate(f=>document.querySelector('#shop').style.setProperty('--film-time',(-f/10-.4)+'s'),f);
         await p.screenshot({path:path.join(frameDir,'frame-'+String(f).padStart(3,'0')+'.png'),clip:{x:Math.floor(grid.x),y:Math.floor(top.y),width:Math.floor(grid.width),height:195}});
       }
       await previewStyle.evaluate(n=>n.remove());
     }

   }
   await p.emulateMedia({reducedMotion:'reduce'});
   assert.equal((await getStyle())[0],'none');
   await p.locator('[data-v3-try="title_crimson_hunter"]').click();
   const fitting=p.locator('.sv3-fitting [data-komi-title-id="title_crimson_hunter"]');
   assert.equal(await fitting.count(),1);
   assert.deepEqual(await p.evaluate(()=>window.KomiShopV3.selected()),['title_crimson_hunter']);
   await p.evaluate(()=>window.KomiShopV3.tryItem('frame_halo'));
   assert.deepEqual(await p.evaluate(()=>window.KomiShopV3.selected()),['title_crimson_hunter']);
   await p.evaluate(()=>window.KomiShopV3.reset());
   await p.locator('[data-v7-view="owned"]').click();
   assert.deepEqual((await p.locator('.sv3-item').evaluateAll(nodes=>nodes.map(n=>n.dataset.itemId))).sort(),['banner_last_train','frame_pixel','plate_manga','title_cinema']);
   assert.equal(await p.locator('[data-item-id="frame_pixel"] [data-shop-item-action]').getAttribute('data-shop-operation'),'unequip');
   await p.locator('[data-v7-category-select]').selectOption('plate');
   assert.equal(await p.locator('.sv3-item').count(),1);
   await p.locator('[data-v3-try="plate_manga"]').click();
   await p.locator('#sv7CommentPreview').waitFor();
   await p.evaluate(()=>window.KomiShopV3.reset());
   await p.locator('[data-v7-view="catalog"]').click();
   assert.equal(await p.locator('.sv12-gallery').count(),1);
   assert.equal(await p.locator('.sv3-item').count(),24);
   assert.equal(await p.locator('.sv3-item:not([data-item-type="title"])').count(),0);
   await p.locator('.sv12-gallery [data-v3-try="title_moon_ronin"]').click();
   assert.deepEqual(await p.evaluate(()=>window.KomiShopV3.selected()),['title_moon_ronin']);
   await p.evaluate(()=>window.KomiShopV3.reset());
   await p.evaluate(()=>{
     window.fixtureConfirm=window.KomiShopV3.confirmPurchase({items:[window.KomiShopCatalog.find('title_moon_ronin')],total:25,balance:150,owner:'demo',action:'buy_equip'});
   });
   await p.locator('.sv7-purchase-dialog[open] [data-confirm-cancel]').waitFor();
   await p.keyboard.press('Escape');
   assert.equal(await p.evaluate(()=>window.fixtureConfirm),false);
   if(output&&width===390){
     await p.setViewportSize({width,height:1300});
     const hero=await p.locator('.sv12-gallery').boundingBox(),last=await p.locator('.sv3-item').nth(1).boundingBox();
     await p.screenshot({path:path.join(output,'KomiAnime-title-gallery-mobile.png'),clip:{x:Math.floor(hero.x),y:Math.floor(hero.y),width:Math.floor(hero.width),height:Math.floor(last.y+last.height-hero.y)}});
   }

   await p.evaluate(()=>{
    document.querySelector('#mainContainer').innerHTML='<section id="profile" data-profile-user="fixture"><div class="profile-name-row"></div></section>';
    window.KomiPremium={idForUsername:()=>'fixture'};
    window.KomiPremiumStore.setClient({from:()=>({select:()=>({limit:async()=>({data:[{user_id:'fixture',title_id:'title_yokai_whisper'}]})})})});
   });
   const profile=p.locator('#profile .komi-store-earned-title');
   await profile.waitFor();
   assert.equal(await profile.textContent(),'Шёпот ёкая');
   assert.equal(await profile.getAttribute('data-komi-title-id'),'title_yokai_whisper');
   console.log('PASS '+width+'px: title-only storefront, five distinct effects, reduced motion, preserved owned inventory');
   await p.close();
  }
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
