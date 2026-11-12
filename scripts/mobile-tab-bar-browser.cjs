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
        assert.equal(state.navCount,5,'Mobile should expose exactly five primary tabs at '+width+': '+JSON.stringify(state));
        assert.deepEqual(state.labels,['Главная','Каталог','Случайное аниме','Люди и друзья','Профиль']);
        assert.equal(state.moreVisible,true);
        assert.ok(state.railWidth<=width+2,'Mobile bar overflows the viewport');
        assert.ok(state.railTop>650,'Mobile navigation must stay at the bottom of the screen');
        await page.locator('#komiMobileMoreToggle').click();
        assert.equal(await page.locator('#komiMobileMoreToggle').getAttribute('aria-expanded'),'true');
        assert.equal(await page.locator('#komiMobileMoreMenu button:visible').count(),4);
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
        assert.ok(state.navCount>=8,'Desktop original navigation must remain intact');
      }
      assert.equal(errors.length,0,'Unexpected page error at '+width+': '+errors.join('; '));
      console.log('PASS mobile navigation '+width,JSON.stringify(state));
      await page.close();
    }
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
