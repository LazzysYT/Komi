const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const base=process.env.KOMI_TEST_URL||'http://127.0.0.1:8765/';

(async()=>{
  const browser=await chromium.launch({headless:true,...(process.env.KOMI_CHROME?{executablePath:process.env.KOMI_CHROME}:{})});
  try{
    for(const width of [375,390,700,900]){
      const page=await browser.newPage({viewport:{width,height:840},deviceScaleFactor:1});
      const errors=[];
      page.on('pageerror',e=>errors.push(e.message));
      await page.goto(base,{waitUntil:'domcontentloaded',timeout:45000});
      await page.locator('#komiMobileMoreToggle').waitFor({state:'attached'});
      const mobile=width<=767;
      const state=await page.evaluate(()=>{
        const visible=el=>!!el&&getComputedStyle(el).display!=='none'&&el.getClientRects().length>0;
        const rail=document.querySelector('.komi-side-nav');
        const children=[...rail.querySelectorAll('.komi-side-button')].filter(visible);
        const extra=document.getElementById('komiMobileMoreToggle');
        return {
          navCount:children.length,
          labels:children.map(el=>el.getAttribute('aria-label') || el.getAttribute('title')),
          moreVisible:visible(extra),
          railWidth:rail.getBoundingClientRect().width,
          railTop:rail.getBoundingClientRect().top,
          documentWidth:document.documentElement.scrollWidth,
          windowWidth:window.innerWidth,
        };
      });
      if(mobile){
        assert.equal(state.navCount,4,'Guest navigation exposes four personal-safe tabs at '+width+': '+JSON.stringify(state));
        assert.deepEqual(state.labels,['Главная','Каталог','Мои списки','Профиль']);
        assert.equal(state.moreVisible,true);
        assert.ok(state.railWidth<=width+2,'Mobile bar overflows the viewport');
        assert.ok(state.railTop>650,'Mobile navigation must stay at the bottom of the screen');
        // Reproduce the screenshot's signed-in state: old rules used to reveal
        // Notifications as a fifth item and push Profile into another row.
        await page.evaluate(()=>document.body.classList.add('komi-authenticated'));
        const geometry=await page.evaluate(()=>{
          const rail=document.querySelector('.komi-side-nav');
          const bounds=rail.getBoundingClientRect();
          const selectors=['#sideHomeBtn','#sideCatalogBtn','#sideListsBtn','.komi-side-bottom > .komi-side-account'];
          const tabs=selectors.map(selector=>{
            const el=rail.querySelector(selector);
            const r=el.getBoundingClientRect();
            return {selector,display:getComputedStyle(el).display,left:r.left,right:r.right,top:r.top,bottom:r.bottom};
          });
          const extraSelectors=['#notifBellBtn','#sideShopBtn','#sidePremiumBtn','[data-komi-click="watch-party"]'];
          const extras=extraSelectors.map(selector=>({selector,display:getComputedStyle(rail.querySelector(selector)).display}));
          return {bounds:{left:bounds.left,right:bounds.right,top:bounds.top,bottom:bounds.bottom},tabs,extras};
        });
        for(const tab of geometry.tabs){
          assert.notEqual(tab.display,'none',tab.selector+' should stay visible');
          assert.ok(tab.left>=geometry.bounds.left-1&&tab.right<=geometry.bounds.right+1,tab.selector+' exceeds dock bounds');
          assert.ok(tab.top>=geometry.bounds.top-1&&tab.bottom<=geometry.bounds.bottom+1,tab.selector+' exceeds dock height');
        }
        for(let i=1;i<geometry.tabs.length;i++)
          assert.ok(geometry.tabs[i-1].right<=geometry.tabs[i].left+2,'Mobile tabs overlap: '+JSON.stringify(geometry.tabs));
        for(const item of geometry.extras)
          assert.equal(item.display,'none','Unexpected extra mobile tab: '+item.selector);
        await page.evaluate(()=>document.body.classList.remove('komi-authenticated'));

        await page.locator('#komiMobileMoreToggle').click();
        assert.equal(await page.locator('#komiMobileMoreToggle').getAttribute('aria-expanded'),'true');
        assert.equal(await page.locator('#komiMobileMoreMenu button:visible').count(),5);
        const soundToggle=page.locator('#komiMobileSoundToggle');
        assert.equal(await soundToggle.getAttribute('aria-pressed'),'true');
        await soundToggle.click();
        assert.equal(await soundToggle.getAttribute('aria-pressed'),'false');
        assert.equal(await page.locator('#komiSoundToggle').getAttribute('aria-pressed'),'false');
        await soundToggle.click();
        assert.equal(await soundToggle.getAttribute('aria-pressed'),'true');
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('#komiMobileMoreToggle').getAttribute('aria-expanded'),'false');
        assert.equal(await page.evaluate(()=>document.activeElement.id),'komiMobileMoreToggle');
        await page.locator('#komiMobileMoreToggle').click();
        await page.locator('[data-komi-mobile-extra="partners"]').click();
        assert.equal(new URL(page.url()).hash,'#partners');
        assert.equal(await page.locator('#komiMobileMoreMenu').evaluate(el=>el.hidden),true);
        await page.locator('#sideCatalogBtn').click();
        assert.equal(new URL(page.url()).hash,'#catalog');
        await page.locator('#sideHomeBtn').click();
        assert.equal(new URL(page.url()).hash,'');
      }else{
        assert.equal(state.moreVisible,false,'Desktop should not show mobile More menu');
        assert.ok(state.navCount>=7,'Desktop hub rail retains all core controls; community stays in its own overlay button');
      }
      assert.equal(errors.length,0,'Unexpected page error at '+width+': '+errors.join('; '));
      console.log('PASS mobile navigation '+width,JSON.stringify(state));
      await page.close();
    }
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
