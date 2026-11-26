/* Load the actual card renderer for all items; block all backend calls. */
'use strict';
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const origin='http://127.0.0.1:8767';
const assets=['komi.production.css','komi-shop-v5.css','komi-shop-v6-goods.css'];
const scripts=['komi-shop-icons.js','komi-shop-reactions.js','komi-shop-catalog.js','komi-shop-v3.js'];
const html='<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">'+assets.map(x=>'<link rel="stylesheet" href="/'+x+'">').join('')+'</head><body style="background:#09090b;color:#fff"><main style="width:min(1440px,100%);margin:auto" id="mainContainer"></main>'+scripts.map(x=>'<script src="/'+x+'"></script>').join('')+'</body></html>';
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.KOMI_CHROMIUM||undefined});
 try{
  for(const width of [1680,1440,768,390,320]){
   const page=await browser.newPage({viewport:{width,height:1050},reducedMotion:'reduce'});
   page.setDefaultTimeout(6500);
   await page.route('**/*',route=>{
    const url=new URL(route.request().url());
    if(url.origin!==origin)return route.abort();
    if(url.pathname==='/shop')return route.fulfill({contentType:'text/html',body:html});
    const name=url.pathname.slice(1);
    if(!assets.includes(name)&&!scripts.includes(name))return route.abort();
    return route.fulfill({contentType:name.endsWith('.css')?'text/css':'application/javascript',body:fs.readFileSync(path.join(__dirname,'..',name),'utf8')});
   });
   await page.goto(origin+'/shop?shop_page=6');
   const info=await page.evaluate(()=>{
     window.currentView='shop';
     const render=()=>window.KomiShopV3.render(document.getElementById('mainContainer'),{owner:'',store:null,displayName:'Гость'});
     window.renderAniCoinShop=render;render();
     const cards=[...document.querySelectorAll('.sv3-item')],items=window.KomiShopCatalog.items;
     const errors=[];
     for(const c of cards){
       const get=selector=>c.querySelector(selector);
       const b=selector=>get(selector).getBoundingClientRect();
       const within=(inner,outer)=>inner.left>=outer.left-1&&inner.right<=outer.right+1&&inner.top>=outer.top-1&&inner.bottom<=outer.bottom+1;
       const a=b('.sv3-item-scene'),p=b('.sv9-plate'),cta=b('.sv7-try-label');
       const art=get('.sv9-plate').firstElementChild.getBoundingClientRect();
       const id=c.dataset.itemId;
       if(!within(p,a)||p.bottom>cta.top+1||!within(art,p)||!p.width||!p.height)errors.push('geometry:'+id+':'+JSON.stringify({p:p.toJSON(),art:art.toJSON(),cta:cta.toJSON()}));
       const title=get('.sv3-item-copy h3');
       const desc=get('.sv7-item-description');
       if(title.scrollHeight>title.clientHeight+1||desc.scrollHeight>desc.clientHeight+1)errors.push('text:'+id);
       if(!get('.sv7-item-kind').textContent.includes(' · '))errors.push('no context:'+id);
       if(Number(get('.sv3-unit-price strong').textContent.replace(/[^0-9]/g,''))!==items.find(i=>i.id===id).cost)errors.push('price:'+id);
     }
     if(document.documentElement.scrollWidth>innerWidth)errors.push('horizontal overflow');
     return {errors,count:cards.length,ids:new Set(cards.map(c=>c.dataset.itemId)).size,types:new Set(cards.map(c=>c.dataset.itemType)).size};
   });
   assert.deepEqual([info.count,info.ids,info.types],[142,142,13]);
   assert.equal(info.errors.length,0,width+': '+info.errors.slice(0,8).join('\n'));
   const tryButtons=page.locator('[data-v3-try]');
   if(width===1680){
    const output=process.env.KOMI_SHOP_OUTPUT;
    if(output){
     await page.setViewportSize({width,height:width===1680?2100:1400});
     const grid=await page.locator('.sv3-product-grid').boundingBox();
     const bottom=await page.locator('.sv3-item').nth(11).boundingBox();
     await page.screenshot({path:path.join(output,'KomiAnime-legacy-cards-desktop.png'),clip:{x:Math.floor(grid.x),y:Math.floor(grid.y),width:Math.floor(grid.width),height:Math.floor(bottom.y+bottom.height-grid.y)}});
    }
   }
   if(width===390){
    const output=process.env.KOMI_SHOP_OUTPUT;
    if(output){
     await page.setViewportSize({width,height:width===1680?2100:1400});
     const grid=await page.locator('.sv3-product-grid').boundingBox();
     const bottom=await page.locator('.sv3-item').nth(3).boundingBox();
     await page.screenshot({path:path.join(output,'KomiAnime-legacy-cards-mobile.png'),clip:{x:Math.floor(grid.x),y:Math.floor(grid.y),width:Math.floor(grid.width),height:Math.floor(bottom.y+bottom.height-grid.y)}});
    }
   }
   await tryButtons.first().focus();
   await page.keyboard.press('Enter');
   const id=await tryButtons.first().getAttribute('data-v3-try');
   assert.deepEqual(await page.evaluate(()=>window.KomiShopV3.selected()),[id]);
   assert.equal(await tryButtons.first().getAttribute('aria-pressed'),'true');
   assert.equal(await page.locator(`.sv3-item[data-item-id="${id}"] [data-shop-item-action]`).textContent(),'Только примерка');
   console.log('PASS '+width+'px: 142 cards, 13 scene types and real prices, keyboard fitting, no writes');
   await page.close();
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
