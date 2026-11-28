/* Render shipping shop modules against local fixtures, with every real request blocked. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),test=require('node:test');
let chromium;try{({chromium}=require('playwright'));}catch{}
const root=path.join(__dirname,'..'),origin='https://komianime.online';
const styles=['komi.production.css','komi-shop-v5.css','komi-living-profile.css','komi-shop-v6-goods.css'];
const scripts=['komi-shop-icons.js','komi-shop-reactions.js','komi-shop-catalog.js','komi-shop-v3.js'];
const html='<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width">'+styles.map(f=>'<link rel="stylesheet" href="/'+f+'">').join('')+'<body class="komi-media-hub" style="background:#09090b;color:#fff"><main id="mainContainer"></main>'+scripts.map(f=>'<script src="/'+f+'"></script>').join('')+'</body>';

test('compact card actions fit a narrow two-column shop, preserve preview and show the usable set quote',{skip:!chromium,timeout:55000},async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.KOMI_CHROMIUM||undefined});
 try{
  for(const width of [1440,768,390,320]){
   const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce',serviceWorkers:'block'});
   page.setDefaultTimeout(5000);
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/*',route=>{
    const url=new URL(route.request().url()),file=url.pathname.slice(1);
    if(url.origin!==origin)return route.abort();
    if(url.pathname==='/shop')return route.fulfill({contentType:'text/html',body:html});
    if(![...styles,...scripts].includes(file)&&!/^assets\/shop-[a-z0-9-]+\/(?:[a-z0-9-]+\/)?[a-z0-9_-]+\.svg$/.test(file))return route.abort();
    const local=path.join(root,file);if(!fs.existsSync(local))return route.abort();
    return route.fulfill({contentType:file.endsWith('.svg')?'image/svg+xml':file.endsWith('.css')?'text/css':'application/javascript',body:fs.readFileSync(local,'utf8')});
   });
   await page.goto(origin+'/shop');
   await page.evaluate(async()=>{
    window.currentView='shop';
    const catalog=window.KomiShopCatalog;
    await catalog.checkPricing({rpc:async name=>({data:name==='komi_shop_living_revision'?catalog.revision:name==='komi_shop_frame_atelier_revision'?catalog.frameAtelierRevision:catalog.animatedRevision})});
    const ghoul=catalog.animatedSets.find(set=>set.id==='anime-ghoul');
    window.store={balance:500,owned:[],frame_id:null};
    window.ghoul=ghoul;
    window.renderAniCoinShop=()=>{
     window.KomiShopV3.render(document.getElementById('mainContainer'),{owner:'fixture',store:window.store,displayName:'Киноман'});
     // The real social module appends this third control to these same actions.
     for(const row of document.querySelectorAll('.sv3-item-actions')){
      const gift=document.createElement('button');gift.className='komi-shop-gift-button';gift.textContent='⊕';row.append(gift);
     }
    };
    window.renderAniCoinShop();
   });
   const geometry=await page.evaluate(()=>{
    const failures=[];
    for(const card of document.querySelectorAll('.sv3-item')){
     const box=selector=>card.querySelector(selector).getBoundingClientRect(), id=card.dataset.itemId;
     const art=box('.sv3-item-scene'),plate=box('.sv9-plate'),sample=card.querySelector('.sv9-plate').firstElementChild.getBoundingClientRect(),
      tryBtn=box('.sv15-preview-button'),buy=box('.sv3-primary-buy'),gift=box('.komi-shop-gift-button');
     if(art.height>146||tryBtn.height<44||buy.height<44||Math.abs(tryBtn.top-buy.top)>1||tryBtn.right>buy.left)failures.push(id+' actions');
     if(plate.top<art.top-1||plate.bottom>art.bottom+1||sample.top<plate.top-1||sample.bottom>plate.bottom+1)failures.push(id+' art '+JSON.stringify([art,plate,sample].map(n=>[n.top,n.height]))+' '+card.querySelector('.sv9-plate').firstElementChild.className);
     if(widthAtCard()&&gift.bottom>tryBtn.top)failures.push(id+' gift');
     function widthAtCard(){return innerWidth<=767;}
    }
    return {failures,scroll:document.documentElement.scrollWidth,viewport:innerWidth};
   });
   assert.deepEqual(geometry.failures,[],width+'px');
   assert.equal(geometry.scroll,geometry.viewport);
   const card=page.locator('.sv3-item').first();
   assert.match(await card.locator('.sv3-primary-buy').innerText(),/Купить ·\s+\d+ AC/);
   await card.locator('.sv15-preview-button').press('Enter');
   assert.equal(await card.locator('.sv15-preview-button').getAttribute('aria-pressed'),'true');
   await page.evaluate(()=>{
    window.store.owned=window.ghoul.items.slice(0,2);
    window.store.balance=KomiShopCatalog.find(window.ghoul.items[2]).cost;
    window.KomiShopV3.reset();
   });
   await page.locator('.sv14-filters summary').click();
   await page.locator('[data-v7-affordable]').check();
   assert.equal(await page.locator('[data-animated-set]').count(),1);
   assert.match(await page.locator('.sv15-set-quote').innerText(),/За недостающие: \d+ AniCoin\s+2 из 3 уже есть/);
   await page.locator('[data-animated-set="anime-ghoul"]').click();
   assert.deepEqual(await page.evaluate(()=>KomiShopV3.selected().sort()),await page.evaluate(()=>[...window.ghoul.items].sort()));
   assert.deepEqual(errors,[]);await page.close();
  }
 }finally{await browser.close();}
});
