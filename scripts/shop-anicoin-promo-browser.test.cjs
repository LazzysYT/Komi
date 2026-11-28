'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),test=require('node:test');
let chromium;try{({chromium}=require('playwright'));}catch{}
const local=path.join(__dirname,'..');
const styles=['komi.production.css','komi-shop-v5.css','komi-living-profile.css','komi-shop-v6-goods.css'];
const scripts=['komi-shop-icons.js','komi-shop-reactions.js','komi-shop-catalog.js','komi-shop-v3.js','anicoin.js'];
const canonical='KOMI-AC-12345678-90ABCDEF-01234567-89ABCDEF';
const html='<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width">'+
 styles.map(name=>'<link rel="stylesheet" href="/'+name+'">').join('')+
 '<body class="komi-media-hub"><span id="komiHeaderAniCoinValue"></span><main id="mainContainer"></main>'+
 scripts.map(name=>'<script src="/'+name+'"></script>').join('')+'</body></html>';

async function shop(browser,{width=1440,host='komianime.online',owner='a'}={}){
 const page=await browser.newPage({viewport:{width,height:820},reducedMotion:'reduce',serviceWorkers:'block'});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(5000);
 await page.route('**/*',route=>{
  const u=new URL(route.request().url()),file=u.pathname.slice(1);
  if(u.hostname!==host)return route.abort();
  if(file==='shop')return route.fulfill({contentType:'text/html',body:html});
  if(!styles.includes(file)&&!scripts.includes(file))return route.abort();
  return route.fulfill({contentType:file.endsWith('.css')?'text/css':'application/javascript',body:fs.readFileSync(path.join(local,file),'utf8')});
 });
 await page.goto('https://'+host+'/shop');
 await page.evaluate(owner=>{
  window.currentView='shop';
  window.calls=[];window.logins=[];window.balances={a:12,b:900};window.outcome='redeemed';window.login=owner;
  window.openAuthModal=mode=>logins.push(mode);
  window.repaint=()=>renderAniCoinShop(document.querySelector('main'));
  window.account=id=>{window.login=id;window.currentUser=id?{authUserId:id,username:id}:null;repaint();};
  window._supabase={
   auth:{getSession:async()=>({data:{session:login?{user:{id:login},access_token:'test-token-'+login}:null}})},
   from(){return {select(){return this;},eq(){return this;},maybeSingle:async()=>({data:null})};},
   rpc(name,args){
    let bearer='';
    return {
     setHeader(header,value){if(header==='Authorization')bearer=value;return this;},
     then(resolve,reject){
      const fn=async()=>{
       const uid=bearer?bearer.replace('Bearer test-token-',''):login;
       calls.push({name,args,bearer,uid});
       const revisions={komi_shop_living_revision:KomiShopCatalog.revision,komi_shop_animated_revision:KomiShopCatalog.animatedRevision,komi_shop_frame_atelier_revision:KomiShopCatalog.frameAtelierRevision};
       if(name in revisions)return {data:revisions[name]};
       if(name==='komi_premium_store')return {data:{owned:[],balance:balances[uid]}};
       if(name==='komi_anicoin')return {data:{balance:balances[uid]}};
       if(name==='komi_redeem_anicoin_code'){
        if(window.holdRedeem)await new Promise(resolve=>{window.releaseRedeem=resolve;});
        if(outcome==='offline')throw Error('Fixture network failure');
        if(outcome==='redeemed')balances[uid]+=75;
        // Deliberately don't return the actual balance. UI must read it.
        return {data:{status:outcome,amount:75,balance:987654}};
       }
       throw Error('Unexpected RPC '+name);
      };
      return fn().then(resolve,reject);
     }
    };
   }
  };
  account(owner);
 },owner);
 if(owner)await page.locator('.sv3-balance strong').getByText(owner==='a'?'12':'900',{exact:false}).waitFor();
 return {page,errors,open:()=>page.locator('[data-v3-promo]').click(),dialog:page.getByRole('dialog',{name:'Активировать код'})};
}
const calls=page=>page.evaluate(()=>window.calls.filter(c=>c.name==='komi_redeem_anicoin_code'));

test('shop redeems a normalized AniCoin code exactly once and reads the wallet again', {skip:!chromium,timeout:45000}, async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.KOMI_CHROMIUM||undefined});
 try{
  for(const width of [1440,390,320]){
   const {page,errors,open,dialog}=await shop(browser,{width});
   await open();
   const input=dialog.getByLabel('Код AniCoin'),status=dialog.getByRole('status'),submit=dialog.getByRole('button',{name:'Активировать',exact:true});
   assert.equal(await input.evaluate(el=>el===document.activeElement),true);
   assert.equal(await dialog.getByRole('link',{name:'Перейти к Premium'}).getAttribute('href'),'/premium.html');
   assert.ok((await dialog.boundingBox()).width<=width-20);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width);
   await input.fill('not a code');await input.press('Enter');
   assert.match(await status.innerText(),/Проверь код/);
   assert.equal(await input.getAttribute('aria-invalid'),'true');
   assert.equal((await calls(page)).length,0);
   await input.fill('  komi – ac   12345678–90abcdef 01234567—89abcdef  ');
   await page.evaluate(()=>window.repaint());
   assert.equal(await input.evaluate(el=>el===document.activeElement),true);
   assert.match(await input.inputValue(),/komi – ac/);
   await page.evaluate(()=>window.holdRedeem=true);
   await input.press('Enter');await page.waitForFunction(()=>!!window.releaseRedeem);
   await page.evaluate(()=>{const f=document.querySelector('.sv3-promo-form');f.requestSubmit();f.requestSubmit();});
   assert.equal(await dialog.getByRole('button',{name:'Проверяем…'}).isDisabled(),true);
   assert.deepEqual(await calls(page),[{name:'komi_redeem_anicoin_code',args:{p_code:canonical},bearer:'Bearer test-token-a',uid:'a'}]);
   await page.evaluate(()=>window.releaseRedeem());
   await page.waitForFunction(()=>document.getElementById('komiHeaderAniCoinValue').textContent==='87');
   assert.match(await status.innerText(),/Начислено 75 AniCoin/);
   assert.match(await page.locator('.sv3-balance strong').innerText(),/^87/);
   assert.equal(await input.inputValue(),'');
   assert.equal(await submit.isEnabled(),true);
   for(const name of ['komi_premium_store','komi_anicoin']){
    assert.equal(await page.evaluate(name=>calls.filter(c=>c.name===name).at(-1).bearer,name),'Bearer test-token-a');
   }
   await page.keyboard.press('Escape');
   assert.equal(await dialog.count(),0);
   assert.equal(await page.locator('[data-v3-promo]').evaluate(el=>el===document.activeElement),true);
   assert.deepEqual(errors,[]);await page.close();
  }
 }finally{await browser.close();}
});

test('shop offers sign-in to guests, blocks preview writes, handles server responses and drops stale redemption state', {skip:!chromium,timeout:45000},async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.KOMI_CHROMIUM||undefined});
 try{
  const guest=await shop(browser,{owner:'',width:390});
  await guest.open();assert.equal(await guest.dialog.getByLabel('Код AniCoin').count(),0);
  await guest.dialog.getByRole('button',{name:'Войти'}).click();
  assert.deepEqual(await guest.page.evaluate(()=>window.logins),['login']);assert.equal((await calls(guest.page)).length,0);
  const preview=await shop(browser,{host:'preview.komianime.test'});
  await preview.open();assert.match(await preview.dialog.innerText(),/В предпросмотре коды не активируются/);
  assert.equal(await preview.dialog.getByLabel('Код AniCoin').count(),0);assert.equal((await calls(preview.page)).length,0);

  const {page,errors,open,dialog}=await shop(browser);
  await open();const input=dialog.getByLabel('Код AniCoin'),status=dialog.getByRole('status');
  for(const [outcome,expected] of [['unavailable',/не действует/],['invalid',/Проверь код/],['already_redeemed',/уже активирован/],['offline',/Не удалось подтвердить/]]){
   await page.evaluate(value=>window.outcome=value,outcome);
   await input.fill(canonical);await input.press('Enter');
   await page.waitForFunction(()=>document.querySelector('.sv3-promo-form').getAttribute('aria-busy')==='false');
   assert.match(await status.innerText(),expected);
  }
  await page.evaluate(()=>{window.holdRedeem=true;window.outcome='redeemed';});
  await input.fill(canonical);await input.press('Enter');await page.waitForFunction(()=>!!window.releaseRedeem);
  await page.evaluate(()=>window.account('b'));
  assert.equal(await dialog.count(),0);
  await open();assert.equal(await input.inputValue(),'');
  await page.evaluate(()=>window.releaseRedeem());
  await page.waitForFunction(()=>window.balances.a===87);
  assert.equal(await status.innerText(),'');
  assert.match(await page.locator('.sv3-balance strong').innerText(),/^900/);
  assert.equal(await page.evaluate(()=>window.calls.filter(c=>c.name==='komi_anicoin'&&c.uid==='b').length),0);
  // Rendered owner B must never send a request under the SDK's stale A session.
  const sent=(await calls(page)).length;
  await page.evaluate(()=>{window.login='a';window.holdRedeem=false;});
  await input.fill(canonical);await input.press('Enter');
  await page.waitForFunction(()=>document.querySelector('.sv3-promo-form').getAttribute('aria-busy')==='false');
  assert.match(await status.innerText(),/Войди в аккаунт заново/);
  assert.equal((await calls(page)).length,sent);
  await page.evaluate(()=>{window.currentView='home';document.querySelector('main').replaceChildren();});
  assert.equal(await dialog.count(),0);
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
});
