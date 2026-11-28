'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
let chromium;try{({chromium}=require('playwright'))}catch{}
const root=path.resolve(__dirname,'..'),origin='http://localhost:8767';
const fixture='<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/profile-studio.css"><body style="background:#09090b"><main><section class="kcs-showcase" hidden></section></main><script src="/komi-collection.js"></script><script src="/komi-collector-showcase.js"></script></body></html>';
test('profile showcase shows explicit picks only, can hide them, guards stale owner and guest', {skip:!chromium,timeout:25000},async()=>{
 const b=await chromium.launch({headless:true,executablePath:process.env.KOMI_CHROMIUM||undefined});
 try{for(const width of [390,1280]){
 const p=await b.newPage({viewport:{width,height:860}});
 await p.route('**/*',r=>{
  const u=new URL(r.request().url()),f=u.pathname.slice(1);
  if(u.origin!==origin)return r.abort();
  if(f==='profile')return r.fulfill({contentType:'text/html',body:fixture});
  if(!/^(?:komi-(?:collection\.js|collector-showcase\.js)|profile-studio\.css|assets\/collection\/(?:ghoul-cel|frieren|jujutsu|alchemist|deathnote)\/[a-z0-9-]+\.webp)$/.test(f))return r.abort();
  return r.fulfill({path:path.join(root,f),contentType:f.endsWith('.webp')?'image/webp':f.endsWith('.css')?'text/css':'application/javascript'});
 });
 await p.goto(origin+'/profile');
 await p.evaluate(()=>{
   window.viewer='owner-a';window.chosen=[];window.calls=[];
   window.client={auth:{getSession:async()=>({data:{session:{user:{id:viewer}}}})},rpc:async(name,args)=>{
    calls.push([name,args]);
    if(name==='komi_collection_showcase_set'){chosen=args.p_cards;return {data:chosen}}
    if(name==='komi_collection_showcase_read_handle')return {data:args.p_username==='Visible'?chosen:[]};
    if(name==='komi_collection_showcase_read')return {data:chosen};
    if(name==='komi_collection_action')return {data:{owned:['kaneki','touka']}};
    return {data:{owned:{frieren:['fern'],jujutsu:['gojo'],alchemist:['edward'],demon:[],aot:[],naruto:[],bleach:[],onepiece:[],chainsaw:[],hunter:[],deathnote:['light'],heroacademia:[],sololeveling:[]}[args.p_series_id]}};
   }};
   window.reopen=(isMe,username='Owner')=>{
    const section=document.createElement('section');section.className='kcs-showcase';section.hidden=true;
    document.querySelector('main').replaceChildren(section);
    return window.KomiCollectorShowcase.mount(section,{client,viewer,getViewer:()=>viewer,username,isMe});
   };
   return reopen(true);
 });
 const edit=p.getByRole('button',{name:'Настроить'});
 await edit.click();
 const dialog=p.getByRole('dialog');
 await dialog.getByRole('checkbox',{name:'Лайт Ягами'}).check();
 await dialog.getByRole('checkbox',{name:'Кэн Канэки'}).check();
 await dialog.getByRole('checkbox',{name:'Сатору Годзё'}).check();
 assert.equal(await dialog.getByRole('checkbox',{name:'Эдвард Элрик'}).isDisabled(),true);
 assert.equal(await p.evaluate(()=>calls.filter(c=>c[0].endsWith('_set')).length),0);
 await p.keyboard.press('Escape');
 assert.equal(await p.getByRole('dialog').count(),0);
 assert.equal(await edit.evaluate(el=>el===document.activeElement),true);
 assert.equal(await p.evaluate(()=>chosen.length),0);
 await edit.click();
 for(const name of ['Лайт Ягами','Кэн Канэки','Сатору Годзё'])await dialog.getByRole('checkbox',{name}).check();
 await dialog.getByRole('button',{name:'Сохранить и показать'}).click();
 await p.getByText('Витрина сохранена.').waitFor();
 assert.deepEqual(await p.locator('.kcs-tile strong').allTextContents(),['Лайт Ягами','Кэн Канэки','Сатору Годзё']);
 assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 if(width===390)await p.locator('.kcs-showcase').screenshot({path:path.join(root,'browser-test-results','collector-showcase-390.png')});
 await p.evaluate(()=>{viewer='guest-signed-in';return reopen(false,'Visible');});
 assert.equal(await p.locator('.kcs-tile').count(),3);
 assert.equal(await edit.count(),0);
 assert.ok(await p.evaluate(()=>calls.at(-1)[0]==='komi_collection_showcase_read_handle'));
 await p.evaluate(()=>reopen(false,'Hidden'));
 assert.equal(await p.locator('.kcs-showcase').isHidden(),true);
 const c=await p.evaluate(()=>calls.length);
 await p.evaluate(()=>{viewer=null;return reopen(false,'Visible');});
 assert.ok(await p.locator('.kcs-showcase').isHidden());
 assert.equal(await p.evaluate(()=>calls.length),c);
 await p.evaluate(()=>{viewer='owner-a';return reopen(true);});
 await edit.click();
 for(const name of ['Лайт Ягами','Кэн Канэки','Сатору Годзё'])await dialog.getByRole('checkbox',{name}).uncheck();
 await dialog.getByRole('button',{name:'Скрыть витрину'}).click();
 await p.getByText('Витрина скрыта.').waitFor();
 assert.equal(await p.evaluate(()=>chosen.length),0);
 await p.close();
 }}finally{await b.close();}
});
