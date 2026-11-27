'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
let chromium;try{({chromium}=require('playwright'));}catch{}
const root=path.resolve(__dirname,'..'),origin='http://localhost:8767';
const fixture='<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/komi-collection.css"><body style="background:#09090b"><main id="mainContainer"></main><script src="/komi-collection.js"></script></body></html>';
const locations={kaneki:'cafe',touka:'cafe',gojo:'metro',fushiguro:'shrine',frieren:'meadow',fern:'library',edward:'workshop',roy:'archive',tanjiro:'river',zenitsu:'rail',rengoku:'rail',mikasa:'roofs',levi:'roofs',eren:'roofs'};
const picks={ghoul:{kaneki:'crimson',touka:'ribbon'},jujutsu:{gojo:'circles',fushiguro:'shadow'},frieren:{frieren:'petals',fern:'circles'},alchemist:{edward:'circles',roy:'flame'},demon:{tanjiro:'water',zenitsu:'thunder',rengoku:'flame'},aot:{mikasa:'ribbon',levi:'wires',eren:'horizon'}};
test('owned heroes have individualized static/animated backgrounds; locked heroes disclose no motif', {skip:!chromium,timeout:45000}, async()=>{
 const b=await chromium.launch({headless:true,executablePath:process.env.KOMI_CHROMIUM||undefined});
 try{for(const [width,reduced] of [[1440,false],[390,true]]){
  const p=await b.newPage({viewport:{width,height:860},reducedMotion:reduced?'reduce':'no-preference'});
  p.setDefaultTimeout(4500);
  const errors=[];p.on('pageerror',x=>errors.push(x.message));
  await p.route('**/*',async r=>{
   const u=new URL(r.request().url()),f=u.pathname.slice(1);
   if(u.origin!==origin)return r.abort();
   if(f==='collection')return r.fulfill({contentType:'text/html',body:fixture});
   if(!/^(?:komi-collection\.(?:js|css)|assets\/collection\/[a-z0-9/-]+\.(?:webp|svg))$/.test(f))return r.abort();
   const target=path.join(root,f);
   if(!fs.existsSync(target))return r.abort();
   return r.fulfill({path:target,contentType:f.endsWith('.webp')?'image/webp':f.endsWith('.svg')?'image/svg+xml':f.endsWith('.css')?'text/css':'application/javascript'});
  });
  await p.goto(origin+'/collection');
  await p.evaluate(()=>{
   window.currentView='collection';window.currentUser={authUserId:'qa-only'};
   window._supabase={auth:{getSession:async()=>({data:{session:{user:{id:'qa-only'}}}})},rpc:async(name,args)=>{
    const set=KomiCollection.seriesList[args.p_series_id||'ghoul'];
    if(!['komi_collection_action','komi_collection_series_read'].includes(name))throw Error('Read only');
    return {data:{owned:set.roster.slice(0,-1).map(x=>x.id),balance:0,price:50}};
   }};KomiCollection.render(document.querySelector('main'));
  });
  for(const [series,characters] of Object.entries(picks)){
   await p.locator('[data-kc-action="series-'+series+'"]').click();
   await p.locator('.kc-grid .kc-owned').first().waitFor();
   assert.equal(await p.locator('.kc-grid .kc-owned[data-kc-scene]').count(),23);
   assert.equal(await p.locator('.kc-grid .kc-locked[data-kc-scene]').count(),0);
   assert.equal(await p.locator('.kc-grid .kc-scene,.kc-hero-view').count(),0);
   await p.mouse.move(width-1,0);
   const animations=await p.locator('.kc-grid .kc-owned .kc-art').evaluateAll(nodes=>nodes.map(n=>getComputedStyle(n,'::before').animationName));
   assert.ok(animations.every(a=>a==='none'));
   for(const [id,style] of Object.entries(characters)){
    const card=p.locator('.kc-grid [data-kc-card="'+id+'"]');
    assert.equal(await card.getAttribute('data-kc-scene'),style);
    await card.locator('.kc-view-hero').press('Enter');
    const dialog=p.getByRole('dialog'),stage=dialog.locator('.kc-hero-stage');
    assert.equal(await stage.getAttribute('data-kc-scene'),style);
    assert.equal(await stage.locator('.kc-scene').getAttribute('aria-hidden'),'true');
    assert.equal(await stage.locator('.kc-scene').evaluate(el=>getComputedStyle(el).pointerEvents),'none');
    const panorama=stage.locator('.kc-world-backdrop');
    assert.equal(await panorama.getAttribute('data-kc-location'),locations[id]);
    assert.ok(await panorama.locator('.kc-land-hero').getAttribute('d'));
    assert.ok(await panorama.locator('.kc-land-planes path').count()>0);
    assert.equal(await panorama.evaluate(n=>getComputedStyle(n).animationName),reduced?'none':'kc-location-open');
    await stage.locator('img').evaluate(async n=>{await n.decode();});
    const animation=()=>stage.locator('.kc-scene-wash').evaluate(n=>getComputedStyle(n).animationName);
    assert.equal(await animation(),reduced?'none':'kc-stage-wash');
    const replay=dialog.getByRole('button',{name:'Показать эффект'});
    assert.equal(await replay.isVisible(),!reduced);
    if(!reduced){await replay.press('Enter');assert.equal(await animation(),'kc-stage-wash');}
    assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    if(process.env.KOMI_SCENE_PREVIEWS&&((width===1440&&['kaneki','tanjiro','zenitsu'].includes(id))||(width===390&&id==='mikasa'))){
     const out=process.env.KOMI_SCENE_PREVIEWS;fs.mkdirSync(out,{recursive:true});
     await dialog.screenshot({path:path.join(out,'Komi-'+id+'-'+width+'.png'),animations:'disabled'});
    }
    await p.keyboard.press('Escape');await dialog.waitFor({state:'detached'});
    assert.equal(await card.locator('.kc-view-hero').evaluate(el=>document.activeElement===el),true);
    await card.evaluate(el=>document.activeElement.blur());
   }
  }
  assert.deepEqual(errors,[]);await p.close();
 }}finally{await b.close();}
});
