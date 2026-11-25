const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const base=process.env.KOMI_TEST_URL||'http://127.0.0.1:8765/';
const config=JSON.parse(fs.readFileSync(path.join(__dirname,'../vercel.json'),'utf8'));
const productionCsp=config.headers.find(rule=>rule.source==='/(.*)'&&!rule.has&&!rule.missing)
    ?.headers.find(header=>header.key==='Content-Security-Policy')?.value;
assert.equal(typeof productionCsp,'string','The global production CSP must be applied to the browser fixture');
const csp=productionCsp.replace("script-src-attr 'unsafe-inline'","script-src-attr 'none'");

async function assertCanonicalRoute(page,pathname,view){
 const url=new URL(page.url());
 assert.equal(url.pathname,pathname,'Navigation should use the canonical pathname');
 assert.equal(url.hash,'','Interactive navigation should not leave a legacy route hash');
 assert.equal(await page.evaluate(()=>currentView),view);
}

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
    !!document.querySelector('#sideCatalogBtn[data-komi-click]') &&
    !!document.querySelector('#sideHomeBtn[data-komi-click]') &&
    !!document.querySelector('#sideFriendsBtn[data-komi-click]'),null,{timeout:15000});
  await page.locator('#sideCatalogBtn').click();
  await assertCanonicalRoute(page,'/catalog','catalog');
  await page.locator('#sideHomeBtn').click();
  await assertCanonicalRoute(page,'/','home');
  // Simulate clicking the server-delivered first-paint link before Home Discovery
  // replaces it; JS navigation should open full controls, not just scroll a hash.
  await page.evaluate(() => {
    const fixture=document.createElement('div');
    fixture.id='komiStaticQuickFilterLinkFixture';
    fixture.innerHTML='<a href="/#catalog" data-komi-click="home-quick-filters-all">Все фильтры</a>';
    document.body.append(fixture);
  });
  // Activate the delegated event directly: the synthetic body fixture may
  // sit beneath the fixed sidebar, unlike the actual homepage control.
  await page.evaluate(()=>document.querySelector('#komiStaticQuickFilterLinkFixture a').click());
  assert.equal(await page.evaluate(()=>currentView),'catalog',
    'Static first-paint all-filters action must open the interactive catalog');
  await assertCanonicalRoute(page,'/catalog','catalog');
  const catalogSearch=await page.locator('#komiCatalogSearchInput').count();
  if(catalogSearch) assert.equal(await page.evaluate(()=>document.activeElement?.id),'komiCatalogSearchInput');
  await page.evaluate(()=>document.getElementById('komiStaticQuickFilterLinkFixture').remove());
  await page.locator('#sideHomeBtn').click();
  await assertCanonicalRoute(page,'/','home');
  await page.locator('#sideFriendsBtn').click();
  assert.equal(await page.locator('#komiFriendsDrawer').evaluate(el=>el.classList.contains('open')),true);
  assert.equal(await page.locator('#komiFriendsMyTab').isVisible(),false,
    'Anonymous visitors should not see the personal friends tab');
  await page.locator('#komiFriendsAllTab').click();
  assert.equal(await page.locator('#komiFriendsAllTab').evaluate(el=>el.classList.contains('active')),true);
  await page.locator('.komi-friends-close').click();
  assert.equal(await page.locator('#komiFriendsDrawer').evaluate(el=>el.classList.contains('open')),false);
  assert.equal(await page.locator('.komi-side-account').getAttribute('aria-label'),'Войти');
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
