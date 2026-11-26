/* Playwright: all requests are fulfilled from local sources or denied, and no actual purchase is made. */
'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const src=process.env.KOMI_LIVING_ASSETS||path.join(__dirname,'..');
const styles=['komi.production.css','profile-studio.css','komi-shop-v5.css','komi-shop-v6-goods.css','komi-living-profile.css'];
const scripts=['komi-shop-icons.js','komi-shop-reactions.js','komi-shop-catalog.js','profile-premium.js','komi-shop-v3.js','komi-premium-store.js'];
const pathname='/shop',origin='https://komianime.online',cart=['frame_ghoul_seal','name_mangaka_ink','xp_story_rhythm','showcase_personal_cinema'];
const profileRow={frame_id:cart[0],name_id:cart[1],xp_id:cart[2],showcase_id:cart[3],title_id:'title_cinema',user_id:'fixture'};
const html='<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width">'+styles.map(f=>'<link rel="stylesheet" href="/'+f+'">').join('')+'<body style="background:#09090b;color:#fff"><main id="mainContainer"></main>'+scripts.map(f=>'<script src="/'+f+'"></script>').join('')+'</body>';
const setup=()=>{ window.currentView='shop';window.KomiPremium={idForUsername:()=> 'fixture'};
 window.livingMocks=[];
 window.renderAniCoinShop=()=>window.KomiShopV3.render(document.querySelector('#mainContainer'),{owner:'fixture',store:{owned:[],balance:170},displayName:'Лунный мангака',favorites:[{title:'Сохранённое аниме',poster:'/anime-artwork.svg'}]});
 window.renderAniCoinShop();
 window.paintLivingProfile=(xp,level)=>{
   const profile=document.createElement('section');profile.id='profile';profile.dataset.profileUser='viewer';profile.className='komi-profile-premium-mono';
   profile.innerHTML='<div class="profile-header-card"><div class="profile-avatar-frame"><div class="profile-avatar-box"></div></div><div class="profile-name-row"><h2 data-profile-field="display-name">Лунный мангака</h2></div>'+window.KomiProfileUI.summary({xp,level})+'<section class="komi-shop-favorite-showcase" data-komi-shop-showcase hidden><h3>Топ избранного</h3><div class="komi-shop-favorite-list"><a data-komi-shop-favorite href="/anime/5114"><img src="/anime-artwork.svg" alt=""><span>Сохранённое аниме</span></a></div></section>';
   document.querySelector('#mainContainer').replaceChildren(profile);
 };
};
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.KOMI_CHROMIUM||undefined});
 try{
 for(const width of [1440,390,320]){
   const page=await browser.newPage({viewport:{width,height:950},serviceWorkers:'block'});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/*',route=>{
     const u=new URL(route.request().url()),f=u.pathname.slice(1);
     if(u.origin!==origin)return route.abort();
     if(u.pathname===pathname)return route.fulfill({contentType:'text/html',body:html});
     if(f==='anime-artwork.svg')return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 15"><rect width="10" height="15" fill="#964f52"/></svg>'});
     if(![...styles,...scripts].includes(f)&&!/^assets\/shop-title-(?:foil|cast)\/[a-z]+\.svg$/.test(f))return route.abort();
     return route.fulfill({contentType:f.endsWith('.svg')?'image/svg+xml':f.endsWith('.css')?'text/css':'application/javascript',body:fs.readFileSync(path.join(src,f),'utf8')});
   });
   await page.goto(origin+pathname);
   await page.evaluate(setup);
   const shop=page.locator('#shop');assert.equal(await shop.locator('.sv3-item').count(),24);
   for(const [i,id] of cart.entries()){
     const card=shop.locator('[data-item-id="'+id+'"]');
     assert.equal(await card.locator('.sv3-unit-price strong').textContent(),['30','25','25','40'][i]);
     await page.evaluate(id=>window.KomiShopV3.tryItem(id),id);
   }
   assert.equal(await shop.locator('.sv3-fitting .komi-cinema-poster b').textContent(),'Сохранённое аниме');
   assert.equal(await shop.locator('.sv3-fitting .komi-store-frame-ghoul-seal').count(),1);
   assert.equal(await shop.locator('.sv3-fitting .sv3-profile-name .komi-store-name-mangaka-ink').textContent(),'Лунный мангака');
   assert.equal(await shop.locator('.sv3-fitting .komi-store-xp-story-rhythm progress').evaluate(n=>n.value),65);
   assert.deepEqual((await page.evaluate(()=>window.KomiShopV3.selected())).sort(),[...cart].sort());
   await shop.locator('[data-v7-category-select]').selectOption('showcase');
   assert.equal(await shop.locator('.sv3-item').count(),1);
   assert.equal(await shop.locator('.sv3-item').getAttribute('data-item-id'),cart[3]);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   await page.evaluate(row=>{
     window.paintLivingProfile(200,8);
     window.KomiPremiumStore.setClient({from:()=>({select:()=>({limit:async()=>({data:[row]})})})});
   },profileRow);
   const track=page.locator('.profile-xp-progress-track');
   const showcase=page.locator('.komi-shop-favorite-showcase');
   await showcase.waitFor({state:'visible'});
   assert.equal(await showcase.locator('h3').textContent(),'Личный кинотеатр');
   const poster=showcase.locator('a');
   assert.equal(await poster.getAttribute('href'),'/anime/5114');
   await poster.focus();
   assert.equal(await poster.evaluate(n=>n.matches(':focus-visible')),true);
   await page.waitForFunction(()=>getComputedStyle(document.querySelector('[data-komi-shop-favorite]'),'::after').opacity==='1');
   assert.equal(await track.evaluate(n=>n.classList.contains('is-xp-gain')),false);
   await page.evaluate(()=>window.paintLivingProfile(325,8));
   assert.equal(await track.evaluate(n=>n.style.getPropertyValue('--komi-xp-gain-from')),'40%');
   assert.equal(await track.evaluate(n=>n.style.getPropertyValue('--komi-xp-gain-width')),'25%');
   assert.equal(await track.evaluate(n=>getComputedStyle(n,'::after').animationName),'komi-story-gain');
   await page.evaluate(()=>window.paintLivingProfile(0,9));
   assert.equal(await track.evaluate(n=>n.classList.contains('is-xp-level-up')),true);
   assert.equal(await track.evaluate(n=>getComputedStyle(n).animationName),'komi-story-level');
   await page.emulateMedia({reducedMotion:'reduce'});
   await page.evaluate(()=>window.paintLivingProfile(127,9));
   assert.equal(await track.evaluate(n=>n.classList.contains('is-xp-gain')),false);
   assert.equal(await page.locator('.komi-store-name-mangaka-ink').evaluate(n=>getComputedStyle(n).animationName),'none');
   assert.equal(await page.locator('.profile-avatar-frame').getAttribute('tabindex'),'0');
   assert.deepEqual(errors,[]);
   await page.close();
   console.log('PASS '+width+'px: four cards and combined fitting, category, actual profile renderer, XP delta/level, spotlight, reduced motion');
 }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
