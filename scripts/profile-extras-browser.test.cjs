const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const root=path.join(__dirname,'..'),origin='https://komianime.online';
const html='<!doctype html><html lang="ru"><head><meta charset="utf-8"></head><body><main id="mainContainer"><section id="profile" data-profile-owner="true" data-profile-preview="false"><section class="kpe-panel" data-kpe-medals></section><section class="kpe-editor" data-kpe-editor></section><button data-kpe-friend><img src="/icon.svg" data-komi-friend-avatar="beta"><span>Beta</span></button></section></main><script src="/komi-profile-extras-catalog.js"></script><script src="/komi-profile-extras.js"></script></body></html>';
async function install(page){
 await page.route('**/*',route=>{
  const u=new URL(route.request().url()),f=u.pathname.slice(1);
  if(u.origin!==origin)return route.abort();
  if(u.pathname==='/fixture')return route.fulfill({contentType:'text/html; charset=utf-8',body:html});
  if(!/^(?:komi-profile-extras(?:-catalog)?\.(?:js|css)|assets\/profile-(?:medals|cursors)\/[a-z0-9_-]+\.svg|icon\.svg)$/.test(f))return route.abort();
  return route.fulfill({contentType:f.endsWith('.svg')?'image/svg+xml':f.endsWith('.css')?'text/css; charset=utf-8':'application/javascript; charset=utf-8',body:fs.readFileSync(path.join(root,f),'utf8')});
 });
 await page.goto(origin+'/fixture');
 await page.evaluate(()=>{
  window.fixture={viewer:'alpha',calls:[],data:{revision:KomiExtrasCatalog.revision,balance:100,owned:[],medals:[],stats:{watched:1,listed:3},appearance:{background:'noir',card_enabled:false,cursor_id:null,effect_id:null,medal_id:null}}};
  window.fixture.client={rpc:async(name,{p_action:a,p_args:b})=>{
   const f=window.fixture,d=f.data;f.calls.push({a,b});let reply;
   if(a==='cards')reply=b.handles.includes('beta')?[{username:'beta',background:'moon',effect_id:'friend_fx_moon'}]:[];
   else if(a==='public_medal')reply={medal_id:null};
   else {
    d.new_medal=null;
    if(a==='claim'&&!d.medals.some(m=>m.id===b.medal_id)){d.medals.push({id:b.medal_id});d.new_medal=b.medal_id;}
    if(a==='pin')d.appearance.medal_id=b.medal_id;
    if(a==='buy'&&!d.owned.includes(b.item_id)){d.balance-=b.expected_cost;d.owned.push(b.item_id);d.appearance[b.kind==='cursor'?'cursor_id':'effect_id']=b.item_id;}
    if(a==='equip')d.appearance[b.kind==='cursor'?'cursor_id':'effect_id']=b.item_id;
    if(a==='save_card')Object.assign(d.appearance,b);
    reply=structuredClone(d);
   }return {data:reply};
  },storage:{from:()=>({getPublicUrl:()=>({data:{publicUrl:origin+'/icon.svg'}})})}};
  KomiProfileExtras.configure({client:fixture.client,getViewer:()=>fixture.viewer});
  return KomiProfileExtras.mountProfile(document.querySelector('#profile'),{viewer:'alpha',username:'alpha',isMe:true,preview:false,full:true,avatar:origin+'/icon.svg',name:'Komi'});
 });
}
test('all medal SVGs decode, award animation and one-time claim, own editor, friend card and store on mobile and desktop',async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.KOMI_CHROMIUM||undefined});
 try{
  for(const width of [1440,390,320]){
   const page=await browser.newPage({viewport:{width,height:840},reducedMotion:'reduce'});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await install(page);
   const profile=page.locator('#profile');await page.locator('.kpe-medal-tile').first().waitFor();
   assert.equal(await page.locator('.kpe-medal-tile').count(),60);
   assert.equal(await page.evaluate(async()=>{const imgs=[...document.querySelectorAll('.kpe-medal-tile img')];for(const img of imgs){img.loading='eager';await img.decode();if(!img.naturalWidth)return false;}return true;}),true);
   const first=page.locator('[data-medal-id="watched_1"]');assert.equal(await first.getAttribute('data-medal-state'),'ready',await first.textContent());
   assert.equal(await first.locator('button').textContent(),'Получить');
   await first.locator('button').click({timeout:8000});
   await page.locator('#kpe-award').waitFor({state:'visible'});assert.equal(await page.locator('#kpe-award').getAttribute('data-rarity'),'common');
   assert.equal(await page.locator('#kpe-award .kpe-medal-art').evaluate(n=>getComputedStyle(n).animationName),'none');
   await page.locator('#kpe-award').getByRole('button',{name:'В коллекцию'}).click();
   assert.equal(await first.getAttribute('data-medal-state'),'owned');await first.locator('button').click({timeout:8000});
   await page.locator('.kpe-featured').waitFor();
   assert.equal(await page.evaluate(()=>fixture.calls.filter(x=>x.a==='claim').length),1);
   await page.locator('.kpe-editor input[type=checkbox]').check();
   await page.locator('.kpe-editor select').first().selectOption('gold');
   await page.locator('.kpe-editor').getByRole('button',{name:'Сохранить мини-карточку'}).click();
   await page.getByText('Мини-карточка сохранена.').waitFor();
   assert.equal(await page.evaluate(()=>fixture.calls.filter(x=>x.a==='save_card').length),1);
   await page.waitForFunction(()=>document.querySelector('[data-kpe-friend]')?.dataset.kpeBg==='moon');
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   await page.evaluate(()=>{document.querySelector('#mainContainer').innerHTML='<section id="shop"><header class="sv3-topbar">Магазин</header></section>';KomiProfileExtras.mountShop(document.querySelector('#mainContainer'),{owner:'alpha',avatar:originForFixture(),name:'Komi'});function originForFixture(){return location.origin+'/icon.svg';}});
   await page.locator('.kpe-shop summary').click();
   await page.getByText('Баланс: 100 AniCoin · куплено 0 / 16').waitFor();
   assert.equal(await page.locator('.kpe-product').count(),10);
   const tile=page.locator('[data-product-id="cursor_katana"]');
   await tile.getByRole('button',{name:'Купить и надеть'}).click();
   await page.locator('.kpe-confirm').getByRole('button',{name:'Отмена'}).click();
   assert.equal(await page.evaluate(()=>fixture.calls.filter(x=>x.a==='buy').length),0);
   await tile.getByRole('button',{name:'Купить и надеть'}).click();
   await page.locator('.kpe-confirm').getByRole('button',{name:'Купить и надеть'}).click();
   await page.getByText('Баланс: 90 AniCoin · куплено 1 / 16').waitFor();
   assert.equal(await page.evaluate(()=>fixture.data.appearance.cursor_id),'cursor_katana');
   assert.equal(await page.evaluate(()=>fixture.calls.find(x=>x.a==='buy').b.expected_cost),10);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   assert.deepEqual(errors,[]);await page.close();
  }
 }finally{await browser.close();}
});
