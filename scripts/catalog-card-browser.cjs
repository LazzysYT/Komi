/* Catalog first paint and route interaction with a public-only local fixture. */
'use strict';
const assert=require('node:assert/strict');
const {createServer}=require('node:http');
const {readFile}=require('node:fs/promises');
const path=require('node:path');
const {chromium}=require('playwright');
const catalog=require('../api/catalog');
const root=path.resolve(__dirname,'..');
const rows=Array.from({length:55},(_,i)=>({shikimori_id:4001+i,data:{
  title:i===0?'Фильм для проверки':'Тестовый сериал '+i,
  year:2026,type:i===0?'movie':'tv',genres:[i===0?'Драма':'Комедия'],shikiRating:i===0?9.1:8,
  episodeCount:i===0?1:12,poster:''
}}));
const server=createServer(async (req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/catalog') {
    req.query=Object.fromEntries(url.searchParams);
    return catalog(req,res);
  }
  const file=path.resolve(root,'.'+(url.pathname==='/'||url.pathname.startsWith('/anime/')?'/index.html':url.pathname));
  if(!file.startsWith(root+path.sep)){res.writeHead(404).end();return;}
  const mime={'.html':'text/html','.css':'text/css','.js':'application/javascript','.svg':'image/svg+xml'}[path.extname(file)];
  try{res.setHeader('Content-Type',mime||'application/octet-stream');res.end(await readFile(file));}
  catch{res.writeHead(404).end();}
});
const style=node=>{
  const poster=node.querySelector('.komi-discovery-poster');
  const copy=node.querySelector('strong');
  const badge=node.querySelector('.komi-discovery-rating');
  return [getComputedStyle(poster).aspectRatio,getComputedStyle(poster).borderRadius,
    getComputedStyle(copy).fontSize,getComputedStyle(badge).borderRadius];
};
(async()=>{
 const realFetch=global.fetch;
 global.fetch=async url=>{
   assert.equal(new URL(url).pathname,'/rest/v1/komi_catalog_cards');
   return {ok:true,json:async()=>rows};
 };
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 let browser;
 try{
  browser=await chromium.launch({headless:true,...(process.env.KOMI_CHROME?{executablePath:process.env.KOMI_CHROME}:{})});
  for(const width of [320,390,1280]){
   const touch=width<768;
   const plain=await browser.newPage({javaScriptEnabled:false,viewport:{width,height:850}});
   await plain.route('https://**/*',r=>r.abort());
   await plain.goto(base);
   const homeStyle=await plain.locator('.komi-discovery-card').first().evaluate(style);
   assert.deepEqual(homeStyle,['2 / 3','16px','15px','999px']);
   await plain.goto(base+'/catalog');
   const stat=plain.locator('.komi-catalog-card').first();
   assert.deepEqual(await stat.evaluate(style),homeStyle);
   assert.equal(await stat.locator('small').textContent(),'2026 · Фильм · 1 сер.');
   assert.equal(await stat.locator('a').getAttribute('href'),'/anime/4001');
   await plain.close();
   const page=await browser.newPage({viewport:{width,height:850},hasTouch:touch,isMobile:touch});
   const errors=[];
   page.on('pageerror',err=>errors.push(err.message));
   await page.route('https://**/*',r=>r.abort());
   await page.goto(base+'/catalog',{waitUntil:'load'});
   await page.evaluate(data=>{
     animeList=data.map(({shikimori_id,data})=>({...data,id:String(shikimori_id)}));
     currentView='catalog';
     catalogInitialLoadComplete=true;
     catalogInitialLoadFailed=false;
     komiHomeCatalogReady=true;
     render();
     openWatchModal=id=>{window.__watchedCard=id;};
   },rows);
   const list=page.locator('#komiCatalogGrid > article');
   const first=list.first();
   assert.equal(await list.count(),touch?24:48);
   assert.deepEqual(await first.evaluate(style),homeStyle);
   assert.equal(await first.locator('small').textContent(),'2026 · Фильм · 1 сер.');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);
   const quick=first.getByRole('button',{name:/В список:/});
   const watch=first.getByRole('button',{name:/Смотреть:/});
   if (!touch) await first.hover();
   await quick.click();
   assert.equal(await quick.getAttribute('aria-expanded'),'true');
   if (!touch) {
     await page.mouse.move(0,0);
     assert.equal(await quick.evaluate(n=>getComputedStyle(n).opacity),'1','An open menu keeps its toggle visible');
   }
   await quick.click();
   assert.equal(await quick.getAttribute('aria-expanded'),'false');
   assert.equal(await first.getByRole('group',{name:/Выбрать статус/}).isVisible(),false);
   await page.mouse.move(0,0);
   if (!touch) {
     await page.waitForFunction(()=>[...document.querySelectorAll(
       '#komiCatalogGrid > article:first-child :is(.komi-card-quick-toggle,.komi-catalog-watch)'
     )].filter(n=>getComputedStyle(n).opacity==='0').length===2,null,{timeout:2000});
     for (const btn of [quick,watch])
       assert.equal(await btn.evaluate(n=>getComputedStyle(n).opacity),'0','Mouse focus must not pin the card actions');
   } else {
     assert.equal(await quick.evaluate(n=>getComputedStyle(n).opacity),'1','Touch users can reopen the menu without hover');
   }
   await first.locator('a').focus();
   await page.keyboard.press('Tab');
   assert.equal(await quick.evaluate(n=>document.activeElement===n&&n.matches(':focus-visible')),true);
   await page.waitForFunction(()=>{
     const el=document.activeElement;
     return el?.matches('.komi-card-quick-toggle')&&getComputedStyle(el).opacity==='1';
   },null,{timeout:2000});
   if (touch) assert.equal(await quick.evaluate(n=>getComputedStyle(n).opacity),'1');
   await quick.click();
   assert.equal(await quick.getAttribute('aria-expanded'),'true');
   const menu=first.getByRole('group',{name:/Выбрать статус/});
   assert.equal(await menu.isVisible(),true);
   const rects=await first.evaluate(n=>{
     const card=n.getBoundingClientRect(),menu=n.querySelector('.komi-card-quick-menu').getBoundingClientRect();
     return menu.left>=card.left&&menu.right<=card.right;
   });
   assert.equal(rects,true);
   await page.keyboard.press('Escape');
   assert.equal(await quick.getAttribute('aria-expanded'),'false');
   await quick.click();
   await menu.getByRole('button',{name:'В планах'}).click();
   assert.equal(await page.locator('#authModal').evaluate(n=>n.classList.contains('active')),true);
   assert.equal(await page.evaluate(()=>window.__watchedCard),undefined);
   await page.evaluate(()=>closeAuthModal());
   await first.locator('a').focus();
   await first.getByRole('button',{name:/Смотреть:/}).press('Enter');
   assert.equal(await page.evaluate(()=>window.__watchedCard),'4001');
   await first.evaluate(n=>{n.dataset.testInitial='kept'});
   await page.getByRole('button',{name:/Показать ещё/}).click();
   assert.equal(await list.count(),touch?48:55);
   assert.equal(await list.first().getAttribute('data-test-initial'),'kept');
   await page.locator('#komiCatalogSearchInput').fill('Фильм для проверки');
   await page.waitForFunction(()=>document.querySelectorAll('#komiCatalogGrid > article').length===1);
   assert.deepEqual(await list.first().evaluate(style),homeStyle);
   await page.locator('#komiCatalogSearchInput').fill('ничего здесь не найдется');
   await page.waitForSelector('#komiCatalogGrid > .komi-catalog-empty');
   await page.getByRole('button',{name:'Сбросить фильтры',exact:true}).click();
   assert.equal(await list.count(),touch?24:48);
   await page.getByRole('button',{name:'Фильмы',exact:true}).click();
   assert.equal(await list.count(),1);
   assert.equal(await list.first().locator('a').getAttribute('href'),'/anime/4001');
   assert.deepEqual(errors,[]);
   if(process.env.KOMI_CAPTURE) await page.screenshot({path:process.env.KOMI_CAPTURE+'-'+width+'.png'});
   await page.close();
   console.log('PASS catalog first paint, home styles, watch, quick-list, filters and pagination at '+width+'px');
  }
 }finally{global.fetch=realFetch;await browser?.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1});
