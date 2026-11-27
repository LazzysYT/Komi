'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
let chromium;try{({chromium}=require('playwright'));}catch{}
const source=path.resolve(__dirname,'..'),origin='http://localhost:8767';
const fixture='<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/komi-collection.css"><body style="background:#09090b"><main id="mainContainer"></main><script src="/komi-collection.js"></script></body></html>';
const motion={ghoul:'kc-pick-splash',jujutsu:'kc-pick-skew',frieren:'kc-pick-orbit',alchemist:'kc-pick-register',demon:'kc-pick-crest',aot:'kc-pick-gust'};
test('themed identical backs reveal one server-issued card without another purchase', {skip:!chromium,timeout:60000},async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.KOMI_CHROMIUM||undefined});
 try{for(const [width,reduced] of [[1440,false],[320,false],[320,true]]){
  const p=await browser.newPage({viewport:{width,height:820},reducedMotion:reduced?'reduce':'no-preference'}),errors=[];
  p.on('pageerror',err=>errors.push(err.message));
  await p.route('**/*',async route=>{
   const u=new URL(route.request().url()),f=u.pathname.slice(1);
   if(u.origin!==origin)return route.abort();
   if(f==='collection')return route.fulfill({contentType:'text/html',body:fixture});
   if(!/^(?:komi-collection\.(?:js|css)|assets\/collection\/[a-z0-9/-]+\.(?:webp|svg))$/.test(f))return route.abort();
   const target=path.join(source,f);
   if(!fs.existsSync(target))return route.abort();
   return route.fulfill({path:target,contentType:f.endsWith('.webp')?'image/webp':f.endsWith('.svg')?'image/svg+xml':f.endsWith('.css')?'text/css':'application/javascript'});
  });
  await p.goto(origin+'/collection');
  await p.evaluate(()=>{
   window.currentView='collection';window.currentUser={authUserId:'qa-a'};window.calls=[];window.owned={};
   window._supabase={
    auth:{getSession:async()=>({data:{session:{user:{id:window.currentUser?.authUserId}}}})},
    rpc:async(name,args)=>{
     window.calls.push({name,args,owner:window.currentUser?.authUserId});
     const series=args.p_series_id||'ghoul';
     const first=window.KomiCollection.seriesList[series].roster[0].id;
     const id=window.KomiCollection.seriesList[series].roster[1].id;
     const activeOwner=window.currentUser?.authUserId==='qa-a';
     if(name.endsWith('_buy_v2')){
      await new Promise(resolve=>{window.releaseCase=resolve;});
      window.owned[series]=id;
      return {data:{owned:[first,id],result:id,balance:100,price:50,purchase_status:'ok'}};
     }
     if(name==='komi_collection_journal_read')return {data:activeOwner&&window.owned[series]?[{character_id:id,opened_at:'2026-11-27T09:44:00Z'}]:[]};
     return {data:{owned:activeOwner?(window.owned[series]?[first,id]:[first]):[],result:null,balance:150,price:50}};
    }
   };
   window.KomiCollection.render(document.querySelector('#mainContainer'));
  });
  const keys=await p.evaluate(()=>Object.keys(window.KomiCollection.seriesList));
  assert.deepEqual(keys,Object.keys(motion));
  for(let i=0;i<keys.length;i++){
   const key=keys[i];assert.equal(await p.evaluate(k=>KomiCollection.seriesList[k].roster.length,key),20);
   const name=await p.evaluate(k=>window.KomiCollection.seriesList[k].roster[1].name,key);
   await p.locator('[data-kc-action="series-'+key+'"]').click();
   await p.locator('.kc-page.kc-theme-'+key).waitFor();
   await p.locator('.kc-notice').waitFor({state:'detached'});
   await p.locator('.kc-tabs [data-kc-action="cases"]').click();
   assert.equal(await p.locator('.kc-album').count(),0);
   await p.getByRole('button',{name:'Купить за 50 AniCoin',exact:true}).click();
   await p.getByRole('button',{name:'Подтвердить · 50 AniCoin'}).click();
   await p.waitForFunction(()=>typeof window.releaseCase==='function');
   assert.equal(await p.locator('.kc-pick-arena,.kc-result').count(),0);
   await p.evaluate(()=>{window.releaseCase();window.releaseCase=null;});
   const peel=p.getByRole('button',{name:'Сорвать печать с бустера'});
   await peel.waitFor();
   assert.equal(await peel.evaluate(el=>el===document.activeElement),true);
   await peel.press('Enter');
   const arena=p.locator('.kc-pick-arena[data-kc-pick-world="'+key+'"]');
   const options=arena.locator('.kc-pick-card');
   assert.equal(await options.count(),3);
   assert.equal(new Set(await arena.locator('.kc-pick-back').evaluateAll(els=>els.map(x=>x.outerHTML))).size,1);
   assert.equal(await arena.locator('img').count(),0);
   assert.ok((await arena.locator('.kc-pick-atmosphere path').first().getAttribute('d')).startsWith('M'));
   assert.equal(await options.first().evaluate(el=>el===document.activeElement),true);
   assert.equal(await p.locator('.kc-tabs [data-kc-action="collection"]').getAttribute('aria-disabled'),'true');
   assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   assert.ok(await options.first().evaluate(el=>{const r=el.getBoundingClientRect();return r.width>=44&&r.height>=44;}));
   const pos=i%3+1;
   await arena.getByRole('button',{name:'Открыть карточку '+pos+' из 3'}).press('Enter');
   if(!reduced){
    const chosen=arena.locator('.kc-pick-card.is-chosen');
    assert.equal(await chosen.getAttribute('data-kc-action'),'pick-card-'+pos);
    assert.equal(await arena.locator('.kc-pick-card .kc-pick-front').count(),1);
    assert.equal(await arena.locator('.kc-pick-strokes').evaluate(el=>getComputedStyle(el).animationName),motion[key]);
    assert.equal(await arena.locator('button:disabled').count(),3);
   }else assert.equal(await arena.count(),0);
   const reward=p.locator('.kc-result h3');
   await reward.waitFor();
   assert.equal(await reward.textContent(),name);
   assert.equal(await reward.evaluate(el=>el===document.activeElement),true);
   assert.equal(await p.evaluate(()=>window.calls.filter(x=>x.name.endsWith('_buy_v2')).length),i+1);
   assert.match(await p.locator('.kc-wallet').textContent(),/100 AniCoin/);
   await p.locator('.kc-result [data-kc-action="collection"]').click();
   assert.equal(await p.locator('.kc-case').count(),0);
   const extras=p.getByRole('button',{name:'Альбом и журнал'});
   if(await extras.getAttribute('aria-expanded')==='false')await extras.click();
   assert.ok(await p.locator('.kc-album').isVisible());
   await p.locator('[data-kc-action="journal"]').click();
   const replay=p.getByRole('button',{name:'Повторить сцену',exact:true});
   await replay.waitFor();
   await replay.click();
   await options.first().waitFor();
   assert.equal(await p.locator('.kc-result').count(),0,'the prior result cannot appear below a replay scene');
   await options.first().press('Escape');
   await reward.waitFor();
   assert.equal(await reward.textContent(),name);
   assert.equal(await p.evaluate(()=>window.calls.filter(x=>x.name.endsWith('_buy_v2')).length),i+1);
   await p.getByRole('button',{name:'К журналу',exact:true}).click();
  }
  await p.getByRole('button',{name:'Повторить сцену',exact:true}).click();
  await p.locator('.kc-pick-card').first().waitFor();
  await p.evaluate(()=>{window.currentUser={authUserId:'qa-b'};window.KomiCollection.authChanged('qa-b');window.KomiCollection.render(document.querySelector('#mainContainer'));});
  assert.equal(await p.locator('.kc-pick-panel,.kc-result').count(),0);
  assert.deepEqual(errors,[]);
  await p.close();
 }}finally{await browser.close();}
});
