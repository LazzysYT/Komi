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
    const violations=await page.evaluate(()=>window.__komiCspViolations);
    assert.ok(violations.some(v=>v.blocked.includes('untrusted-script.example.invalid')));
    assert.equal(errors.length,0,'CSP must not introduce app errors: '+errors.join('; '));
    console.log('PASS enforced CSP: core app loads and untrusted external scripts are blocked');
  } finally {
    await browser.close();
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
