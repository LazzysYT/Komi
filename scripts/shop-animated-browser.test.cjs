/* Isolated browser fixture; no production purchases. */
'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),test=require('node:test');
const root=path.join(__dirname,'..'),origin='https://komianime.online',styles=['komi.production.css','komi-shop-v5.css','komi-shop-v6-goods.css','komi-living-profile.css'],scripts=['komi-shop-icons.js','komi-shop-reactions.js','komi-shop-catalog.js','komi-shop-v3.js','komi-premium-store.js'];
const html='<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width">'+styles.map(f=>'<link rel="stylesheet" href="/'+f+'">').join('')+'<body style="background:#09090b;color:#fff"><main id="mainContainer"></main>'+scripts.map(f=>'<script src="/'+f+'"></script>').join('')+'</body>';
test('animated shop: rarity, sets, dedicated slots and responsive layout',async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.KOMI_CHROMIUM||undefined});
 try{for(const width of [1440,390,320]){
  const page=await browser.newPage({viewport:{width,height:950},serviceWorkers:'block',reducedMotion:'reduce'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>{const u=new URL(route.request().url()),f=u.pathname.slice(1);if(u.origin!==origin)return route.abort();if(u.pathname==='/shop')return route.fulfill({contentType:'text/html',body:html});if(![...styles,...scripts].includes(f)&&!/^assets\/shop-frames-atelier\/[a-z-]+\.svg$/.test(f)&&!/^assets\/shop-title-(?:foil|cast)\/[a-z]+\.svg$/.test(f)&&!/^assets\/shop-(?:covers-atelier\/(?:motion\/)?|station\/)[a-z-]+\.svg$/.test(f))return route.abort();return route.fulfill({contentType:f.endsWith('.css')?'text/css':f.endsWith('.svg')?'image/svg+xml':'application/javascript',body:fs.readFileSync(path.join(root,f),'utf8')});});
  await page.goto(origin+'/shop');await page.evaluate(async()=>{window.currentView='shop';window.KomiPremium={idForUsername:()=> 'fixture'};await window.KomiShopCatalog.checkPricing({rpc:async name=>({data:name==='komi_shop_living_revision'?window.KomiShopCatalog.revision:name==='komi_shop_frame_atelier_revision'?window.KomiShopCatalog.frameAtelierRevision:window.KomiShopCatalog.animatedRevision})});window.renderAniCoinShop=()=>window.KomiShopV3.render(document.querySelector('#mainContainer'),{owner:'fixture',store:{owned:[],balance:500},displayName:'Komi'});window.renderAniCoinShop();});
  const shop=page.locator('#shop');assert.equal(await shop.locator('.sv-animated-set').count(),4);assert.equal(await shop.locator('[data-item-type="banner"]').count(),0);assert.equal(await shop.getByText('Обложки',{exact:true}).count(),0);
  await shop.locator('[data-animated-set="anime-ghoul"]').click();assert.deepEqual((await page.evaluate(()=>window.KomiShopV3.selected())).sort(),['frame_kakugan','name_crimson_reflection','title_one_eyed_king'].sort());
  assert.equal(await shop.getByText('Ауры персонажей',{exact:true}).count(),0);
  for(const id of ['aura_crimson','aura_starlight','commentfx_hype'])await page.evaluate(id=>window.KomiShopV3.tryItem(id),id);
  assert.equal((await page.evaluate(()=>window.KomiShopV3.selected())).length,4);
  assert.equal(await shop.locator('.sv3-fitting .komi-fx-commentfx-hype').count(),1);
  await shop.locator('[data-v7-preview="profile"]').click();
  assert.equal(await shop.locator('.sv3-fitting .sv-fx-preview-grid .sv-fx-sample').count(),0);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.evaluate(()=>{window.KomiShopV3.reset();});
  await page.evaluate(()=>{const profile=document.createElement('section');profile.id='profile';profile.dataset.profileUser='fixture';profile.innerHTML='<div class="profile-header-card"><div class="profile-avatar-frame"><div class="profile-avatar-box"></div></div><div class="profile-name-row"><h2 data-profile-field="display-name">Komi</h2></div></div>';document.querySelector('#mainContainer').replaceChildren(profile);window.KomiPremiumStore.setClient({from:()=>({select:()=>({limit:async()=>({data:[{user_id:"fixture",frame_id:"frame_kakugan",entry_id:"entry_moonrise",name_id:"name_glitch_motion"}]})})})});});
  await page.waitForFunction(()=>document.querySelector('.profile-avatar-frame').classList.contains('komi-store-frame-kakugan'));
  assert.equal(await page.locator('.komi-entry-flash').count(),0);
  assert.equal(await page.locator('.profile-avatar-frame').evaluate(n=>getComputedStyle(n,'::before').animationName),'none');
  assert.equal(await page.locator('.profile-avatar-frame').evaluate(n=>getComputedStyle(n,'::after').animationName),'none');
  await page.emulateMedia({reducedMotion:'no-preference'});
  assert.equal(await page.locator('.profile-avatar-frame').evaluate(n=>getComputedStyle(n,'::after').animationName),'komi-frame-kakugan');
  assert.equal(await page.locator('.profile-avatar-frame').evaluate(n=>getComputedStyle(n,'::after').pointerEvents),'none');
  const audit=await page.evaluate(async()=>{
    const ids=KomiShopCatalog.items.filter(p=>p.type==='frame');
    const mount=document.createElement('div');mount.className='sv3-fitting';document.body.append(mount);
    const failures=[],motions=new Set();
    for(const p of ids){
      const el=document.createElement('span');el.className='komi-coin-frame komi-store-'+p.frameClass;el.style.cssText='display:block;width:100px;height:100px';mount.append(el);
      const a=getComputedStyle(el,'::before'),b=getComputedStyle(el,'::after');motions.add(b.animationName);
      for(const style of [a,b]){const m=style.backgroundImage.match(/^url\(["']?(.*?)["']?\)$/);if(!m){failures.push(p.id+' missing art');continue;}const img=new Image();img.src=m[1];try{await img.decode();if(!img.naturalWidth)failures.push(p.id+' empty image');}catch{failures.push(p.id+' invalid SVG');}}
      if(b.animationName==='none'||b.pointerEvents!=='none')failures.push(p.id+' motion missing');
    }mount.remove();return {count:ids.length,failures,motions:motions.size};
  });
  assert.equal(audit.count,49);assert.deepEqual(audit.failures,[]);assert.ok(audit.motions>=10);
  assert.deepEqual(errors,[]);await page.close();
 }}finally{await browser.close();}
});

test('cover atelier: every banner decodes on desktop and mobile, motion is contextual',async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.KOMI_CHROMIUM||undefined});
 try{for(const width of [1440,390,320]){
  const page=await browser.newPage({viewport:{width,height:800},serviceWorkers:'block',reducedMotion:'reduce'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>{const u=new URL(route.request().url()),f=u.pathname.slice(1);if(u.origin!==origin)return route.abort();if(u.pathname==='/shop')return route.fulfill({contentType:'text/html',body:html});if(![...styles,...scripts].includes(f)&&!/^assets\/shop-(?:covers-atelier\/(?:motion\/)?|station\/)[a-z-]+\.svg$/.test(f))return route.abort();return route.fulfill({contentType:f.endsWith('.svg')?'image/svg+xml':f.endsWith('.css')?'text/css':'application/javascript',body:fs.readFileSync(path.join(root,f),'utf8')});});
  await page.goto(origin+'/shop');
  await page.evaluate(()=>{document.querySelector('#mainContainer').innerHTML='<section id="shop" class="komi-shop-studio"><div class="sv3-fitting"><div class="sv3-profile-cover"></div></div><div class="sv3-item"><div class="store-banner-swatch">KOMI</div></div></section><section id="profile" class="komi-profile-premium-mono"><div class="profile-header-card"><div class="profile-cover" data-profile-cover></div></div></section>';});
  for(const mode of ['reduce','no-preference']){
   await page.emulateMedia({reducedMotion:mode});
   const result=await page.evaluate(async mode=>{const products=KomiShopCatalog.items.filter(p=>p.type==='banner'),preview=document.querySelector('.sv3-profile-cover'),swatch=document.querySelector('.store-banner-swatch'),profile=document.querySelector('[data-profile-cover]'),failures=[];
    for(const p of products){preview.className='sv3-profile-cover komi-store-'+p.bannerClass;swatch.className='store-banner-swatch '+p.bannerClass;profile.className='profile-cover komi-store-'+p.bannerClass;
     for(const [n,pseudo,active] of [[preview,null,true],[swatch,null,false],[profile,'::after',true]]){const style=getComputedStyle(n,pseudo),match=style.backgroundImage.match(/url\(["']?(.*?)["']?\)/),expected=mode==='no-preference'&&active;if(!match){failures.push(p.id+' missing background '+n.className);continue;}if(match[1].includes('/motion/')!==expected)failures.push(p.id+' wrong motion '+n.className);const img=new Image();img.src=match[1];try{await img.decode();if(!img.naturalWidth)failures.push(p.id+' empty');}catch{failures.push(p.id+' decode error');}if(pseudo&&style.pointerEvents!=='none')failures.push(p.id+' intercepts input');}
    }return {count:products.length,failures};},mode);
   assert.equal(result.count,20);assert.deepEqual(result.failures,[]);
  }
  assert.deepEqual(errors,[]);await page.close();
 }}finally{await browser.close();}
});
