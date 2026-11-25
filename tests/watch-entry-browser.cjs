'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.KOMI_PLAYWRIGHT||'playwright');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const actual=read('index.html'), boot=read('komi-home-boot.js');
const critical=actual.match(/<style>\s*#komiWatchEntry\{[\s\S]+?<\/style>/)[0];
const cover=actual.match(/<div id="komiWatchEntry">[\s\S]+?<\/div>/)[0];
const css=['cinema-layout-v3.css','cinema-watch-monochrome.css','komi-watch-compact-v6.css'].map(read).join('\n');
const watchHTML=`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${critical}<script src="/boot.js"></script><style>${css}body{margin:0;color:#eee}</style><body>${cover}
<main id="mainContainer"><h1>Провожающая в последний путь Фрирен</h1></main>
<div id="watchModal"><div class="komi-watch-stage"><div class="komi-watch-quick-actions" style="grid-column:1/-1;margin:12px!important;width:auto">
<details class="komi-deck-more"><summary aria-label="Дополнительные действия">•••</summary><div class="komi-deck-menu">
<p class="komi-cinema-external-note">Внешний плеер: пауза, перемотка и переключение выполняются в самом плеере.</p>
<button class="komi-watch-expand" style="position:absolute;top:0;left:-160px">⛶ <span>На весь экран</span></button>
<button>Видео не работает?</button><div class="komi-adfree-option"><button>Только без рекламы</button><span class="komi-adfree-caption">Проверенного источника без рекламы пока нет</span></div><div class="komi-deck-actions"><button>Свет</button></div>
</div></details></div></div></div></body>`;
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.KOMI_CHROME?{executablePath:process.env.KOMI_CHROME}:{})});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:720}});
  await page.route('https://komi.test/**',route=>new URL(route.request().url()).pathname==='/boot.js'?
    route.fulfill({contentType:'text/javascript',body:boot}):route.fulfill({contentType:'text/html',body:watchHTML}));
  await page.goto('https://komi.test/?anime=61469&season=1&episode=2',{waitUntil:'domcontentloaded'});
  assert.equal(await page.getByRole('status',{name:''}).isVisible(),true);
  assert.equal(await page.getByRole('heading',{name:/Фрирен/}).isVisible(),false);
  assert.equal(await page.getByRole('link',{name:'В каталог'}).isVisible(),true);
  await page.evaluate(()=>{document.querySelector('#watchModal').classList.add('active');document.documentElement.classList.remove('komi-watch-entry');});
  for(const width of [1280,390,320]){
   await page.setViewportSize({width,height:720});
   const trigger=page.getByLabel('Дополнительные действия');
   await trigger.click();
   const result=await page.evaluate(()=>{
    const menu=document.querySelector('.komi-deck-menu');
    const box=menu.getBoundingClientRect(), controls=[...menu.querySelectorAll('button,.komi-cinema-external-note,.komi-adfree-caption')].map(n=>n.getBoundingClientRect());
    return {left:box.left,right:box.right,viewport:innerWidth,scroll:menu.scrollWidth,client:menu.clientWidth,
      separate:controls.every((r,i)=>i===0||r.top>=controls[i-1].bottom-1)};
   });
   assert.ok(result.left>=0&&result.right<=result.viewport&&result.scroll<=result.client+1&&result.separate,JSON.stringify({width,...result}));
   await trigger.click();
  }
  await page.goto('https://komi.test/?anime=invalid');
  assert.equal(await page.getByRole('heading',{name:/Фрирен/}).isVisible(),true);
  console.log('PASS cold watch route shows no homepage and player overflow fits 1280, 390 and 320px');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
