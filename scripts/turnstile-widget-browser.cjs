'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');
const root=path.join(__dirname,'..'),read=name=>fs.readFileSync(path.join(root,name),'utf8');
const app=read('app-main.js'),html=read('index.html'),widget=read('komi-auth-captcha.js');
function slice(s,a,b){const i=s.indexOf(a),j=s.indexOf(b,i);assert.ok(i>=0&&j>i,a);return s.slice(i,j);}
const handlers=slice(app,'async function handleLoginSubmit(', '        const komiFavoritePending = new Set();');
const helpers=slice(app,'function komiReservedAccountName(', '        function applySavedKomiProfile(');
const modal=slice(html,'<div class="modal-overlay" id="authModal"', '    <div class="modal-overlay" id="randomRouletteModal"');
const css=JSON.parse(read('vercel.json')).headers.find(h=>h.source==='/(.*)'&&!h.missing).headers.find(h=>h.key==='Content-Security-Policy').value;
const fixture=String.raw`
const calls=[],messages=[];
window.qa={calls,messages,restored:0};
const _supabase={auth:{
 async signInWithPassword(p){calls.push({kind:'login',hasToken:typeof p.options.captchaToken==='string'&&p.options.captchaToken.length>0});return {error:null};},
 async signUp(p){calls.push({kind:'signup',hasToken:typeof p.options.captchaToken==='string'&&p.options.captchaToken.length>0});return {error:null,data:{session:null}};}
}};
window.alert=m=>messages.push(String(m));
function closeAuthModal(){KomiAuthCaptcha.cancel();document.getElementById('authModal').classList.remove('active');}
async function queueKomiSessionRestore(){window.qa.restored++;}
const modal=document.getElementById('authModal');
modal.removeAttribute('inert');modal.classList.add('active');modal.setAttribute('aria-hidden','false');
const login=document.getElementById('loginFormContainer'),signup=document.getElementById('registerFormContainer');
window.qaMode=mode=>{KomiAuthCaptcha.cancel();modal.classList.add('active');login.style.display=mode==='login'?'':'none';signup.style.display=mode==='signup'?'':'none';};
login.addEventListener('submit',handleLoginSubmit);signup.addEventListener('submit',handleRegisterSubmit);
`;
const keys={pass:'1x00000000000000000000AA',fail:'2x00000000000000000000AB',mock:'1x00000000000000000000AA'};
const server=http.createServer((req,res)=>{
 const u=new URL(req.url,'http://localhost');
 if(u.pathname==='/komi-auth-captcha.js'||u.pathname==='/fixture.js'){
  res.setHeader('Content-Type','application/javascript; charset=utf-8');
  return res.end(u.pathname==='/fixture.js'?helpers+'\n'+handlers+'\n'+fixture:widget);
 }
 const mode=u.searchParams.get('mode');if(u.pathname!=='/'||!Object.hasOwn(keys,mode)){res.statusCode=404;return res.end();}
 res.setHeader('Content-Security-Policy',css);res.setHeader('Content-Type','text/html; charset=utf-8');
 res.end('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="komi-turnstile-sitekey" content="'+keys[mode]+'"><style>body{margin:0;padding:8px}form{max-width:420px;width:100%;box-sizing:border-box}input,button{max-width:100%;box-sizing:border-box;display:block;margin:4px}</style></head><body>'+modal+'<script src="/komi-auth-captcha.js"></script><script src="/fixture.js"></script></body></html>');
});
async function main(){
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true});
 try{
  for(const [width,height] of [[1280,720],[360,740]]){
   const page=await browser.newPage({viewport:{width,height}});
   await page.route('**/*',r=>{const url=new URL(r.request().url());return url.origin===base||url.hostname==='challenges.cloudflare.com'?r.continue():r.abort();});
   for(const kind of ['login','signup']){
    await page.goto(base+'/?mode=pass');await page.evaluate(kind=>window.qaMode(kind),kind);
    if(kind==='login'){await page.locator('#loginUsername').fill('qa@example.test');await page.locator('#loginPassword').fill('fixture-only-password');}
    else{await page.locator('#regUsername').fill('FixtureNickname');await page.locator('#regEmail').fill('qa@example.test');await page.locator('#regPassword').fill('fixture-only-password');}
    const form=kind==='login'?'#loginFormContainer':'#registerFormContainer';
    await page.locator(form+' button[type="submit"]').click();
    await page.waitForFunction(()=>window.qa.calls.length===1,null,{timeout:45000});
    assert.deepEqual(await page.evaluate(()=>window.qa.calls),[{kind,hasToken:true}]);
    assert.equal(await page.locator(form+' [aria-label="Проверка безопасности"]').count(),0);
    assert.equal(await page.locator(form+' button[type="submit"]').isEnabled(),true);
    console.log('PASS official Turnstile test sitekey, '+kind+', '+width+'px');
   }
   await page.close();
  }
  const page=await browser.newPage();
  await page.route('**/*',r=>{const url=new URL(r.request().url());return url.origin===base||url.hostname==='challenges.cloudflare.com'?r.continue():r.abort();});
  await page.goto(base+'/?mode=fail');await page.locator('#loginUsername').fill('qa@example.test');await page.locator('#loginPassword').fill('fixture-only-password');
  await page.locator('#loginFormContainer button[type="submit"]').click();
  await page.waitForFunction(()=>window.qa.messages.length>0,null,{timeout:45000});
  assert.equal(await page.evaluate(()=>typeof window.turnstile?.render),'function','provider SDK must actually load');
  assert.equal(await page.evaluate(()=>window.qa.calls.length),0);
  assert.equal(await page.locator('#loginFormContainer button[type="submit"]').isEnabled(),true);
  console.log('PASS official failing test sitekey blocks login and restores form');
  await page.close();
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>server.close());
