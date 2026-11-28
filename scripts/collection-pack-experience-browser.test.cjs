'use strict';

const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
let chromium;
try{({chromium}=require('playwright'));}catch{}
const source=path.resolve(__dirname,'..');
const origin='http://localhost:8767';
const preferences='komi.collection.pack-preferences';
const fixture='<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/komi-collection.css"><body style="background:#09090b"><main></main><script src="/komi-ui-sound.js"></script><script src="/komi-collection.js"></script></body></html>';

async function mount(page){
 await page.evaluate(()=>{
  window.currentView='collection';
  window.currentUser={authUserId:'pack-qa'};
  window.cues=[];
  const sound=window.KomiUISound;
  window.KomiUISound={playPackCue(...args){window.cues.push(args);sound.playPackCue(...args);}};
  const draw=CanvasRenderingContext2D.prototype.fillText;
  window.postcardText=[];
  CanvasRenderingContext2D.prototype.fillText=function(text,...args){window.postcardText.push(text);return draw.call(this,text,...args);};
  window.claims=0;
  let owned=['lawliet','misa','naomi'],balance=150,failNumber=true;
  const seed=['light','ryuk','rem','near','mello','matsuda','soichiro'];
  let offers=[],offerId;
  window._supabase={
   auth:{getSession:async()=>({data:{session:{user:{id:'pack-qa'}}}})},
   rpc:async(name,args)=>{
    if(name==='komi_collection_card_number'){
     if(failNumber){failNumber=false;return {error:{message:'Retry test'}};}
     return {data:{serial:17,issued:42}};
    }
    if(name==='komi_collection_pack_open_v3'){
     offers=seed.filter(id=>!owned.includes(id)).slice(0,5);
     offerId='00000000-0000-4000-8000-00000000000'+(window.claims+1);
     return {data:{owned,balance,price:50,offer_id:offerId,pack_status:'ready',choices:offers.map((_,index)=>({slot:index+1,available:true}))}};
    }
    if(name==='komi_collection_pack_claim_v3'){
     window.claims++;
     if(args.p_offer_id!==offerId)throw Error('Wrong pending offer');
     const id=offers[args.p_slot-1];
     owned=[...owned,id];balance-=50;
     const roster=KomiCollection.seriesList.deathnote.roster;
     return {data:{owned,balance,price:50,offer_id:offerId,pack_status:'claimed',purchase_status:'ok',result:id,selected_slot:args.p_slot,
      choices:offers.map((id,index)=>({id,rarity:roster.find(row=>row.id===id).rarity,slot:index+1,available:false}))}};
    }
    return {data:{owned:args.p_series_id==='deathnote'?owned:[],balance,price:50}};
   }
  };
  KomiCollection.render(document.querySelector('main'));
 });
}
test('the eight pack improvements work through the same server-confirmed choices', {skip:!chromium,timeout:75000}, async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.KOMI_CHROMIUM||undefined});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:860},acceptDownloads:true});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',route=>{
   const url=new URL(route.request().url()),file=url.pathname.slice(1);
   if(url.origin!==origin)return route.abort();
   if(file==='collection')return route.fulfill({contentType:'text/html',body:fixture});
   if(!/^(?:komi-(?:collection|ui-sound)\.(?:js|css)|assets\/collection\/[a-z0-9/-]+\.(?:webp|svg))$/.test(file))return route.abort();
   const type=file.endsWith('.webp')?'image/webp':file.endsWith('.svg')?'image/svg+xml':file.endsWith('.css')?'text/css':'application/javascript';
   return route.fulfill({path:path.join(source,file),contentType:type});
  });
  const out=process.env.KOMI_PACK_EXPERIENCE_PREVIEWS;
  if(out)fs.mkdirSync(out,{recursive:true});
  const preview=async(locator,name)=>{if(out)await locator.screenshot({path:path.join(out,name+'.png'),animations:'disabled'});};
  await page.goto(origin+'/collection');
  await mount(page);
  await page.getByRole('button',{name:'Открыть пак',exact:true}).click();
  await page.locator('.kc-pack-shelves [data-kc-action=series-deathnote]').click();
  const variant=page.getByLabel('Обёртка');
  const quick=page.getByRole('checkbox',{name:'Быстрое открытие'});
  assert.equal(await quick.count(),0);
  await variant.selectOption('envelope');
  await page.getByRole('img',{name:'Конверт с уликами'}).waitFor();
  const begin=async()=>{
   await page.getByRole('button',{name:'Купить за 50 AniCoin',exact:true}).click();
   await page.getByRole('button',{name:'Подтвердить · 50 AniCoin'}).click();
  };
  await begin();
  const foil=page.getByRole('button',{name:'Сорвать печать с бустера'});
  await foil.waitFor();
  assert.equal(await foil.locator('[data-kc-wrapper=envelope]').count(),2);
  await preview(foil,'envelope');
  const bounds=await foil.boundingBox();
  const x=bounds.x+bounds.width/2,y=bounds.y+60;
  await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+45,y,{steps:5});
  const before=await foil.locator('.kc-foil-shell').evaluate(el=>getComputedStyle(el).transform);
  assert.notEqual(before,'matrix(1, 0, 0, 1, 0, 0)');
  assert.ok(Number(await foil.evaluate(el=>el.style.getPropertyValue('--kc-peel-progress')))>.44);
  await page.mouse.up();
  await foil.waitFor();
  assert.equal(await foil.evaluate(el=>el.style.getPropertyValue('--kc-peel-progress')),'');
  await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+75,y,{steps:6});await page.mouse.up();
  await page.locator('.kc-pick-arena.is-dealing').waitFor();
  assert.equal(await page.locator('.is-dealing [data-kc-wrapper=envelope]').count(),2);
  const slot=page.getByRole('button',{name:'Открыть карточку 1 из 5',exact:true});
  await slot.and(page.locator(':enabled')).waitFor();
  await slot.press('Enter');
  const revealing=page.locator('.kc-real-pick.is-revealing');
  await revealing.waitFor();
  assert.equal(await revealing.locator('.kc-world-opening').count(),1);
  const delay=await revealing.locator('.is-chosen .kc-pick-turntable').evaluate(el=>parseFloat(getComputedStyle(el).animationDelay));
  assert.ok(delay>.40);
  assert.equal(await revealing.locator('.kc-rarity').count(),0);
  const result=page.locator('.kc-result');
  await result.getByRole('heading',{name:'Лайт Ягами'}).waitFor();
  assert.deepEqual(await page.evaluate(()=>[...new Set(cues.map(c=>c[0]))]),['deathnote']);
  assert.deepEqual(await page.evaluate(()=>[...new Set(cues.map(c=>c[1]))]),['crease','tear','place','flip']);
  assert.equal(await result.locator('.kc-result-pages').textContent(),'Дело Киры4 из 4✦ Страница собрана');
  await preview(result,'result');

  const postcard=result.getByRole('button',{name:'Скачать открытку'});
  await postcard.click();
  await result.getByText('Не удалось скачать открытку. Попробуй ещё раз.').waitFor();
  const [download]=await Promise.all([page.waitForEvent('download'),postcard.click()]);
  assert.equal(download.suggestedFilename(),'komianime-deathnote-light-postcard.png');
  const png=fs.readFileSync(await download.path());
  assert.deepEqual([png.readUInt32BE(16),png.readUInt32BE(20)],[720,1000]);
  assert.ok(await page.evaluate(()=>postcardText.some(text=>text.includes('#0017 / 42'))));
  if(out)fs.copyFileSync(await download.path(),path.join(out,'postcard.png'));
  await result.getByRole('button',{name:'На место в альбоме'}).click();
  const saved=page.locator('.kc-album [data-kc-action=slot-light]');
  await saved.and(page.locator('.kc-slot-settled')).waitFor();
  assert.equal(await saved.evaluate(el=>el===document.activeElement&&el.getBoundingClientRect().top>=0),true);
  assert.equal(await saved.locator('img[src*="/locked/"]').count(),1);
  await preview(page.locator('.kc-album'),'album');

  await page.getByRole('button',{name:'Перейти к пакам'}).click();
  await variant.selectOption('stamp');
  await page.getByRole('img',{name:'Печать «Дело Киры»'}).waitFor();
  await page.getByRole('checkbox',{name:'Звук открытия'}).uncheck();
  await quick.check();
  assert.deepEqual(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),preferences),
   {completed:true,quick:true,sound:false,wrappers:{deathnote:'stamp'}});
  const soundCount=await page.evaluate(()=>cues.length);
  await begin();
  await foil.press('Enter');
  await page.locator('.kc-quick-pick.is-dealing').waitFor();
  const duration=await page.locator('.kc-quick-pick.is-dealing .kc-pick-card').first().evaluate(el=>getComputedStyle(el).animationDuration);
  assert.equal(duration,'0.37s');
  await slot.and(page.locator(':enabled')).waitFor();
  await slot.press('Enter');
  await result.getByRole('heading',{name:'Рюк'}).waitFor();
  assert.equal(await page.evaluate(()=>cues.length),soundCount);
  assert.equal(await page.evaluate(()=>claims),2);
  assert.match(await page.locator('.kc-wallet').textContent(),/Баланс: 50 AniCoin/);
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
});
