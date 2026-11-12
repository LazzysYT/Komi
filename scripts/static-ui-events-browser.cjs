const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const base=process.env.KOMI_TEST_URL||'http://127.0.0.1:8765/';
const config=JSON.parse(fs.readFileSync(path.join(__dirname,'../vercel.json'),'utf8'));
const csp=config.headers[0].headers.find(x=>x.key==='Content-Security-Policy').value
    .replace("script-src-attr 'unsafe-inline'","script-src-attr 'none'");

(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.KOMI_CHROME?{executablePath:process.env.KOMI_CHROME}:{})});
 try{
  const page=await browser.newPage({viewport:{width:1200,height:800}});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{
    if(route.request().resourceType()!=='document'||!route.request().url().startsWith(base)){
      await route.continue();return;
    }
    const response=await route.fetch();
    await route.fulfill({response,headers:{...response.headers(),'content-security-policy':csp}});
  });
  const response=await page.goto(base,{waitUntil:'domcontentloaded',timeout:35000});
  assert.equal(response.status(),200);
  await page.waitForFunction(()=>typeof navigate==='function'&&
    document.querySelectorAll('[data-komi-click]').length>=30,null,{timeout:15000});
  await page.locator('#sideCatalogBtn').click();
  assert.equal(await page.evaluate(()=>currentView),'catalog');
  await page.locator('#sideHomeBtn').click();
  assert.equal(await page.evaluate(()=>currentView),'home');
  await page.locator('#sideFriendsBtn').click();
  assert.equal(await page.locator('#komiFriendsDrawer').evaluate(el=>el.classList.contains('open')),true);
  await page.locator('#komiFriendsMyTab').click();
  await page.locator('.komi-friends-close').click();
  assert.equal(await page.locator('#komiFriendsDrawer').evaluate(el=>el.classList.contains('open')),false);
  await page.locator('.komi-side-account').click();
  assert.equal(await page.locator('#authModal').evaluate(el=>el.classList.contains('active')),true);
  await page.locator('#tabRegisterBtn').click();
  assert.equal(await page.locator('#registerFormContainer').isVisible(),true);
  await page.locator('#tabLoginBtn').click();
  assert.equal(await page.locator('#loginFormContainer').isVisible(),true);
  const prevented=await page.evaluate(()=>{
    const event=new Event('submit',{bubbles:true,cancelable:true});
    document.getElementById('loginFormContainer').dispatchEvent(event);
    return event.defaultPrevented;
  });
  assert.equal(prevented,true,'Login submission must still prevent browser navigation');
  await page.locator('#authModal .modal-close').click();
  assert.equal(await page.locator('#authModal').evaluate(el=>el.classList.contains('active')),false);
  const allowed=await page.evaluate(()=>{
    const button=document.createElement('button');
    button.setAttribute('onclick','window.__inlineRan=true');
    document.body.append(button);
    button.click();button.remove();
    return window.__inlineRan||false;
  });
  assert.equal(allowed,false,'Strict script-src-attr policy should block injected inline action');
  assert.deepEqual(errors,[]);
  console.log('PASS strict attr CSP fixture: catalog, friends, login form, source-free static actions and inline attack blocked');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
