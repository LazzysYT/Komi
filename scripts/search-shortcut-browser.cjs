const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const base=process.env.KOMI_TEST_URL||'http://127.0.0.1:8765/';
(async()=>{
  const browser=await chromium.launch({headless:true,...(process.env.KOMI_CHROME?{executablePath:process.env.KOMI_CHROME}:{})});
  try{
    const page=await browser.newPage({viewport:{width:1200,height:800}});
    const url=new URL('/__komi_search_shortcut_fixture__',base).href;
    const failures=[];
    page.on('pageerror',e=>failures.push(e.message));
    await page.route('**/__komi_search_shortcut_fixture__',route=>route.fulfill({
      status:200,contentType:'text/html',body:`<!doctype html><html lang="ru"><body>
      <div class="search-container"><div class="search-bar"><input id="searchInput" value="Фрирен"></div></div>
      <input id="komiCatalogSearchInput" style="display:none">
      <div id="authModal" class="modal-overlay"><div class="modal-content"><input id="modalInput"></div></div>
      <script src="/accessibility.js"></script></body></html>`
    }));
    await page.goto(url,{waitUntil:'load'});
    await page.keyboard.press('Control+k');
    assert.equal(await page.evaluate(()=>document.activeElement.id),'searchInput');
    assert.equal(await page.evaluate(()=>document.getElementById('searchInput').selectionStart),0);
    assert.equal(await page.evaluate(()=>document.getElementById('searchInput').selectionEnd),6);
    await page.evaluate(()=>document.getElementById('authModal').classList.add('active'));
    await page.waitForFunction(()=>!document.getElementById('authModal').hasAttribute('inert'));
    await page.locator('#modalInput').focus();
    await page.keyboard.press('Control+k');
    assert.equal(await page.evaluate(()=>document.activeElement.id),'modalInput','Do not steal keys inside active dialogs');
    await page.evaluate(()=>{
      document.getElementById('authModal').classList.remove('active');
      document.getElementById('searchInput').style.display='none';
      document.getElementById('komiCatalogSearchInput').style.display='block';
    });
    await page.waitForFunction(()=>document.getElementById('authModal').hasAttribute('inert'));
    await page.keyboard.press('Control+k');
    assert.equal(await page.evaluate(()=>document.activeElement.id),'komiCatalogSearchInput');
    assert.deepEqual(failures,[]);
    console.log('PASS keyboard live search shortcut, modal isolation and catalog fallback');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
