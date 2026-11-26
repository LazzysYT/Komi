/* Browser coverage for collection UI. Mock ownership only; never modifies production. */
'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
let chromium;
try{({chromium}=require('playwright'));}catch{}
const root=path.resolve(__dirname,'..'),origin='http://localhost:8767';
const assets=['komi-collection-art.js','komi-collection.js','komi-collection.css','assets/collection/tokyo-ghoul-case.webp','komi.production.css'];
const fixture='<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/komi.production.css"><link rel="stylesheet" href="/komi-collection.css"></head><body style="background:#09090b;color:white"><main id="mainContainer"></main><script src="/komi-collection-art.js"></script><script src="/komi-collection.js"></script></body></html>';
test('Tokyo Ghoul collection desktop and phone', {skip:!chromium,timeout:90000},async()=>{
 const b=await chromium.launch({headless:true,executablePath:process.env.KOMI_CHROMIUM||undefined});
 try{for(const width of [1440,768,390,320]){
 const p=await b.newPage({viewport:{width,height:1000}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.route('**/*',r=>{const u=new URL(r.request().url()),f=u.pathname.slice(1);if(u.origin!==origin)return r.abort();if(u.pathname==='/collection')return r.fulfill({contentType:'text/html',body:fixture});if(!assets.includes(f))return r.abort();return r.fulfill({contentType:f.endsWith('.webp')?'image/webp':f.endsWith('.css')?'text/css':'application/javascript',body:fs.readFileSync(path.join(root,f))});});
 await p.goto(origin+'/collection');await p.evaluate(()=>{window.currentView='collection';window.currentUser=null;window.openAuthModal=()=>{window.loginCalled=true};window.KomiCollection.render(document.querySelector('#mainContainer'));});
 assert.equal(await p.locator('.kc-grid .kc-card.kc-locked').count(),18);assert.equal(await p.locator('.kc-art img').count(),0);assert.equal(await p.locator('.kc-silhouette').count(),18);
 await p.waitForFunction(()=>document.querySelector('.kc-case-image')?.naturalWidth===500);
 assert.equal(await p.evaluate(()=>new Set([...document.querySelectorAll('.kc-silhouette')].map(e=>e.innerHTML)).size),18);
 assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'horizontal overflow at '+width);
 await p.getByRole('button',{name:'Кейсы',exact:true}).click();assert.equal(await p.locator('.kc-case h2').textContent(),'Кейс «Токийский гуль»');await p.locator('.kc-case').getByRole('button',{name:'Купить за 50 AniCoin',exact:true}).click();assert.equal(await p.evaluate(()=>window.loginCalled),true);
 await p.evaluate(()=>{window.currentUser={authUserId:'qa-user-a'};window.openCalls=0;window.buyCalls=0;window._supabase={auth:{getSession:async()=>({data:{session:{user:{id:window.currentUser.authUserId}}}})},rpc:async(name,args)=>{if(name==='komi_collection_buy'){window.buyCalls++;return {data:{owned:['kaneki','touka'],can_open:false,result:'touka',next_at:'2099-01-01T00:00:00Z',balance:0,price:50,purchase_status:'ok'}}}if(args.p_action!=='read'){window.openCalls++;throw Error('Only read or paid buy allowed');}return {data:{owned:['kaneki'],can_open:false,balance:50,price:50}};}};window.KomiCollection.authChanged('qa-user-a');window.KomiCollection.render(document.querySelector('#mainContainer'));});
 await p.waitForFunction(()=>document.querySelector('.kc-wallet')?.textContent==='Баланс: 50 AniCoin');
 assert.equal(await p.locator('[data-kc-action="open"]').count(),0);assert.doesNotMatch(await p.locator('.kc-page').textContent(),/бесплатн|раз в день/i);assert.equal(await p.evaluate(()=>window.openCalls),0);
 await p.getByRole('button',{name:'Моя коллекция',exact:true}).click();assert.equal(await p.locator('.kc-grid .kc-locked').count(),17);
 await p.getByRole('button',{name:'Открытые',exact:true}).click();assert.equal(await p.locator('.kc-grid .kc-card').count(),1);
 await p.getByRole('button',{name:'Закрытые',exact:true}).click();assert.equal(await p.locator('.kc-grid .kc-card').count(),17);
 await p.getByRole('button',{name:'Все',exact:true}).click();
 await p.getByRole('button',{name:'Купить за 50 AniCoin',exact:true}).click();assert.equal(await p.evaluate(()=>window.buyCalls),0);
 await p.getByRole('button',{name:'Подтвердить · 50 AniCoin',exact:true}).click();await p.waitForFunction(()=>document.querySelector('.kc-result h3')?.textContent==='Тока Кирисима');assert.equal(await p.evaluate(()=>window.buyCalls),1);assert.equal(await p.getByRole('button',{name:'Купить за 50 AniCoin',exact:true}).isDisabled(),true);assert.equal(await p.locator('.kc-grid .kc-locked').count(),16);assert.match(await p.locator('.kc-wallet').textContent(),/Баланс: 0 AniCoin/);
 await p.evaluate(()=>{window.currentUser=null;window.KomiCollection.authChanged('');window.KomiCollection.render(document.querySelector('#mainContainer'));});assert.equal(await p.locator('.kc-grid .kc-locked').count(),18);assert.equal(await p.locator('.kc-result').count(),0);
 assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);fs.mkdirSync(path.join(root,'browser-test-results'),{recursive:true});await p.screenshot({path:path.join(root,'browser-test-results','collection-ghoul-'+width+'.png'),fullPage:true});await p.close();console.log('collection width '+width+' passed');
 }}finally{await b.close();}
});
