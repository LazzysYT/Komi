'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
let chromium;
try{({chromium}=require('playwright'));}catch{}
const source=path.resolve(__dirname,'..');
const origin='http://localhost:8767';
const offer='00000000-0000-4000-8000-000000000005';
const fixture='<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/komi-collection.css"><body style="background:#09090d"><main></main><script src="/komi-collection.js"></script></body></html>';

test('the server settles one selected slot and only then reveals five portraits', {skip:!chromium,timeout:70000},async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.KOMI_CHROMIUM||undefined});
 try{
  for(const [width,reduced] of [[1440,false],[320,false],[390,true]]){
   const p=await browser.newPage({viewport:{width,height:840},reducedMotion:reduced?'reduce':'no-preference'});
   const errors=[];
   p.on('pageerror',err=>errors.push(err.message));
   await p.route('**/*',async route=>{
    const u=new URL(route.request().url());
    if(u.origin==='https://fonts.googleapis.com'||u.origin==='https://fonts.gstatic.com')return route.continue();
    const f=u.pathname.slice(1);
    if(u.origin!==origin)return route.abort();
    if(f==='collection')return route.fulfill({contentType:'text/html',body:fixture});
    if(!/^(?:komi-collection\.(?:js|css)|assets\/collection\/[a-z0-9/-]+\.(?:webp|svg))$/.test(f))return route.abort();
    return route.fulfill({path:path.join(source,f),contentType:f.endsWith('.webp')?'image/webp':f.endsWith('.svg')?'image/svg+xml':f.endsWith('.css')?'text/css':'application/javascript'});
   });
   await p.goto(origin+'/collection');
   await p.evaluate(offer=>{
    window.currentView='collection';window.currentUser={authUserId:'qa-a'};
    window.calls=[];window.receipt=null;window.lost=false;
    const cards=KomiCollection.roster.slice(0,5);
    const choices=cards.map((card,index)=>({slot:index+1,available:true}));
    const base={owned:[],balance:100,price:50};
    window._supabase={
     auth:{getSession:async()=>({data:{session:{user:{id:'qa-a'}}}})},
     rpc:async(name,args)=>{
      calls.push({name,args});
      if(name.endsWith('_pack_open_v3'))return {data:receipt||{...base,pack_status:'ready',offer_id:offer,choices}};
      if(name.endsWith('_card_number'))return {data:{serial:712,issued:1500}};
      if(name.endsWith('_pack_claim_v3')){
       if(!receipt){
        const selected=cards[args.p_slot-1].id;
        window.receipt={...base,owned:[selected],balance:50,result:selected,purchase_status:'ok',
         pack_status:'claimed',offer_id:offer,selected_slot:args.p_slot,choices:choices.map((c,i)=>({...c,available:false,rarity:cards[i].rarity,id:cards[i].id}))};
       }
       if(!lost){
        window.lost=true;
        await new Promise(resolve=>{window.releaseClaim=resolve;});
        return {error:new Error('lost response')};
       }
       return {data:receipt};
      }
      return {data:base};
     }
    };
    KomiCollection.render(document.querySelector('main'));
   },offer);
   await p.getByRole('button',{name:'Открыть пак',exact:true}).click();
   if(width<=700)await p.locator('[data-kc-action=series-ghoul]').click();
   await p.getByRole('button',{name:'Купить за 50 AniCoin',exact:true}).click();
   await p.getByRole('button',{name:'Подтвердить · 50 AniCoin'}).click();
   await p.getByRole('button',{name:'Сорвать печать с бустера'}).press('Enter');
   const arena=p.locator('.kc-pick-arena');
   const dealing=arena.and(p.locator('.is-dealing'));
   if(!reduced){
    await dealing.waitFor();
    assert.equal(await dealing.locator('.kc-foil-table.is-tearing').count(),1);
    const entering=dealing.locator('.kc-pick-card:disabled');
    assert.equal(await entering.count(),5);
    assert.equal(await entering.first().evaluate(el=>getComputedStyle(el).animationName),'kc-deal-from-foil');
    assert.equal(await entering.first().evaluate(el=>getComputedStyle(el).animationDuration),'1.21s');
    assert.equal(await dealing.locator('.kc-pick-front,.kc-card-ambient').count(),0);
   }else assert.equal(await dealing.count(),0);
   await arena.locator('.kc-pick-card:not(:disabled)').first().waitFor();
   assert.equal(await arena.locator('.kc-pick-card:not(:disabled)').count(),5);
   assert.equal(await arena.locator('img').count(),0);
   assert.equal(await p.getByRole('button',{name:'Показать результат'}).count(),0);
   assert.equal(await p.evaluate(()=>calls.filter(call=>call.name.endsWith('_pack_claim_v3')).length),0);
   assert.equal(await arena.locator('[class*="kc-choice-"],.kc-pick-front,[class*="kc-tier-"]').count(),0);
   assert.deepEqual(await arena.locator('.kc-pick-card').evaluateAll(cards=>cards.map(card=>card.getAttribute('aria-label'))),
    [1,2,3,4,5].map(slot=>'Открыть карточку '+slot+' из 5'));
   assert.equal(await arena.locator('.kc-pick-back').evaluateAll(backs=>new Set(backs.map(back=>getComputedStyle(back).borderColor)).size),1);
   assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   const out=process.env.KOMI_PICK_PREVIEWS;
   if(out){
    fs.mkdirSync(out,{recursive:true});
    await arena.screenshot({path:path.join(out,'pack-'+width+'.png'),animations:'disabled'});
   }
   if(width===320){
    await p.getByRole('button',{name:'Закрыть пак'}).click();
    await p.getByRole('button',{name:'Продолжить открытие'}).click();
    await p.getByRole('button',{name:'Подтвердить · 50 AniCoin'}).click();
    await arena.waitFor();
    assert.equal(await arena.locator('.kc-pick-card:not(:disabled)').count(),5);
    assert.equal(await p.evaluate(()=>calls.filter(call=>call.name.endsWith('_pack_open_v3')).at(-1).args.p_offer_id),offer);
   }
   const fourth=arena.getByRole('button',{name:/Открыть карточку 4 из 5/});
   await fourth.press('Enter');
   await p.waitForFunction(()=>typeof releaseClaim==='function');
   assert.equal(await arena.locator('.kc-pick-card:disabled').count(),5);
   assert.equal(await arena.locator('img').count(),0);
   await p.evaluate(()=>releaseClaim());
   const retry=p.getByRole('button',{name:'Повторить сохранение'});
   await retry.waitFor();
   assert.equal(await arena.locator('.kc-pick-card:disabled').count(),5);
   await retry.press('Enter');
   if(!reduced){
    const reveal=p.locator('.kc-pick-arena.is-revealing');
    await reveal.waitFor();
    assert.equal(await reveal.locator('.kc-pick-front').count(),5);
    assert.equal(await reveal.locator('.kc-pick-front .kc-rarity,[class*="kc-choice-"]').count(),0);
    assert.equal(await reveal.locator('.kc-pick-front .kc-weather-flow').count(),5);
    assert.equal(await reveal.locator('.is-chosen').getAttribute('data-kc-action'),'pick-card-4');
    assert.equal(await reveal.locator('.kc-pick-card:disabled').count(),5);
    if(out&&width===1440){
     await p.waitForTimeout(850);
     await reveal.screenshot({path:path.join(out,'reveal-'+width+'.png')});
    }
   }
   const result=p.locator('.kc-result h3');
   await result.waitFor();
   assert.equal(await result.textContent(),'Ута');
   assert.equal(await result.evaluate(el=>document.activeElement===el),true);
   const claims=await p.evaluate(()=>calls.filter(call=>call.name.endsWith('_pack_claim_v3')).map(call=>call.args));
   assert.deepEqual(claims,[{p_offer_id:offer,p_slot:4},{p_offer_id:offer,p_slot:4}]);
   assert.match(await p.locator('.kc-wallet').textContent(),/Баланс: 50 AniCoin/);
   await p.getByRole('button',{name:'На место в альбоме',exact:true}).click();
   assert.equal(await p.locator('.kc-grid .kc-card').count(),1);
   await p.locator('.kc-grid .kc-view-hero').press('Enter');
   const viewer=p.getByRole('dialog');
   const control=viewer.locator('.kc-inspect-control');
   const frame=control.locator('.kc-inspect-frame');
   await viewer.getByText(/#0712 \/ 1\s500/).first().waitFor();
   assert.equal(await frame.locator(':scope > div').count(),4);
   assert.equal(await frame.evaluate(el=>getComputedStyle(el).transformStyle),'preserve-3d');
   if(!reduced){
    await control.press('ArrowRight');
    assert.equal(await frame.evaluate(el=>el.style.getPropertyValue('--kc-tilt-y')),'8deg');
    await viewer.getByRole('button',{name:'Сбросить поворот'}).click();
    assert.equal(await frame.evaluate(el=>el.style.getPropertyValue('--kc-tilt-y')),'0deg');
   }else assert.equal(await control.getAttribute('tabindex'),null);
   if(out)await viewer.screenshot({path:path.join(out,'inspect-'+width+'.png'),animations:'disabled'});
   await p.keyboard.press('Escape');
   assert.equal(await viewer.count(),0);
   assert.equal(await p.locator('.kc-grid .kc-view-hero').evaluate(el=>document.activeElement===el),true);
   assert.deepEqual(errors,[]);
   await p.close();
  }
 }finally{await browser.close();}
});
