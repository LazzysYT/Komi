'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
let chromium; try { ({ chromium } = require('playwright')); } catch {}
const root = path.join(__dirname, '..'), origin='https://komianime.online';
const styles=['komi.production.css','komi-shop-v5.css','komi-shop-v6-goods.css','komi-living-profile.css'];
const scripts=['komi-shop-icons.js','komi-shop-reactions.js','komi-shop-catalog.js','komi-shop-v3.js','komi-premium-store.js'];
const html='<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">'+styles.map(f=>'<link rel="stylesheet" href="/'+f+'">').join('')+'</head><body style="background:#09090b;color:#fff"><main id="mainContainer" style="max-width:1300px;margin:auto"></main>'+scripts.map(f=>'<script src="/'+f+'"></script>').join('')+'</body></html>';
test('shop: products first, accessible filters, current/trial comparison and no charge on cancel', {skip:!chromium,timeout:55000}, async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.KOMI_CHROMIUM||undefined});
 const output=process.env.KOMI_SHOP_OUTPUT;
 try {
 for(const width of [1440,390,320]){
  const page=await browser.newPage({viewport:{width,height:width===1440?900:844},reducedMotion:'reduce'});page.setDefaultTimeout(5000);
  const errors=[];page.on('pageerror',err=>errors.push(err.message));
  await page.route('**/*',async route=>{
   const request=route.request(),u=new URL(request.url()),f=u.pathname.slice(1);
   if(u.origin!==origin||request.method()!=='GET')return route.abort();
   if(u.pathname==='/shop')return route.fulfill({contentType:'text/html',body:html});
   if(!styles.includes(f)&&!scripts.includes(f)&&!/^assets\/shop-(?:title-(?:foil|cast)|station)\/[a-z-]+\.svg$/.test(f))return route.abort();
   return route.fulfill({path:path.join(root,f),contentType:f.endsWith('.svg')?'image/svg+xml':f.endsWith('.css')?'text/css':'application/javascript'});
  });
  await page.goto(origin+'/shop');
  await page.evaluate(async()=>{
   const cat=KomiShopCatalog;
   await cat.checkPricing({rpc:async()=>({data:cat.revision})});
   window.currentView='shop';window.debitCount=0;window.komiShopCheckoutCart=async()=>{debitCount++;throw Error('Unexpected test purchase');};
   window.shopCtx={owner:'test-user',displayName:'Пример Komi',store:{balance:150,title_id:'title_frieren_bloom',owned:['title_frieren_bloom','frame_pixel']}};
   window.renderAniCoinShop=()=>KomiShopV3.render(document.querySelector('main'),shopCtx);
   renderAniCoinShop();
  });
  const first=page.locator('.sv3-item').first();
  assert.equal(await page.locator('.sv3-fitting').isVisible(),false);
  assert.equal(await page.locator('.sv12-gallery').count(),0);
  assert.ok((await first.boundingBox()).y<390,'first products are above the fold at '+width);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  if(output&&width===1440)await page.screenshot({path:path.join(output,'Komi-Магазин-ПК.png')});
  if(output&&width===390)await page.screenshot({path:path.join(output,'Komi-Магазин-телефон.png')});
  const filters=page.locator('.sv14-filters'),sort=filters.getByLabel('Сортировка');
  assert.equal(await sort.isVisible(),false);
  await filters.locator('summary').press('Enter');
  assert.equal(await sort.isVisible(),true);
  await sort.selectOption('price-up');
  assert.equal(await sort.inputValue(),'price-up');
  assert.equal(await sort.isVisible(),true,'sort repaint keeps the filter disclosure open');
  assert.equal(new URL(page.url()).searchParams.get('shop_sort'),'price-up');
  await filters.locator('summary').click();
  assert.equal(await sort.isVisible(),false);
  // Repaint in the same task, before the browser can deliver the toggle event.
  await page.evaluate(()=>{
   const details=document.querySelector('.sv14-filters');
   details.open=true;window.renderAniCoinShop();
  });
  assert.equal(await sort.isVisible(),true,'same-task repaint keeps native open state');
  await page.evaluate(()=>{
   const details=document.querySelector('.sv14-filters');
   details.open=false;window.renderAniCoinShop();
  });
  assert.equal(await sort.isVisible(),false,'same-task repaint keeps native closed state');
  await page.getByText('Сбросить фильтры',{exact:true}).count().then(async n=>{if(n)await page.getByText('Сбросить фильтры',{exact:true}).click();});
  await filters.locator('summary').click();await sort.selectOption('default');await filters.locator('summary').click();
  await page.getByRole('button',{name:'Титулы',exact:true}).click();
  assert.equal(await page.locator('.sv12-gallery').isVisible(),true);
  assert.equal(await page.locator('.sv3-item:not([data-item-type=title])').count(),0);
  const item=page.locator('[data-item-id=title_gojo_infinity]');
  await item.locator('[data-v3-try]').click();
  const room=page.locator('.sv3-fitting');
  assert.equal(await room.isVisible(),true);
  assert.equal(await room.locator('#sv7ProfilePreview [data-komi-title-id]').getAttribute('data-komi-title-id'),'title_gojo_infinity');
  await room.getByRole('button',{name:'Сейчас',exact:true}).click();
  assert.equal(await room.locator('#sv7ProfilePreview [data-komi-title-id]').getAttribute('data-komi-title-id'),'title_frieren_bloom');
  assert.deepEqual(await page.evaluate(()=>KomiShopV3.selected()),['title_gojo_infinity']);
  await room.getByRole('button',{name:'С новым оформлением'}).click();
  assert.equal(await room.locator('#sv7ProfilePreview [data-komi-title-id]').getAttribute('data-komi-title-id'),'title_gojo_infinity');
  assert.equal(await room.getByText('К оплате',{exact:true}).isVisible(),true);
  if(output&&width===390)await page.screenshot({path:path.join(output,'Komi-Примерочная.png')});
  await room.locator('[data-v3-checkout]').click();
  const dialog=page.getByRole('dialog',{name:'Подтвердить покупку'});
  assert.equal(await dialog.isVisible(),true);await dialog.locator('[data-confirm-cancel]').click();
  assert.equal(await page.evaluate(()=>debitCount),0);
  const close=width<=980?room.locator('[data-v3-sheet]'):room.locator('[data-sv14-close]');
  await close.click();
  assert.equal(await room.locator('.sv3-fitting-body').isVisible(),false);
  assert.equal(await item.locator('[data-v3-try]').evaluate(node=>document.activeElement===node),true);
  await page.getByRole('button',{name:/Мои предметы/}).click();
  assert.equal(await page.locator('[data-item-id=frame_pixel]').count(),1);
  assert.deepEqual(errors,[]);
  await page.close();
 }
 }finally{await browser.close();}
});
