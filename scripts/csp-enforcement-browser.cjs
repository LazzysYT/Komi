const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const config=JSON.parse(fs.readFileSync(path.join(__dirname,'../vercel.json'),'utf8'));
const csp=config.headers.find(x=>x.source==='/(.*)').headers
  .find(x=>x.key==='Content-Security-Policy').value;
const base='http://127.0.0.1:8765/';

(async()=>{
  const browser=await chromium.launch({headless:true});
  try {
    const page=await browser.newPage();
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.addInitScript(()=>{
      window.__komiCspViolations=[];
      document.addEventListener('securitypolicyviolation',event=>{
        if(event.disposition==='enforce') {
          window.__komiCspViolations.push({
            directive:event.violatedDirective,blocked:event.blockedURI
          });
        }
      });
    });
    // The Python local fixture does not apply Vercel headers. Give its HTML
    // the exact production CSP so the real DOM runs with enforcement in CI.
    await page.route('**/*',async route=>{
      if(route.request().resourceType()!=='document'||
          !route.request().url().startsWith(base)) {
        await route.continue();return;
      }
      const response=await route.fetch();
      await route.fulfill({response,headers:{
        ...response.headers(),'content-security-policy':csp
      }});
    });
    const response=await page.goto(base,{waitUntil:'domcontentloaded',timeout:60000});
    assert.equal(response.status(),200);
    await page.waitForFunction(()=>typeof KomiPlayerCore==='object'
      && typeof openWatchPartyHub==='function',null,{timeout:30000});
    assert.equal(await page.locator('#watchPartyModal').count(),1);
    await page.evaluate(()=>{
      const script=document.createElement('script');
      script.src='https://untrusted-script.example.invalid/injected.js';
      document.head.appendChild(script);
    });
    await page.waitForFunction(()=>
      window.__komiCspViolations.some(event=>
        /script-src/.test(event.directive)&&
        event.blocked.includes('untrusted-script.example.invalid')
      ),null,{timeout:10000});
    // Inline script elements must now be blocked even when they are same-origin.
    await page.evaluate(()=>{
      const inline=document.createElement('script');
      inline.textContent='window.__injectedInlineRan = true';
      document.body.appendChild(inline);
    });
    await page.waitForFunction(()=>window.__komiCspViolations.some(event=>
      /script-src/.test(event.directive) &&
      (event.blocked==='inline'||event.blocked==='eval')
    ),null,{timeout:10000});
    const injected=await page.evaluate(()=>window.__injectedInlineRan);
    assert.equal(injected,undefined,'Arbitrary inline <script> should be blocked');
    // Inline event attributes must also be blocked. The delegated dynamic
    // action router remains usable because it never evaluates attribute text.
    await page.evaluate(()=>{
      const malicious=document.createElement('button');
      malicious.setAttribute('onclick','window.__injectedHandlerRan=true');
      malicious.textContent='Fake';
      document.body.append(malicious);
      malicious.click();
      malicious.remove();
    });
    await page.waitForFunction(()=>window.__komiCspViolations.some(event=>
      event.directive==='script-src-attr' &&
      event.blocked==='inline'
    ),null,{timeout:10000});
    assert.equal(await page.evaluate(()=>window.__injectedHandlerRan),undefined,
      'Inline HTML event attributes must be blocked in enforced CSP');
    await page.locator('#sideCatalogBtn').click();
    assert.equal(await page.evaluate(()=>currentView),'catalog');
    await page.evaluate(()=>{
      const element=document.createElement('button');
      element.id='cspDynamicControl';
      element.setAttribute('data-komi-onclick',"navigate('home')");
      document.body.append(element);
      element.click();
      element.remove();
    });
    assert.equal(await page.evaluate(()=>currentView),'home',
      'The delegated dynamic event router must remain usable under strict CSP');
    const violations=await page.evaluate(()=>window.__komiCspViolations);
    assert.ok(violations.some(v=>v.blocked.includes('untrusted-script.example.invalid')));
    assert.equal(errors.length,0,'CSP must not introduce app errors: '+errors.join('; '));
    console.log('PASS strict CSP: app navigation works, external/inline scripts and injected onclick blocked');
  } finally {
    await browser.close();
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
