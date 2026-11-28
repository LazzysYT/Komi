'use strict';
// All requests are fulfilled locally with synthetic accounts and credentials.
// Never connect these tests to production Auth or a real account.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const root=path.join(__dirname,'..');
const origin='https://komi-security.test';
const sdk='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.0';
const config=JSON.parse(fs.readFileSync(path.join(root,'vercel.json'),'utf8'));
const headers=Object.fromEntries(config.headers.find(h=>h.source==='/admin-security.html').headers.map(h=>[h.key,h.value]));
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const fakeSdk=String.raw`
window.supabase={createClient(){
 const state=window.__fixture;
 const ok=data=>({data,error:null});
 const callbacks=new Set();
 let verified=[],pending=state.pending?[{id:'existing-totp',factor_type:'totp',status:'unverified'}]:[],aal='aal1',user=state.role==='guest'?null:{id:'fixture-admin'};
 const mock={calls:[],release:null,logout(){user=null;for(const cb of callbacks)cb('SIGNED_OUT',null);}};
 window.__mfaMock=mock;
 return {auth:{
   async getUser(){mock.calls.push('user');if(state.delay){state.delay=false;await new Promise(resolve=>{mock.release=resolve;});}return ok({user});},
   onAuthStateChange(cb){callbacks.add(cb);return {data:{subscription:{unsubscribe(){callbacks.delete(cb);}}}};},
   mfa:{
     async listFactors(){mock.calls.push('list');return ok({totp:verified,all:[...verified,...pending]});},
     async getAuthenticatorAssuranceLevel(){return ok({currentLevel:aal});},
     async enroll(){mock.calls.push('enroll');const id='fixture-'+(verified.length+pending.length+1);pending.push({id,status:'unverified',factor_type:'totp'});return ok({id,totp:{secret:'SYNTHETIC-KEY-DO-NOT-USE'}});},
     async challengeAndVerify({factorId,code}){mock.calls.push('verify');if(code!=='123456')return {data:null,error:{message:'internal synthetic failure'}};if(!verified.some(f=>f.id===factorId)&&!pending.some(f=>f.id===factorId))return {data:null,error:{message:'unknown factor'}};pending=pending.filter(f=>f.id!==factorId);if(!verified.some(f=>f.id===factorId))verified.push({id:factorId,status:'verified',factor_type:'totp'});aal='aal2';return ok({});}
   }
 },async rpc(name){mock.calls.push(name);return ok(state.role==='admin'&&!!user);}};
}};
`;
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  async function open(role,viewport={width:1000,height:800},delay=false,pending=false){
    const page=await browser.newPage({viewport});
    await page.addInitScript(({role,delay,pending})=>{window.__fixture={role,delay,pending};window.__violations=[];document.addEventListener('securitypolicyviolation',e=>window.__violations.push(e.blockedURI));},{role,delay,pending});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/*',route=>{
      const url=new URL(route.request().url());
      if(route.request().url()===sdk)return route.fulfill({contentType:'application/javascript',body:fakeSdk});
      if(url.origin!==origin)return route.abort();
      if(url.pathname==='/admin-security.html')return route.fulfill({contentType:'text/html',headers,body:read('admin-security.html')});
      if(['/komi-admin-mfa.js','/admin-security-entry.js'].includes(url.pathname))return route.fulfill({contentType:'application/javascript',body:read(url.pathname.slice(1))});
      return route.abort();
    });
    await page.goto(origin+'/admin-security.html');
    return {page,errors};
  }
  for(const [role,message] of [['guest','Войдите в аккаунт администратора'],['ordinary','Нет прав администратора.']]){
    const {page,errors}=await open(role);
    await page.getByText(message,{exact:role==='ordinary'}).waitFor();
    assert.equal(await page.getByRole('button',{name:'Подключить аутентификатор'}).count(),0);
    assert.deepEqual(await page.evaluate(()=>window.__mfaMock.calls.filter(c=>c==='enroll'||c==='list')),[]);
    assert.deepEqual(errors,[]);
    await page.close();
  }
  for(const viewport of [{width:1000,height:800},{width:375,height:780}]){
    const {page,errors}=await open('admin',viewport);
    await page.getByRole('button',{name:'Подключить аутентификатор'}).click();
    const key=page.getByText('SYNTHETIC-KEY-DO-NOT-USE',{exact:true});
    await key.waitFor();
    const code=page.getByLabel('Код из приложения-аутентификатора');
    await code.fill('000000');
    await page.getByRole('button',{name:'Подтвердить',exact:true}).click();
    await page.getByText(/Код не подтверждён/).waitFor();
    assert.equal(await code.inputValue(),'');
    assert.equal(await page.getByText('internal synthetic failure').count(),0);
    await code.fill('123456');
    await page.getByRole('button',{name:'Подтвердить',exact:true}).click();
    await page.getByText('Второй фактор подтверждён в текущем сеансе.',{exact:true}).waitFor();
    assert.equal(await key.count(),0);
    await page.getByRole('button',{name:'Добавить резервное устройство'}).click();
    await key.waitFor();
    await page.evaluate(()=>window.__mfaMock.logout());
    await page.getByText(/Сеанс завершён или аккаунт изменился/).waitFor();
    assert.equal(await key.count(),0);
    assert.equal(await code.count(),0);
    assert.equal(await page.getByRole('button',{name:'Добавить резервное устройство'}).count(),0);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    // Exercise the real configured CSP, not a promise of a successful exploit.
    await page.evaluate(()=>{
      const inline=document.createElement('script');inline.textContent='window.__inlineExecuted=true';document.head.append(inline);
      const ad=document.createElement('script');ad.src='https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js';document.head.append(ad);
    });
    await page.waitForFunction(()=>window.__violations.includes('inline')&&window.__violations.some(v=>v.includes('googlesyndication.com')));
    assert.equal(await page.evaluate(()=>Boolean(window.__inlineExecuted)),false);
    assert.deepEqual(errors,[]);
    await page.close();
  }
  // Reopening setup after the key was added on the phone must not create
  // a new factor. The SDK fixture reflects a server-side unverified factor.
  {
    const {page,errors}=await open('admin',{width:375,height:780},false,true);
    await page.getByText(/Устройство добавлено, но ещё не подтверждено/).waitFor();
    await page.reload();
    await page.getByRole('button',{name:'Продолжить настройку',exact:true}).click();
    const code=page.getByLabel('Код из приложения-аутентификатора');
    await code.fill('000000');
    await page.getByRole('button',{name:'Подтвердить',exact:true}).click();
    await page.getByText(/Код не подтверждён/).waitFor();
    await code.fill('123456');
    await page.getByRole('button',{name:'Подтвердить',exact:true}).click();
    await page.getByText('Второй фактор подтверждён в текущем сеансе.',{exact:true}).waitFor();
    assert.equal(await page.getByText('SYNTHETIC-KEY-DO-NOT-USE').count(),0);
    assert.equal(await page.getByRole('button',{name:'Продолжить настройку',exact:true}).count(),0);
    assert.equal(await page.evaluate(()=>window.__mfaMock.calls.filter(c=>c==='enroll').length),0);
    assert.deepEqual(errors,[]);
    await page.close();
  }
  const {page,errors}=await open('admin',{width:1000,height:800},true);
  await page.waitForFunction(()=>typeof window.__mfaMock?.release==='function');
  await page.evaluate(()=>{window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));window.__mfaMock.release();});
  await page.waitForFunction(()=>document.getElementById('adminSecurityRoot').childElementCount===0);
  assert.equal(await page.getByRole('button',{name:'Подключить аутентификатор'}).count(),0);
  assert.deepEqual(await page.evaluate(()=>window.__mfaMock.calls),['user']);
  assert.deepEqual(errors,[]);
  console.log('PASS guest and non-admin refusal; desktop/mobile mock enrollment; wrong-code recovery; backup-factor setup; sign-out cleanup; enforced CSP; stale pagehide response.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
