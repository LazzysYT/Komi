'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
let chromium;
try{({chromium}=require('playwright'));}catch{}
const source=path.resolve(__dirname,'..'),origin='http://localhost:8767';
const fixture='<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/komi.production.css"><link rel="stylesheet" href="/komi-collection.css"><body style="background:#09090b"><main></main><script src="/komi-collection.js"></script></body></html>';

test('pack tile opens mobile details immediately, owns focus, and exposes only the right series', {skip:!chromium,timeout:35000},async()=>{
 const b=await chromium.launch({headless:true,executablePath:process.env.KOMI_CHROMIUM||undefined});
 try{
  const p=await b.newPage({viewport:{width:390,height:760},reducedMotion:'reduce'}),errors=[];
  p.on('pageerror',e=>errors.push(e.message));
  await p.route('**/*',r=>{
   const u=new URL(r.request().url()),file=u.pathname.slice(1);
   if(u.origin!==origin)return r.abort();
   if(file==='collection')return r.fulfill({contentType:'text/html',body:fixture});
   if(!/^(?:komi-collection\.(?:js|css)|komi\.production\.css|assets\/collection\/[a-z0-9/-]+\.(?:webp|svg))$/.test(file)||!fs.existsSync(path.join(source,file)))return r.abort();
   return r.fulfill({path:path.join(source,file)});
  });
  await p.goto(origin+'/collection');
  await p.evaluate(()=>{
   window.currentView='collection';window.currentUser={authUserId:'a'};window.calls=[];
   window._supabase={
    auth:{getSession:async()=>({data:{session:{user:{id:'a'}}}})},
    rpc:async(name,args)=>{
     window.calls.push({name,args});
     if(args.p_series_id==='onepiece'){
      await new Promise(resolve=>{window.resolveRead=resolve;});
      return {data:{owned:['luffy','nami'],balance:150,price:50}};
     }
     if(args.p_series_id==='chainsaw')return {data:{owned:[],balance:20,price:50}};
     return {data:{owned:[],balance:150,price:50}};
    }
   };
   KomiCollection.render(document.querySelector('main'));
  });
  await p.getByRole('button',{name:'Открыть пак',exact:true}).click();
  assert.equal(await p.getByRole('dialog').count(),0);
  assert.equal(await p.getByRole('button',{name:'Купить за 50 AniCoin',exact:true}).count(),0);
  assert.equal(await p.locator('.kc-grid,.kc-album-tools,.kc-shelf-hero').count(),0);
  const tile=p.locator('.kc-pack-shelves [data-kc-action=series-onepiece]');
  await tile.press('Enter');
  const sheet=p.getByRole('dialog',{name:'Капитанский журнал'});
  await sheet.waitFor();
  assert.equal(await sheet.evaluate(el=>el.matches(':modal')&&getComputedStyle(el).animationName==='none'),true);
  assert.equal(await sheet.locator('h2').evaluate(el=>document.activeElement===el),true);
  assert.equal(await tile.getAttribute('aria-pressed'),'true');
  const progress=sheet.getByRole('progressbar');
  assert.equal(await progress.getAttribute('aria-valuenow'),null,'unknown ownership never displays a fake count');
  await sheet.getByText('Проверяем коллекцию…').waitFor();
  await p.waitForFunction(()=>typeof resolveRead==='function');
  await p.evaluate(()=>resolveRead());
  await sheet.getByText('2 из 20').waitFor();
  await sheet.getByText('Одна новая карточка, без повторов').waitFor();
  assert.equal(await progress.getAttribute('aria-valuenow'),'2');
  assert.equal(await sheet.locator('h2').evaluate(el=>document.activeElement===el),true,'async data does not steal focus');
  assert.equal(await sheet.locator('.kc-case-image').evaluate(el=>el.getAttribute('src')),'/assets/collection/deluxe-packs/onepiece.webp');
  assert.equal(await sheet.locator('.kc-feature-hero').evaluate(el=>el.getAttribute('src')),'/assets/collection/onepiece/luffy.webp');
  assert.equal(await sheet.evaluate(el=>{const r=el.getBoundingClientRect();return r.bottom===innerHeight&&r.top>=0&&r.width<=innerWidth;}),true);
  const close=sheet.getByRole('button',{name:'Закрыть сведения о паке'});
  const buy=sheet.getByRole('button',{name:'Купить за 50 AniCoin',exact:true});
  await buy.focus();
  await p.keyboard.press('Tab');
  assert.equal(await p.evaluate(()=>!document.activeElement.closest('.kc-pack-shelves,.kc-tabs')),true,'Tab does not move behind the modal');
  await buy.press('Enter');
  assert.equal(await sheet.getByText('Выбери одну из доступных карт. Монеты спишутся после выбора.').isVisible(),true);
  await p.keyboard.press('Escape');
  assert.equal(await buy.evaluate(el=>document.activeElement===el),true,'first Escape cancels purchase without closing details');
  const output=process.env.KOMI_PACK_SHEET_PREVIEWS;
  await p.waitForFunction(()=>document.querySelector('.kc-pack-sheet .kc-feature-hero')?.naturalWidth>0);
  if(output){fs.mkdirSync(output,{recursive:true});await p.screenshot({path:path.join(output,'onepiece-mobile.png'),animations:'disabled'});}
  await p.keyboard.press('Escape');
  assert.equal(await p.getByRole('dialog').count(),0);
  assert.equal(await tile.evaluate(el=>document.activeElement===el),true);
  await tile.click();
  await close.click();
  assert.equal(await tile.evaluate(el=>document.activeElement===el),true);
  await tile.click();
  await p.mouse.click(4,4);
  assert.equal(await p.getByRole('dialog').count(),0);
  assert.equal(await tile.evaluate(el=>document.activeElement===el),true);
  await p.locator('.kc-pack-shelves [data-kc-action=series-chainsaw]').click();
  const chainsaw=p.getByRole('dialog',{name:'Кассета Бюро'});
  await chainsaw.getByText('Недостаточно AniCoin для покупки.').waitFor();
  assert.match(await chainsaw.locator('.kc-wallet').textContent(),/20 AniCoin/);
  assert.equal(await chainsaw.getByRole('button',{name:'Купить за 50 AniCoin'}).isDisabled(),true);
  await p.setViewportSize({width:1100,height:760});
  await p.waitForFunction(()=>document.querySelector('.kc-pack-inline:not([hidden])'));
  assert.equal(await p.getByRole('dialog').count(),0);
  assert.equal(await p.locator('.kc-pack-inline h2').textContent(),'Кассета Бюро');
  const shelf=p.locator('.kc-pack-shelves'),panel=p.locator('.kc-pack-inline');
  const s=await shelf.boundingBox(),detail=await panel.boundingBox();
  assert.ok(s.x+s.width<=detail.x&&Math.abs(s.y-detail.y)<2,'desktop details sit beside the shelf');
  if(output)await p.screenshot({path:path.join(output,'chainsaw-desktop.png'),animations:'disabled'});
  await p.getByRole('button',{name:'Все карты каталога',exact:true}).click();
  assert.equal(await p.locator('.kc-pack-browser,.kc-pack-sheet,.kc-case').count(),0);
  assert.ok(await p.locator('.kc-grid').isVisible());
  assert.equal(await p.evaluate(()=>calls.filter(c=>c.name.endsWith('_pack_open')||c.name.endsWith('_pack_claim')).length),0);
  assert.deepEqual(errors,[]);
 }finally{await b.close();}
});
