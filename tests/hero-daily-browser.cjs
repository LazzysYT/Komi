'use strict';
const fs=require('node:fs'), path=require('node:path'), assert=require('node:assert/strict');
const {chromium}=require(process.env.KOMI_PLAYWRIGHT||'playwright');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
const app=read('app-main.js');
const runtime=app.slice(app.indexOf('const komiHeroTransitions'),app.indexOf('function updateProfileCollectionSearch'));
const names=['Re:Zero 4','ДжоДжо','Чёрный клевер 2','Блич','Фрирен 2'];
const ids=['61316','61469','61967','60636','59978'];
const shell='<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><div id="mainContainer"></div>';
const micro='<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720"><rect width="1280" height="720" fill="#43606f"/></svg>';
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.KOMI_CHROME?{executablePath:process.env.KOMI_CHROME}:{})});
 try{
  for(const [width,date,expected] of [[1280,'2026-11-25T21:00:00Z','61316'],[390,'2026-11-25T22:00:01Z','61469']]){
   const page=await browser.newPage({viewport:{width,height:850},reducedMotion:'reduce'});
   await page.clock.setFixedTime(new Date(date));
   let releaseNext, rejectThird;
   const gateNext=new Promise(resolve=>{releaseNext=resolve;});
   const gateThird=new Promise(resolve=>{rejectThird=resolve;});
   const keys=new Set();
   await page.route('**/*',async route=>{
    const url=new URL(route.request().url());
    if(url.host==='hero.test'&&url.pathname==='/')return route.fulfill({contentType:'text/html; charset=utf-8',body:shell});
    if(/^\/assets\/hero\/daily\/[1-9]\d{0,11}-[A-Za-z0-9]+\.webp$/.test(url.pathname)){
      keys.add(url.pathname);
      if(keys.size===2)await gateNext;
      else if(keys.size===3){await gateThird;return route.fulfill({status:404});}
    }
    return route.fulfill({contentType:'image/svg+xml',body:micro});
   });
   await page.goto('https://hero.test/');
   await page.addScriptTag({content:read('komi-home-boot.js')});
   await page.addScriptTag({content:read('home-discovery.js')});
   await page.addScriptTag({content:'let currentSlideIndex=0,slideInterval=null,komiHomeCatalogReady=true;window.KomiHeroArt={isPaused:()=>true};'+runtime});
   await page.evaluate(({ids,names})=>{
     const animeList=ids.map((id,i)=>({id,title:names[i],episodeCount:5,shikiRating:8,poster:'https://hero.test/old.jpg'}));
     document.querySelector('#mainContainer').innerHTML=KomiHomeDiscovery.render({animeList,currentSlideIndex:0,renderCard:()=>'',year:()=>2026,describe:()=>'',artwork:a=>a.poster});
     document.addEventListener('click',e=>{const t=e.target.closest('.hero-dot');if(t)setSlide([...t.parentElement.children].indexOf(t));});
   },{ids,names});
   const active=()=>page.locator('.hero-slide.active').evaluate(s=>({id:s.dataset.komiAnimeId,link:s.querySelector('.komi-hub-play').getAttribute('href'),image:s.querySelector('img').currentSrc}));
   const first=await active();
   assert.equal(first.id,expected);
   assert.equal(first.link,'/anime/'+expected+'#player');
   await page.getByRole('button',{name:'Показать слайд 2',exact:true}).click();
   await page.waitForFunction(()=>document.querySelectorAll('.hero-slide')[1].querySelector('img').getAttribute('src').startsWith('/assets/hero/daily/'));
   assert.equal((await active()).id,expected,'the title does not change during the image delay');
   releaseNext();
   await page.waitForFunction(()=>document.querySelectorAll('.hero-slide')[1].classList.contains('active'));
   const second=await active();
   assert.notEqual(second.id,first.id);
   assert.notEqual(second.image,first.image);
   assert.equal(second.link,'/anime/'+second.id+'#player');
   await page.getByRole('button',{name:'Показать слайд 3',exact:true}).click();
   rejectThird();
   await page.waitForFunction(()=>document.querySelectorAll('.hero-slide')[2].querySelector('img').complete);
   assert.equal((await active()).id,second.id,'a failed image leaves the last good frame and its route');
   await page.close();
  }
  console.log('PASS daily lead, delayed frame, failed frame and atomic watch links on desktop and mobile');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
