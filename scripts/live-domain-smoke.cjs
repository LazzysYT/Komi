/* Read-only guest E2E against the actual production domain.
 * No sign-up, credentials, data modifications, room creation or RPC writes.
 * We check the DOM and navigation a real visitor can reach.
 */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const base='https://komianime.online/';
const output=path.join(__dirname,'../browser-test-results');
fs.mkdirSync(output,{recursive:true});

(async()=>{
  const browser=await chromium.launch({headless:true});
  const results=[];
  try {
    for(const width of [1440,390]){
      const page=await browser.newPage({viewport:{width,height:900},deviceScaleFactor:1});
      const errors=[];
      page.on('pageerror',e=>errors.push(e.message));
      page.on('dialog',dialog=>dialog.dismiss().catch(()=>{}));
      try {
        const response=await page.goto(base,{waitUntil:'domcontentloaded',timeout:60000});
        assert.ok(response?.ok(),'Production HTTPS returned '+response?.status());
        await page.waitForFunction(()=>typeof catalogInitialLoadComplete!=='undefined' && catalogInitialLoadComplete,null,{timeout:75000});
        await page.waitForSelector('#mainContainer .anime-card',{timeout:30000});
        const initial=await page.evaluate(()=>{
          const canonical=document.querySelector('link[rel=canonical]')?.href||'';
          const domain=location.hostname;
          const cardCount=document.querySelectorAll('.anime-card').length;
          return {domain,canonical,cardCount,title:document.title,
             profileDrawer:!!document.getElementById('komiFriendsDrawer'),
             videoModal:!!document.getElementById('watchModal'),
             logo:!!document.querySelector('.komi-side-logo'),
             overflow:document.documentElement.scrollWidth>innerWidth+2,
             loading:!catalogInitialLoadComplete};
        });
        assert.equal(initial.domain,'komianime.online');
        assert.ok(initial.canonical.startsWith(base),'Canonical URL should match the public domain');
        assert.ok(initial.cardCount>0,'Anime catalog should contain real cards');
        assert.equal(initial.overflow,false,'Page should not overflow horizontally');
        await page.locator('#sideFriendsBtn').click({timeout:10000});
        await page.waitForFunction(()=>document.getElementById('komiFriendsDrawer').classList.contains('open'));
        await page.waitForFunction(()=>!document.getElementById('komiFriendsDrawer').hasAttribute('inert'));
        const drawer=await page.evaluate(()=>({
          visible:getComputedStyle(document.getElementById('komiFriendsDrawer')).visibility,
          hasSearch:!!document.getElementById('komiFriendsSearch'),
          readable:document.getElementById('komiFriendsDrawerList').textContent.trim().length>0
        }));
        assert.equal(drawer.visible,'visible');
        assert.equal(drawer.hasSearch,true);
        await page.locator('#komiFriendsSearch').fill('CI-AUTOTEST');
        await page.locator('#komiFriendsDrawer .komi-friends-close').count().then(async count=>{
          if(count)await page.locator('#komiFriendsDrawer .komi-friends-close').click();
          else await page.evaluate(()=>closeFriendsDrawer());
        });
        await page.waitForFunction(()=>document.getElementById('komiFriendsDrawer').hasAttribute('inert'));
        await page.evaluate(()=>openWatchPartyHub());
        await page.waitForFunction(()=>document.getElementById('authModal').classList.contains('active'));
        await page.evaluate(()=>closeAuthModal());
        await page.evaluate(()=>{location.hash='#shop'});
        await page.waitForSelector('#anicoin-title',{timeout:15000});
        await page.evaluate(()=>{location.hash='#catalog'});
        await page.waitForFunction(()=>currentView==='catalog');
        await page.waitForSelector('#komiCatalogGrid .anime-card',{timeout:30000});
        const finish=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth+2,route:location.hash}));
        assert.equal(finish.overflow,false,'Catalog must not overflow horizontally');
        assert.equal(finish.route,'#catalog');
        assert.deepEqual(errors,[],'Page threw JavaScript exceptions');
        const result={width,initial,drawer,finish,errors};
        results.push(result);
        await page.screenshot({path:path.join(output,'live-komianime-'+width+'.png'),fullPage:true});
        console.log('PASS live production visitor',JSON.stringify(result));
      }catch(e){
        results.push({width,failed:e.message,errors});
        console.error('FAIL live production visitor',width,e.message,'pageerrors',errors);
        process.exitCode=1;
      }finally{await page.close()}
    }
  }finally{
    fs.writeFileSync(path.join(output,'live-domain-results.json'),JSON.stringify(results,null,2));
    await browser.close();
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
