'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
let chromium;try{({chromium}=require('playwright'));}catch{}
const source=path.resolve(__dirname,'..'),origin='http://localhost:8767';
const fixture='<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/komi-collection.css"><body style="background:#09090b"><main id="mainContainer"></main><script src="/komi-collection-art.js"></script><script src="/komi-collection.js"></script></body></html>';

test('album search: opened names only, rarity, IME, reset, jump and safe owner change', {skip:!chromium,timeout:25000},async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.KOMI_CHROMIUM||undefined});
 try{for(const width of [1440,320]){
  const page=await browser.newPage({viewport:{width,height:867},reducedMotion:'reduce'}),errors=[];
  page.on('pageerror',err=>errors.push(err.message));
  await page.route('**/*',async route=>{
   const u=new URL(route.request().url()),f=u.pathname.slice(1);
   if(u.origin!==origin)return route.abort();
   if(f==='collection')return route.fulfill({contentType:'text/html',body:fixture});
   if(!/^(?:komi-collection(?:-art)?\.(?:js|css)|assets\/collection\/(?:ghoul-cel|ghoul-booster|jujutsu)\/(?:locked\/)?[a-z0-9-]+\.(?:webp|svg))$/.test(f))return route.abort();
   const target=path.join(source,f);
   if(!fs.existsSync(target))return route.abort();
   return route.fulfill({path:target,contentType:f.endsWith('.webp')?'image/webp':f.endsWith('.svg')?'image/svg+xml':f.endsWith('.css')?'text/css':'application/javascript'});
  });
  await page.goto(origin+'/collection');
  await page.evaluate(()=>{
   window.currentView='collection';window.currentUser={authUserId:'qa-a'};window.namesCalls=[];
   window._supabase={
    auth:{getSession:async()=>({data:{session:{user:{id:window.currentUser?.authUserId}}}})},
    rpc:async(name,args)=>{
     window.namesCalls.push([name,args]);
     const owned=args.p_series_id==='jujutsu'?['gojo']:window.currentUser?.authUserId==='qa-a'?['kaneki','arima','touka']:['hinami'];
     return {data:{owned,balance:50,price:50,result:null}};
    }
   };
   window.KomiCollection.render(document.querySelector('#mainContainer'));
  });
  const query=page.getByRole('searchbox',{name:'Имя персонажа'}),rarity=page.getByLabel('Редкость',{exact:true});
  const slots=page.locator('.kc-album .kc-slot'),result=page.locator('#kc-album-results');
  const cards=result.locator('.kc-card'),count=page.locator('[data-kc-result-count]');
  const clear=page.getByRole('button',{name:'Очистить поиск'}),reset=page.getByRole('button',{name:'Сбросить фильтры'});
  await page.waitForFunction(()=>document.querySelectorAll('.kc-grid .kc-owned').length===3);
  assert.equal(await slots.count(),18);
  assert.equal(await count.textContent(),'Найдено: 18');
  assert.equal(await clear.isVisible(),false);

  await query.fill('  АРИМА   КИСЕ ');
  assert.equal(await cards.count(),1);
  assert.match(await cards.first().getAttribute('aria-label'),/Кисё Арима/);
  assert.equal(await count.textContent(),'Найдено: 1');
  await query.fill('хИНАМИ');
  assert.equal(await cards.count(),0);
  assert.equal(await count.textContent(),'Найдено: 0');
  assert.match(await result.textContent(),/Среди открытых карточек совпадений нет/);
  assert.equal(await page.getByText('Хинами Фуэгути',{exact:true}).count(),0);
  await query.fill('hinami');
  assert.equal(await cards.count(),0);
  await clear.click();
  assert.equal(await query.inputValue(),'');
  assert.equal(await query.evaluate(el=>el===document.activeElement),true);
  assert.equal(await cards.count(),18);
  await rarity.selectOption('rare');
  assert.equal(await cards.count(),5);
  assert.equal(await result.locator('.kc-locked.kc-tier-rare').count(),5);
  assert.ok((await cards.evaluateAll(els=>els.map(el=>el.getAttribute('aria-label')))).every(label=>label.includes('Неизвестный персонаж')));
  assert.equal(await slots.count(),18,'rarity does not change numbered jump index');
  await query.fill('канэки');assert.equal(await cards.count(),0);
  await query.press('Escape');assert.equal(await query.inputValue(),'');assert.equal(await cards.count(),5);assert.equal(await rarity.inputValue(),'rare');
  await reset.click();
  assert.equal(await rarity.inputValue(),'all');assert.equal(await cards.count(),18);assert.equal(await query.evaluate(el=>el===document.activeElement),true);

  // Simulate IME input, including a request/re-render during composition.
  await query.evaluate(el=>{
   window.imeField=el;el.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));
   el.value='кан';el.dispatchEvent(new InputEvent('input',{bubbles:true,isComposing:true}));
   window.KomiCollection.render(document.querySelector('#mainContainer'));
  });
  assert.equal(await query.evaluate(el=>window.imeField===el),true);
  assert.equal(await cards.count(),18);
  await query.evaluate(el=>{
   el.value='канэки';el.dispatchEvent(new CompositionEvent('compositionend',{data:'канэки',bubbles:true}));
  });
  assert.equal(await cards.count(),1);
  assert.equal(await query.evaluate(el=>el===document.activeElement),true);
  await query.fill('<script>alert("x")</script>');
  await page.evaluate(()=>window.KomiCollection.render(document.querySelector('#mainContainer')));
  assert.equal(await query.inputValue(),'<script>alert("x")</script>');
  assert.equal(await cards.count(),0);
  assert.equal(await page.locator('.kc-tools script').count(),0);

  await page.locator('[data-kc-action="slot-hinami"]').click();
  assert.equal(await query.inputValue(),'');
  assert.equal(await cards.count(),18);
  assert.equal(await result.locator('[data-kc-card="hinami"]').evaluate(el=>el===document.activeElement),true);
  await page.getByRole('button',{name:'Закрытые',exact:true}).click();
  assert.equal(await cards.count(),15);
  await page.locator('[data-kc-action="slot-kaneki"]').click();
  assert.equal(await cards.count(),18);
  assert.equal(await result.locator('[data-kc-card="kaneki"]').evaluate(el=>el===document.activeElement),true);

  await query.fill('канэки');
  await rarity.selectOption('legendary');
  await page.locator('[data-kc-action="series-jujutsu"]').click();
  await page.waitForFunction(()=>document.querySelector('.kc-grid [data-kc-card="gojo"].kc-owned'));
  assert.equal(await query.inputValue(),'');assert.equal(await rarity.inputValue(),'all');
  await query.fill('  ГОДЗЕ ');assert.equal(await cards.count(),1);
  await page.locator('[data-kc-action="series-ghoul"]').click();
  await page.waitForFunction(()=>document.querySelector('.kc-grid [data-kc-card="kaneki"].kc-owned'));
  await query.fill('КАНЭКИ');
  await rarity.selectOption('legendary');
  await page.evaluate(()=>{
   window.currentUser={authUserId:'qa-b'};
   window.KomiCollection.authChanged('qa-b');
   window.KomiCollection.render(document.querySelector('#mainContainer'));
  });
  await page.waitForFunction(()=>document.querySelector('.kc-grid [data-kc-card="hinami"].kc-owned'));
  assert.equal(await query.inputValue(),'');
  assert.equal(await rarity.inputValue(),'all');
  assert.equal(await result.getByText('Кэн Канэки',{exact:true}).count(),0);
  await query.fill('канэки');assert.equal(await cards.count(),0);
  await query.fill('хИНАМИ');assert.equal(await cards.count(),1);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  assert.ok(await query.evaluate(el=>el.offsetWidth>80));
  assert.deepEqual(errors,[]);
  assert.ok(await page.evaluate(()=>window.namesCalls.every(([name,args])=>!name.endsWith('_buy')&&(!args.p_action||args.p_action==='read'))));
  await page.close();
 }}finally{await browser.close();}
});
