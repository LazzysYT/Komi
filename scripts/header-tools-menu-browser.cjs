'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.KOMI_PLAYWRIGHT||'playwright');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
const html=read('index.html').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<link\b[^>]*>/gi,'');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.KOMI_CHROME||undefined,args:['--no-sandbox']});
 try{
  for(const [width,height,reduced] of [[1440,900,false],[390,740,false],[320,560,false],[390,740,true]]){
   const page=await browser.newPage({viewport:{width,height},reducedMotion:reduced?'reduce':'no-preference'});
   try{
    const url='https://komi-test.example/';
    await page.route('**/*',route=>route.request().url()===url?route.fulfill({body:html,contentType:'text/html'}):route.abort());
    await page.goto(url);
    await page.addStyleTag({content:read('komi.production.css')+read('komi-hero-senku.css')+read('komi-icon-rail.css')+read('button-animations.css')});
    await page.evaluate(()=>{
     window.randomAnimeWithAnimation=()=>{window.randomCalls=(window.randomCalls||0)+1;};
    });
    await page.addScriptTag({content:read('komi-ui-sound.js')});
    await page.addScriptTag({content:read('static-ui-events.js')});
    const details=page.locator('.komi-hub-tools-menu'),trigger=details.locator('summary'),panel=details.locator('.komi-hub-tools-panel');
    assert.equal(await panel.isVisible(),false);
    await trigger.focus();
    await page.keyboard.press('Enter');
    await panel.waitFor({state:'visible'});
    await page.waitForFunction(()=>getComputedStyle(document.querySelector('.komi-hub-tools-panel')).opacity==='1');
    const bounds=await panel.boundingBox();
    assert.ok(bounds.x>=0&&bounds.x+bounds.width<=width+1&&bounds.y+bounds.height<=height+1,JSON.stringify({width,height,bounds}));
    const geometry=await panel.locator('.komi-social-link').evaluateAll(els=>els.map(e=>e.getBoundingClientRect().toJSON()));
    assert.equal(geometry.length,2);
    assert.ok(geometry[1].left>geometry[0].right&&Math.abs(geometry[1].top-geometry[0].top)<1);
    assert.ok(geometry.every(r=>r.height>=44&&r.width>=105));
    assert.equal(await panel.locator('#adminPanelBtn,#addAnimeBtn').count(),0);
    assert.equal(await panel.locator('#komiHeaderAniCoin').isVisible(),false);
    await panel.locator('[data-komi-click="random"]').click();
    assert.equal(await page.evaluate(()=>window.randomCalls),1);
    const sound=panel.locator('#komiSoundToggle');
    await sound.click();
    assert.equal(await sound.getAttribute('aria-pressed'),'false');
    assert.match(await sound.innerText(),/выключен/);
    assert.equal(await page.locator('#komiMobileSoundToggle').getAttribute('aria-pressed'),'false');
    await sound.click();
    assert.equal(await sound.getAttribute('aria-pressed'),'true');
    if(process.env.KOMI_SCREENSHOTS&&!reduced&&(width===390||width===1440)){
     await page.evaluate(()=>{
      const balance=document.getElementById('komiHeaderAniCoin');
      balance.hidden=false; document.getElementById('komiHeaderAniCoinValue').textContent='45';
      const area=document.getElementById('userHeaderArea');
      for(const label of ['Админка','+ Добавить']){
       const b=document.createElement('button');b.textContent=label;area.before(b);
      }
      area.innerHTML='<div class="user-pill"><span class="komi-header-username">НикKomi</span><button type="button">Выйти</button></div>';
     });
     await page.mouse.move(width-1,2);
     await page.screenshot({path:path.join(process.env.KOMI_SCREENSHOTS,'full-'+width+'.png')});
     await panel.screenshot({path:path.join(process.env.KOMI_SCREENSHOTS,'header-menu-'+width+'.png')});
    }
    await sound.focus();
    await page.keyboard.press('Escape');
    assert.equal(await details.evaluate(el=>el.open),false);
    await panel.waitFor({state:'hidden'});
    assert.equal(await trigger.evaluate(el=>el===document.activeElement),true);
    await trigger.click();
    if(reduced)assert.equal(await panel.evaluate(el=>getComputedStyle(el).animationName),'none');
    else if(await page.evaluate(()=>CSS.supports('selector(details::details-content)'))){
     assert.match(await panel.evaluate(el=>getComputedStyle(el).transitionProperty),/opacity/);
    }
    await page.mouse.click(width-2,height-2);
    await panel.waitFor({state:'hidden'});
   }finally{await page.close();}
  }
  console.log('PASS header tools: 1440/390/320, reduced motion, keyboard, outside click, social targets and sound.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
