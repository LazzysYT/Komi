'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
let chromium;try{({chromium}=require('playwright'));}catch{}
const root=path.resolve(__dirname,'..'),origin='http://localhost:8767';
const fixture='<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/komi-collection.css"><link rel="stylesheet" href="/profile-studio.css"><body style="background:#09090b"><main id="mainContainer"></main><script src="/komi-collection-art.js"></script><script src="/komi-collection.js"></script><script src="/komi-collector-showcase.js"></script></body></html>';
async function route(p){
 await p.route('**/*',r=>{
  const u=new URL(r.request().url()),f=u.pathname.slice(1);
  if(u.origin!==origin)return r.abort();
  if(f==='collection')return r.fulfill({contentType:'text/html',body:fixture});
  if(!/^(?:komi-(?:collection(?:-art)?|collector-showcase)\.(?:js|css)|profile-studio\.css|assets\/collection\/(?:ghoul-cel|frieren|jujutsu|alchemist|deluxe-packs|ghoul-booster|deluxe-wallpapers|worlds)\/(?:locked\/)?[a-z0-9-]+\.(?:webp|svg))$/.test(f))return r.abort();
  return r.fulfill({path:path.join(root,f),contentType:f.endsWith('.webp')?'image/webp':f.endsWith('.svg')?'image/svg+xml':f.endsWith('.css')?'text/css':'application/javascript'});
 });
}
test('deluxe: progress, stamps, safe private repeat, actual PNG and full album finish', {skip:!chromium,timeout:32000},async()=>{
 const b=await chromium.launch({headless:true,executablePath:process.env.KOMI_CHROMIUM||undefined});
 try{for(const width of [390,1280]){
 const p=await b.newPage({viewport:{width,height:930},reducedMotion:width===390?'no-preference':'reduce'});await route(p);await p.goto(origin+'/collection');
 await p.evaluate(offer=>{
  window.currentView='collection';window.currentUser={authUserId:'qa-owner'};
  window.all=window.KomiCollection.seriesList.frieren.roster.map(x=>x.id);
  window.buys=0;window.saved=false;window.journalLoads=0;
  window._supabase={
   auth:{getSession:async()=>({data:{session:{user:{id:currentUser?.authUserId}}}})},
   rpc:async(name,args)=>{
    if(name==='komi_collection_journal_read'){journalLoads++;return {data:[{character_id:'fern',opened_at:'2026-11-26T04:03:02Z'},{character_id:'foreign',opened_at:'2026-11-26T01:00:00Z'}]};}
    const last=KomiCollection.seriesList.frieren.roster.at(-1);
    const slot={slot:1,rarity:last.rarity,available:true};
    if(name==='komi_collection_pack_open_v3')return {data:{owned:all.slice(0,-1),price:50,balance:50,offer_id:offer,pack_status:'ready',choices:[{slot:1,available:true}]}};
    if(name==='komi_collection_pack_claim_v3'){buys++;saved=true;return {data:{owned:all,price:50,balance:0,result:last.id,purchase_status:'ok',offer_id:offer,pack_status:'claimed',selected_slot:1,choices:[{...slot,available:false,id:last.id}]}};}
    return {data:{owned:args.p_series_id==='frieren'?(saved?all:all.slice(0,-1)):[],price:50,balance:saved?0:50}};
   }
  };window.KomiCollection.render(document.querySelector('#mainContainer'));
 },'10000000-0000-4000-8000-000000000001');
 await p.locator('[data-kc-action="series-frieren"]').click();
 const extras=p.getByRole('button',{name:'Альбом и журнал'});
 assert.equal(await extras.getAttribute('aria-expanded'),'false');
 await extras.click();
 await p.getByText('Осталось: 1 из 27 · 1 × 50 = 50 AniCoin.').waitFor();
 assert.ok(await p.getByText('Печать получена').count());
 assert.equal(await p.evaluate(()=>journalLoads),0);
 await p.getByRole('button',{name:'Посмотреть',exact:true}).click();
 const journal=p.getByRole('region',{name:'Личный журнал открытий'});
 await journal.getByText('Ферн',{exact:true}).waitFor();
 assert.equal(await journal.locator('li').count(),1);
 await journal.getByRole('button',{name:'Повторить сцену'}).click();
 await p.locator('.kc-pick-arena[data-kc-pick-world="frieren"]').waitFor();
 await p.getByRole('button',{name:'Показать результат'}).click();
 await p.locator('.kc-result h3').getByText('Ферн').waitFor();
 assert.equal(await p.evaluate(()=>buys),0);
 assert.equal(await p.locator('.kc-case,.kc-album').count(),0);
 await p.getByRole('button',{name:'К журналу'}).click();
 assert.equal(await extras.getAttribute('aria-expanded'),'true');
 assert.ok(await journal.isVisible());
 await p.locator('.kc-grid [data-kc-card="fern"] .kc-view-hero').click();
 const viewer=p.getByRole('dialog');
 const downloading=p.waitForEvent('download');
 await viewer.getByRole('button',{name:'Скачать постер'}).click();
 const d=await downloading;assert.equal(d.suggestedFilename(),'komianime-frieren-fern.png');
 const picture=fs.readFileSync(await d.path());
 assert.equal(picture.subarray(1,4).toString(),'PNG');
 assert.deepEqual([picture.readUInt32BE(16),picture.readUInt32BE(20)],[720,1000]);
 await viewer.getByRole('button',{name:'Закрыть просмотр'}).click();
 await p.getByRole('button',{name:'Открыть пак',exact:true}).click();
 if(width<=700)await p.locator('[data-kc-action=series-frieren]').click();
 await p.getByRole('button',{name:'Купить за 50 AniCoin',exact:true}).click();
 await p.getByRole('button',{name:'Подтвердить · 50 AniCoin'}).click();
 await p.getByRole('button',{name:'Сорвать печать с бустера'}).click();
 await p.getByRole('button',{name:/Открыть карточку 1 из 1/}).click();
 await p.getByRole('button',{name:'На место в альбоме',exact:true}).click();
 await p.getByRole('region',{name:'Серия собрана'}).waitFor();
 assert.equal(await p.locator('.kc-album-finale img').count(),27);
 assert.equal(await p.evaluate(()=>buys),1);
 assert.equal(await p.locator('.kc-album-finale').evaluate(el=>getComputedStyle(el).animationName),width===390?'kc-finale-open':'none');
 if(width===390)await p.locator('.kc-album-finale').screenshot({path:path.join(root,'browser-test-results','deluxe-finale.png'),animations:'disabled'});
 await p.evaluate(()=>window.KomiCollection.render(document.querySelector('#mainContainer')));
 assert.equal(await p.locator('.kc-album-finale').evaluate(el=>getComputedStyle(el).animationName),'none');
 await p.close();
 }}finally{await b.close();}
});
test('profile wallpaper shows only verified unlocked choices and can restore the saved banner', {skip:!chromium,timeout:13000},async()=>{
 const b=await chromium.launch({headless:true,executablePath:process.env.KOMI_CHROMIUM||undefined});
 try{
 const p=await b.newPage({viewport:{width:390,height:910}});await route(p);await p.goto(origin+'/collection');
 await p.evaluate(()=>{
  document.querySelector('main').innerHTML='<div class="profile-cover" style="height:160px"><img alt="Свой баннер"></div><section class="kcs-wallpaper" hidden></section>';
  window.opts={viewer:'a',getViewer:()=> 'a',username:'Owner',isMe:true,client:{
   auth:{getSession:async()=>({data:{session:{user:{id:'a'}}}})},
   rpc:async(name,args)=>({data:{series_id:name.endsWith('_set')?args.p_series_id:null,unlocked:['frieren','sololeveling']}})
  }};
  return window.KomiCollectorShowcase.mountWallpaper(document.querySelector('section'),document.querySelector('.profile-cover'),opts);
 });
 const select=p.getByLabel('Фон профиля');
 assert.deepEqual(await select.locator('option').allTextContents(),['Обычный фон','Карта пути','Двойное подземелье']);
 await select.selectOption('frieren');await p.getByRole('button',{name:'Применить'}).click();
 await p.getByText('Фон профиля обновлён.').waitFor();
 assert.equal(await p.locator('.profile-cover').getAttribute('data-kcs-wallpaper'),'frieren');
 assert.ok(await p.locator('.profile-cover img').isHidden());
 await select.selectOption('sololeveling');await p.getByRole('button',{name:'Применить'}).click();
 await p.waitForFunction(()=>document.querySelector('.profile-cover')?.dataset.kcsWallpaper==='sololeveling');
 assert.match(await p.locator('.profile-cover').evaluate(el=>getComputedStyle(el).backgroundImage),/deluxe-wallpapers\/sololeveling\.webp/);
 await p.locator('main').screenshot({path:path.join(root,'browser-test-results','deluxe-wallpaper.png')});
 await select.selectOption('');await p.getByRole('button',{name:'Применить'}).click();
 await p.getByText('Обычный фон восстановлен.').waitFor();
 assert.equal(await p.locator('.profile-cover').getAttribute('data-kcs-wallpaper'),null);
 assert.ok(await p.locator('.profile-cover img').isVisible());
 }finally{await b.close();}
});
