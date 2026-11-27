'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
let chromium;try{({chromium}=require('playwright'));}catch{}
const source=path.resolve(__dirname,'..'),origin='http://localhost:8767';
const fixture='<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/komi-collection.css"><body style="background:#09090b"><main id="mainContainer"></main><script src="/komi-collection-art.js"></script><script src="/komi-collection.js"></script></body></html>';
const wanted={ghoul:['kaneki',18,'Бустер «Токийский гуль»'],jujutsu:['itadori',10,'Бустер «Печати проклятий»'],frieren:['frieren',10,'Бустер «Дневник пути»'],alchemist:['edward',10,'Бустер «Архив Аместриса»']};

test('four worlds: separate album, full-body view, one-time reveal and safe purchase', {skip:!chromium,timeout:55000},async()=>{
 const b=await chromium.launch({headless:true,executablePath:process.env.KOMI_CHROMIUM||undefined});
 try{for(const width of [1440,390,320]){
  const p=await b.newPage({viewport:{width,height:850},reducedMotion:width===320?'reduce':'no-preference'}),errors=[];
  p.on('pageerror',err=>errors.push(err.message));
  await p.route('**/*',async r=>{
   const u=new URL(r.request().url()),f=u.pathname.slice(1);
   if(u.origin!==origin)return r.abort();
   if(f==='collection')return r.fulfill({contentType:'text/html',body:fixture});
   if(!/^(?:komi-collection(?:-art)?\.(?:js|css)|assets\/collection\/(?:ghoul-cel|ghoul-booster|deluxe-packs|jujutsu|frieren|alchemist)\/(?:locked\/)?[a-z0-9-]+\.(?:webp|svg))$/.test(f))return r.abort();
   const dest=path.join(source,f);
   if(!fs.existsSync(dest))return r.abort();
   return r.fulfill({path:dest,contentType:f.endsWith('.webp')?'image/webp':f.endsWith('.svg')?'image/svg+xml':f.endsWith('.css')?'text/css':'application/javascript'});
  });
  await p.goto(origin+'/collection');
  await p.evaluate(()=>{
   window.currentView='collection';window.currentUser={authUserId:'qa-a'};window.calls=[];window.holdSeries=null;
   window._supabase={
    auth:{getSession:async()=>({data:{session:{user:{id:window.currentUser?.authUserId}}}})},
    rpc:async(name,args)=>{
     window.calls.push({name,args,owner:window.currentUser?.authUserId});
     const series=args.p_series_id||'ghoul',first={ghoul:'kaneki',jujutsu:'itadori',frieren:'frieren',alchemist:'edward'}[series];
     if(series===window.holdSeries&&name.endsWith('_read')) await new Promise(resolve=>{window.finishHeld=resolve;});
     if(name==='komi_collection_series_buy')return {data:{owned:[first,'fern'],result:'fern',balance:0,price:50,purchase_status:'ok'}};
     return {data:{owned:window.currentUser?.authUserId==='qa-a'?[first]:[],balance:50,price:50,result:null}};
    }
   };
   window.KomiCollection.render(document.querySelector('#mainContainer'));
  });
  for(const [series,[id,size,title]] of Object.entries(wanted)){
   await p.locator('[data-kc-action="series-'+series+'"]').click();
   await p.waitForFunction(id=>document.querySelector('.kc-grid [data-kc-card="'+id+'"].kc-owned'),id);
   assert.equal(await p.locator('.kc-case').count(),0);
   const windows=p.locator('.kc-world-shelves .kc-world-window');
   assert.equal(await windows.count(),4);
   assert.equal(await windows.locator('.kc-shelf-hero[aria-hidden="true"]').count(),4);
   await p.waitForFunction(()=>[...document.querySelectorAll('.kc-shelf-hero')].every(img=>img.naturalWidth>0));
   assert.equal(await p.locator('.kc-world-window[aria-pressed=true]').getAttribute('data-kc-action'),'series-'+series);
   const motifs=await windows.locator('.kc-window-motif').evaluateAll(els=>els.map(el=>getComputedStyle(el).backgroundImage));
   assert.equal(new Set(motifs).size,4,'each world retains its own art effect when another is selected');
   assert.ok(await windows.evaluateAll(els=>els.every(el=>{const a=el.getBoundingClientRect(),b=el.querySelector('.kc-window-copy').getBoundingClientRect();return b.left>=a.left&&b.right<=a.right+1&&b.bottom<=a.bottom+1;})),'world labels fit within windows');
   assert.ok(await windows.first().evaluate(el=>parseFloat(getComputedStyle(el).borderTopLeftRadius)>=18));
   assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   assert.ok(await p.locator('.kc-grid .kc-owned').first().evaluate(el=>!!el.style.getPropertyValue('--kc-character-fx')));
   assert.equal(await p.locator('.kc-grid .kc-locked[style*="--kc-character-fx"]').count(),0);
   await p.getByRole('button',{name:'Паки',exact:true}).click();
   assert.equal(await p.locator('.kc-case h2').textContent(),title);
   assert.equal(await p.locator('.kc-album,.kc-grid').count(),0);
   assert.equal(await p.locator('.kc-world-shelves .kc-pack-thumb').count(),4);
   await p.waitForFunction(()=>document.querySelector('.kc-feature-hero')?.naturalWidth>0);
   assert.ok(await p.locator('.kc-case').evaluate(el=>parseFloat(getComputedStyle(el).borderTopLeftRadius)>=20));
   if(series==='ghoul'&&(width===1440||width===390)){
    const out=path.join(source,'browser-test-results');fs.mkdirSync(out,{recursive:true});
    await p.locator('.kc-page').screenshot({path:path.join(out,'world-view-pack-'+width+'.png'),animations:'disabled'});
   }
   if(series!=='ghoul')await p.waitForFunction(()=>document.querySelector('.kc-case-image')?.naturalWidth>0);
   await p.getByRole('button',{name:'Коллекции',exact:true}).click();
   assert.equal(await p.locator('.kc-album .kc-slot').count(),size);
   assert.equal(await p.locator('.kc-album .kc-slot:not(.kc-slot-owned) img[src*="/locked/"]').count(),size-1);
   assert.equal(await p.locator('.kc-grid .kc-locked .kc-view-hero').count(),0);

   const inspect=p.locator('.kc-grid [data-kc-card="'+id+'"] .kc-view-hero');
   await inspect.focus();
   await p.keyboard.press('Enter');
   const viewer=p.getByRole('dialog');
   await viewer.waitFor();
   await p.waitForFunction(()=>document.querySelector('.kc-hero-stage img')?.naturalHeight>document.querySelector('.kc-hero-stage img')?.naturalWidth);
   assert.equal(await viewer.locator('.kc-view-close').evaluate(el=>el===document.activeElement),true);
   assert.ok(await viewer.getByText('Фракция или роль').isVisible());
   await p.evaluate(()=>window.KomiCollection.render(document.querySelector('#mainContainer')));
   assert.ok(await viewer.isVisible());
   assert.equal(await viewer.locator('.kc-view-close').evaluate(el=>el===document.activeElement),true);
   assert.ok(await viewer.locator('.kc-rarity').isVisible());
   assert.equal(await viewer.locator('.kc-view-signature').isVisible(),width!==320);
   if(width!==320){await viewer.getByRole('button',{name:'Показать эффект'}).click();assert.equal(await viewer.locator('.kc-signature-play').count(),1);}
   assert.ok(await viewer.evaluate(el=>{const a=el.querySelector('.kc-hero-stage').getBoundingClientRect(),b=el.querySelector('.kc-hero-info').getBoundingClientRect();return innerWidth>650?a.right<=b.left+1:a.bottom<=b.top+1;}));
   assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   if((width===1440&&series==='ghoul')||(width===390&&series==='frieren')){
    const out=path.join(source,'browser-test-results');fs.mkdirSync(out,{recursive:true});
    await viewer.screenshot({path:path.join(out,'world-view-'+series+'-'+width+'.png'),animations:'disabled'});
   }
   await p.keyboard.press('Escape');await viewer.waitFor({state:'detached'});
   assert.equal(await inspect.evaluate(el=>el===document.activeElement),true);
  }
  await p.evaluate(()=>{window.holdSeries='jujutsu';});
  await p.locator('[data-kc-action="series-jujutsu"]').click();
  await p.waitForFunction(()=>typeof window.finishHeld==='function');
  await p.locator('[data-kc-action="series-frieren"]').click();
  await p.waitForFunction(()=>document.querySelector('.kc-grid [data-kc-card="frieren"].kc-owned'));
  await p.evaluate(()=>window.finishHeld());
  assert.equal(await p.locator('.kc-grid [data-kc-card="itadori"]').count(),0);
  await p.getByRole('button',{name:'Паки',exact:true}).click();
  const buy=p.getByRole('button',{name:'Купить за 50 AniCoin',exact:true});
  await buy.click();await p.getByRole('button',{name:'Отмена'}).click();
  assert.equal(await p.evaluate(()=>window.calls.filter(x=>x.name.endsWith('_buy')).length),0);
  await buy.click();await p.getByRole('button',{name:'Подтвердить · 50 AniCoin'}).click();
  if(width!==320){
   await p.getByRole('button',{name:'Показать результат'}).waitFor();
   assert.equal(await p.locator('[data-kc-action="series-ghoul"]').isDisabled(),true);
   assert.equal(await p.getByRole('button',{name:'Сорвать печать с бустера'}).count(),1);
   assert.equal(await p.locator('.kc-result').count(),0);
   await p.getByRole('button',{name:'Показать результат'}).click();
  }
  await p.waitForFunction(()=>document.querySelector('.kc-result h3')?.textContent==='Ферн');
  assert.equal(await p.locator('.kc-result .kc-signature-play').count(),width===320?0:1);
  const purchases=await p.evaluate(()=>window.calls.filter(x=>x.name.endsWith('_buy')));
  assert.equal(purchases.length,1);assert.equal(purchases[0].args.p_series_id,'frieren');
  assert.match(purchases[0].args.p_request_id,/^[0-9a-f-]+$/);
  await p.locator('.kc-result .kc-view-hero').click();
  await p.getByRole('dialog').waitFor();
  await p.evaluate(()=>{window.currentUser={authUserId:'qa-b'};window.KomiCollection.authChanged('qa-b');window.KomiCollection.render(document.querySelector('#mainContainer'));});
  assert.equal(await p.getByRole('dialog').count(),0);
  await p.getByRole('button',{name:'Коллекции',exact:true}).click();
  assert.equal(await p.locator('.kc-grid .kc-owned').count(),0);
  assert.deepEqual(errors,[]);
  await p.close();
 }}finally{await b.close();}
});
