/* Browser coverage for collection UI. Mock ownership only; never modifies production. */
'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
let chromium;
try{({chromium}=require('playwright'));}catch{}
const root=path.resolve(__dirname,'..'),origin='http://localhost:8767';
const assets=['komi-collection-art.js','komi-collection.js','komi-collection.css','assets/collection/ghoul-booster/pack-320.webp','assets/collection/ghoul-booster/pack-640.webp','assets/collection/ghoul-booster/pack-fallback.svg','komi.production.css'];
const fixture='<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/komi.production.css"><link rel="stylesheet" href="/komi-collection.css"></head><body style="background:#09090b;color:white"><main id="mainContainer"></main><script src="/komi-collection-art.js"></script><script src="/komi-collection.js"></script></body></html>';
test('Tokyo Ghoul collection desktop and phone', {skip:!chromium,timeout:90000},async()=>{
 const b=await chromium.launch({headless:true,executablePath:process.env.KOMI_CHROMIUM||undefined});
 try{for(const width of [1440,1024,900,768,390,320]){
 const p=await b.newPage({viewport:{width,height:1000},reducedMotion:width===320?'reduce':'no-preference'}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.route('**/*',r=>{const u=new URL(r.request().url()),f=u.pathname.slice(1);if(u.origin!==origin)return r.abort();if(u.pathname==='/collection')return r.fulfill({contentType:'text/html',body:fixture});if(!assets.includes(f)&&!/^assets\/collection\/ghoul-noir\/(?:locked\/)?[a-z0-9-]+\.webp$/.test(f))return r.abort();return r.fulfill({contentType:f.endsWith('.webp')?'image/webp':f.endsWith('.svg')?'image/svg+xml':f.endsWith('.css')?'text/css':'application/javascript',body:fs.readFileSync(path.join(root,f))});});
 await p.goto(origin+'/collection');await p.evaluate(()=>{window.currentView='collection';window.currentUser=null;window.openAuthModal=()=>{window.loginCalled=true};window.KomiCollection.render(document.querySelector('#mainContainer'));});
 assert.equal(await p.locator('.kc-grid .kc-card.kc-locked').count(),18);assert.equal(await p.locator('.kc-art img[src*="/locked/"]').count(),18);assert.equal(await p.locator('.kc-art img:not([src*="/locked/"])').count(),0);assert.equal(await p.locator('.kc-silhouette').count(),18);assert.equal(await p.locator('.kc-grid .kc-rarity').count(),18);
 await p.waitForFunction(()=>document.querySelector('.kc-case-image')?.hasAttribute('data-kc-art-ready'));
 assert.match(await p.locator('.kc-case-image').evaluate(img=>img.currentSrc),/ghoul-booster\/pack-(320|640)\.webp$/);
 const lockedPortrait=p.locator('.kc-grid .kc-locked .kc-portrait').first();
 await lockedPortrait.scrollIntoViewIfNeeded();
 await p.waitForFunction(()=>document.querySelector('.kc-grid .kc-locked .kc-portrait')?.naturalWidth===240);
 assert.equal(await p.locator('.kc-grid .kc-locked strong').first().textContent(),'Неизвестный персонаж');
 assert.deepEqual(await lockedPortrait.evaluate(img=>{
  const canvas=document.createElement('canvas');canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;
  const context=canvas.getContext('2d');context.drawImage(img,0,0);
  const {data}=context.getImageData(0,0,canvas.width,canvas.height);
  let black=0,visible=0;for(let i=0;i<data.length;i+=4){if(data[i+3]>10){visible++;if(!(data[i]||data[i+1]||data[i+2]))black++;}}
  return {hasSilhouette:visible>15000&&visible<56000,allBlack:black===visible};
 }),{hasSilhouette:true,allBlack:true});
 assert.ok(await p.locator('.kc-grid .kc-card').first().evaluate(el=>{const r=el.getBoundingClientRect();return Math.abs(r.width/r.height-2/3)<.02;}),'card uses portrait 2:3 ratio');
 assert.ok(await p.locator('.kc-case-image').evaluate(el=>el.naturalHeight>el.naturalWidth),'pack has tall art');
 assert.equal(await p.evaluate(()=>new Set([...document.querySelectorAll('.kc-silhouette')].map(e=>e.innerHTML)).size),18);
 assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'horizontal overflow at '+width);
 assert.ok(await p.evaluate(()=>{const a=document.querySelector('.kc-case-visual').getBoundingClientRect(),b=document.querySelector('.kc-case-copy').getBoundingClientRect();return a.right<=b.left+1||a.bottom<=b.top+1;}),'case art overlaps text at '+width);
 await p.getByRole('button',{name:'Кейсы',exact:true}).click();assert.equal(await p.locator('.kc-case h2').textContent(),'Бустер «Токийский гуль»');await p.locator('.kc-case').getByRole('button',{name:'Купить за 50 AniCoin',exact:true}).click();assert.equal(await p.evaluate(()=>window.loginCalled),true);
 await p.evaluate(()=>{window.currentUser={authUserId:'qa-user-a'};window.openCalls=0;window.buyCalls=0;window._supabase={auth:{getSession:async()=>({data:{session:{user:{id:window.currentUser.authUserId}}}})},rpc:async(name,args)=>{if(name==='komi_collection_buy'){window.buyCalls++;return {data:{owned:['kaneki','touka'],can_open:false,result:'touka',next_at:'2099-01-01T00:00:00Z',balance:0,price:50,purchase_status:'ok'}}}if(args.p_action!=='read'){window.openCalls++;throw Error('Only read or paid buy allowed');}return {data:{owned:['kaneki'],can_open:false,balance:50,price:50}};}};window.KomiCollection.authChanged('qa-user-a');window.KomiCollection.render(document.querySelector('#mainContainer'));});
 await p.waitForFunction(()=>document.querySelector('.kc-wallet')?.textContent==='Баланс: 50 AniCoin');
 assert.equal(await p.locator('[data-kc-action="open"]').count(),0);assert.doesNotMatch(await p.locator('.kc-page').textContent(),/бесплатн|раз в день/i);assert.equal(await p.evaluate(()=>window.openCalls),0);
 await p.getByRole('button',{name:'Моя коллекция',exact:true}).click();assert.equal(await p.locator('.kc-grid .kc-locked').count(),17);
 await p.getByRole('button',{name:'Открытые',exact:true}).click();assert.equal(await p.locator('.kc-grid .kc-card').count(),1);
 const ownedPortrait=p.locator('.kc-grid .kc-portrait');
 assert.match(await ownedPortrait.getAttribute('src'),/ghoul-noir\/kaneki\.webp$/);
 await ownedPortrait.scrollIntoViewIfNeeded();
 await p.waitForFunction(()=>document.querySelector('.kc-grid .kc-portrait')?.naturalWidth===384);
 await p.getByRole('button',{name:'Закрытые',exact:true}).click();assert.equal(await p.locator('.kc-grid .kc-card').count(),17);
 await p.getByRole('button',{name:'Все',exact:true}).click();
 const buy=p.getByRole('button',{name:'Купить за 50 AniCoin',exact:true});
 const cancel=p.getByRole('button',{name:'Отмена',exact:true});
 const confirm=p.getByRole('button',{name:'Подтвердить · 50 AniCoin',exact:true});
 const focused=locator=>locator.evaluate(el=>el===document.activeElement);
 await buy.press('Enter');assert.equal(await focused(cancel),true);
 await p.keyboard.press('Escape');assert.equal(await focused(buy),true);
 assert.equal(await confirm.count(),0);
 await buy.click();await cancel.click();assert.equal(await focused(buy),true);
 assert.equal(await p.evaluate(()=>window.buyCalls),0,'cancel never purchases');
 await p.keyboard.press('Enter');await p.keyboard.press('Shift+Tab');assert.equal(await focused(confirm),true);
 await p.keyboard.press('Enter');
 if(width!==320){
  const skip=p.getByRole('button',{name:'Показать результат',exact:true});
  await skip.waitFor();assert.equal(await focused(skip),true);
  assert.equal(await p.locator('.kc-reel-tile').count(),29);
  assert.equal(await p.locator('.kc-reel-tile img[src*="/locked/"]').count(),29);
  assert.equal(await p.locator('.kc-reel-tile img:not([src*="/locked/"])').count(),0);
  assert.equal(await p.locator('.kc-result').count(),0);
  assert.equal(await p.locator('.kc-reel-tile').nth(23).locator('.kc-rarity').textContent(),'Эпический');
  assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  if(width===1024)await p.getByRole('button',{name:'Кейсы',exact:true}).focus(); // timer must not steal focus
  else if(width===390)await skip.click();
  else if(width!==1440)await p.keyboard.press('Enter');
 }
 const result=p.locator('.kc-result h3');
 await p.waitForFunction(()=>document.querySelector('.kc-result h3')?.textContent==='Тока Кирисима');
 if(width===1024)assert.equal(await focused(p.getByRole('button',{name:'Кейсы',exact:true})),true);
 else assert.equal(await focused(result),true,'result receives keyboard focus');
 assert.equal(await p.locator('.kc-reel-panel').count(),0);assert.equal(await p.evaluate(()=>window.buyCalls),1);assert.equal(await p.getByRole('button',{name:'Купить за 50 AniCoin',exact:true}).isDisabled(),true);assert.equal(await p.locator('.kc-grid .kc-locked').count(),16);assert.match(await p.locator('.kc-wallet').textContent(),/Баланс: 0 AniCoin/);
 assert.ok(await p.locator('.kc-grid .kc-card').evaluateAll(els=>els.every(el=>{
  const card=el.getBoundingClientRect(), info=el.querySelector('.kc-card-info').getBoundingClientRect();
  return info.top>card.top+card.height*.5 && info.bottom<card.bottom && el.scrollWidth<=el.clientWidth+1;
 })),'card captions fit portrait frames at '+width);
 if([1440,390].includes(width)){
   fs.mkdirSync(path.join(root,'browser-test-results'),{recursive:true});
   const capture=async(selector,name)=>{await p.locator(selector).scrollIntoViewIfNeeded();await p.locator(selector).screenshot({path:path.join(root,'browser-test-results','booster-'+name+'-'+width+'.png'),animations:'disabled'});};
   await capture('.kc-case','pack');
   if(width===390){await p.locator('.kc-page').scrollIntoViewIfNeeded(); await p.evaluate(()=>window.scrollTo(0,0));
    await p.screenshot({path:path.join(root,'browser-test-results','booster-page-390.png'),animations:'disabled'});
   }
   await p.locator('.kc-grid .kc-card').first().scrollIntoViewIfNeeded();
   await p.waitForFunction(()=>Array.from(document.querySelectorAll('.kc-grid .kc-portrait')).slice(0,2).every(i=>i.complete&&i.naturalWidth));
   const row=p.locator('.kc-grid .kc-card').first();
   await row.screenshot({path:path.join(root,'browser-test-results','booster-card-'+width+'.png'),animations:'disabled'});
   await capture('.kc-grid .kc-card.kc-locked >> nth=0','locked');
   if(width===1440){
    const grid=p.locator('.kc-grid');
    await grid.locator('.kc-card').first().scrollIntoViewIfNeeded();
    await p.waitForFunction(()=>Array.from(document.querySelectorAll('.kc-grid .kc-portrait')).slice(0,6).every(i=>i.complete&&i.naturalWidth));
    const gridRect=await grid.boundingBox(),cardRect=await grid.locator('.kc-card').first().boundingBox();
    await p.screenshot({path:path.join(root,'browser-test-results','booster-cards-desktop.png'),clip:{x:gridRect.x,y:cardRect.y,width:gridRect.width,height:cardRect.height},animations:'disabled'});
   }
 }
 await p.evaluate(()=>{window.currentUser=null;window.KomiCollection.authChanged('');window.KomiCollection.render(document.querySelector('#mainContainer'));});assert.equal(await p.locator('.kc-grid .kc-locked').count(),18);assert.equal(await p.locator('.kc-result').count(),0);
 assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);fs.mkdirSync(path.join(root,'browser-test-results'),{recursive:true});await p.screenshot({path:path.join(root,'browser-test-results','collection-ghoul-'+width+'.png'),fullPage:true});await p.close();console.log('collection width '+width+' passed');
 }}finally{await b.close();}
});

test('booster still shows a tall foil pack when both WebP sizes fail', {skip:!chromium,timeout:20000},async()=>{
 const b=await chromium.launch({headless:true,executablePath:process.env.KOMI_CHROMIUM||undefined});
 try{
  const p=await b.newPage({viewport:{width:390,height:844}});
  await p.route('**/*',r=>{
   const url=new URL(r.request().url()),f=url.pathname.slice(1);
   if(url.origin!==origin)return r.abort();
   if(f==='collection')return r.fulfill({contentType:'text/html',body:fixture});
   if(!assets.includes(f) || f.endsWith('.webp'))return r.abort();
   return r.fulfill({contentType:f.endsWith('.svg')?'image/svg+xml':f.endsWith('.css')?'text/css':'application/javascript',body:fs.readFileSync(path.join(root,f))});
  });
  await p.goto(origin+'/collection');
  await p.evaluate(()=>{window.currentView='collection';window.currentUser=null;window.KomiCollection.render(document.querySelector('#mainContainer'));});
  await p.waitForFunction(()=>{const i=document.querySelector('.kc-case-image');return i?.currentSrc.endsWith('/pack-fallback.svg')&&i.naturalHeight>i.naturalWidth&&!i.hidden;});
  assert.equal(await p.locator('.kc-case h2').textContent(),'Бустер «Токийский гуль»');
 }finally{await b.close();}
});
