'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
let chromium;try{({chromium}=require('playwright'));}catch{}
const root=path.resolve(__dirname,'..'),origin='https://komianime.online';
const wide='assets/hero/daily/61967-pn7ZN5POA455AqIVejsL4YiKxiS.webp';
const layout=node=>{const r=node.getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,w:r.width,h:r.height};};
test('cinema room stacks title, video and playback strip; extras and iframe recovery stay reachable',{skip:!chromium,timeout:45000},async()=>{
 const b=await chromium.launch({headless:true,executablePath:process.env.KOMI_CHROMIUM||undefined});
 try{for(const width of [1920,1440,1366,390,320]){
  const height=width===1366?768:900;
  const p=await b.newPage({viewport:{width,height},reducedMotion:'reduce'});
  const errors=[];p.on('pageerror',e=>errors.push(e.message));p.setDefaultTimeout(6000);
  const art=fs.readFileSync(path.join(root,wide));
  await p.route('**/*',async r=>{
   const u=new URL(r.request().url()),f=u.pathname.slice(1);
   if(u.hostname==='media.test'&&u.pathname.startsWith('/preview/'))return r.fulfill({contentType:'image/webp',body:art});
   if(u.hostname==='media.test'&&u.pathname==='/player'){
    return r.fulfill({contentType:'text/html',body:'<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>body{margin:0;background:#09090b center/cover no-repeat url(/preview/1.webp);height:100vh;display:grid;place-items:center}button{font:24px sans-serif;width:60px;height:60px;border:1px solid #fff8;border-radius:50%;color:white;background:#101016aa;display:grid;place-items:center}button::before{content:"";;border:8px solid transparent;border-left:13px solid white;margin-left:10px}</style><button aria-label="Начать просмотр"></button>'});
   }
   if(u.origin!==origin||u.pathname.startsWith('/api/'))return r.fulfill({contentType:'application/json',body:'{}'});
   if(!f||/^anime\/\d+$/.test(f))return r.fulfill({contentType:'text/html',path:path.join(root,'index.html')});
   if(!/^[a-z0-9_./-]+$/i.test(f))return r.abort();
   const target=path.join(root,f);
   return fs.existsSync(target)&&fs.statSync(target).isFile()?r.fulfill({path:target}):r.abort();
  });
  await p.goto(origin+'/',{waitUntil:'domcontentloaded'});
  await p.waitForFunction(()=>typeof window.KomiMobileSheets?.openSource==='function'&&typeof window.openWatchModal==='function');
  await p.evaluate(async()=>{
   const base={id:'5114',shikimoriId:5114,title:'Стальной алхимик: Братство',type:'ТВ Сериал',year:2009,shikiRating:9.11,poster:'https://media.test/preview/poster.webp',komiDetailsLoaded:true,episodeCount:64};
   base.episodes=Array.from({length:68},(_,i)=>({season:1,number:i+1,
    duration:i<64?1440:null,preview:i<6&&i!==3?'https://media.test/preview/'+(i+1)+'.webp':'',
    sources:i<64?{'Озвучка AniLibria':'https://media.test/player?ep='+(i+1),'Субтитры':'https://media.test/player?sub='+(i+1)}:{'Озвучка STEPonee':'https://media.test/player?extra='+(i+1)}
   }));
   const demo={...base,id:'61967',shikimoriId:61967,title:'Чёрный клевер 2',year:2026,shikiRating:8.9,episodeCount:12,episodes:base.episodes.slice(0,12)};
   animeList=[base,demo];
   await openWatchModal('5114',1,0,'Озвучка AniLibria');
  });
  const dock=p.locator('.komi-cinema-v7 .komi-player-support'),heading=p.locator('.komi-cinema-v7 > .komi-player-heading'),frame=p.locator('.komi-cinema-v7 iframe');
  await dock.getByRole('button',{name:'Следующая серия',exact:true}).waitFor();
  await p.waitForFunction(()=>document.querySelector('link[data-komi-deferred-style="watch"]')?.sheet);
  const [head,player,strip]=await Promise.all([heading.evaluate(layout),frame.evaluate(layout),dock.evaluate(layout)]);
  const layoutInOrder=width>1050 ? player.bottom<=head.top+1&&head.bottom<=strip.top+1
                                  : head.bottom<=player.top+1&&player.bottom<=strip.top+1;
  assert.ok(layoutInOrder,JSON.stringify({width,head,player,strip}));
  assert.ok(Math.abs(player.w/player.h-16/9)<.06);
  assert.ok(strip.bottom<=height-2,'Playback strip should fit in the first viewport');
  const next=dock.getByRole('button',{name:'Следующая серия',exact:true});
  const nextButton=await next.evaluate(layout),nextText=await next.locator('.komi-cinema-next-text').evaluate(layout);
  assert.ok(nextButton.left<nextText.left&&nextButton.right>=nextText.right+2,'Next label must fit within the button');
  const helpBox=await dock.getByRole('button',{name:'Видео не работает?',exact:true}).evaluate(layout);
  assert.ok(helpBox.right<=strip.right&&nextButton.right<=helpBox.left);
  assert.equal(await p.locator('.komi-cinema-v7 .player-wrapper').getByRole('group',{name:'Управление видео'}).count(),0);
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
  const help=dock.getByRole('button',{name:'Видео не работает?',exact:true});await help.click();
  const recovery=p.locator('#komiPlayerRecovery');await recovery.getByRole('button',{name:'Другой источник',exact:true}).waitFor();
  assert.equal(await recovery.getByRole('button',{name:'Повторить',exact:true}).evaluate(x=>x===document.activeElement),true);await help.click();
  if(width<=767)await dock.getByRole('button',{name:'Серии',exact:true}).click();
  const sidebar=p.locator('.komi-watch-sidebar');
  assert.equal(await sidebar.getByRole('heading',{level:3}).locator('span').textContent(),'64');
  assert.equal(await sidebar.locator('.komi-cinema-extra-count').textContent(),'+4');
  assert.equal(await sidebar.locator('.komi-cinema-extra-divider').count(),1);
  assert.equal(await sidebar.locator('.komi-episode-number[data-supplemental-label]:not([data-supplemental-label=""])').count(),4);
  const search=sidebar.getByRole('searchbox');await search.fill('1');assert.equal(await sidebar.locator('.komi-cinema-extra-divider').isVisible(),false);
  await search.fill('65');assert.equal(await sidebar.locator('.komi-cinema-extra-divider').isVisible(),true);
  if(width<=767){
   await p.keyboard.press('Escape');
   await dock.getByRole('button',{name:'Озвучка: AniLibria',exact:true}).click();
   await p.getByRole('dialog').getByRole('button',{name:'Субтитры',exact:true}).click();
  }
  else await dock.getByRole('combobox',{name:'Озвучка',exact:true}).selectOption('Субтитры');
  assert.match(await frame.getAttribute('src'),/sub=1/);
  assert.ok(Math.abs((await frame.evaluate(layout)).h-player.h)<=1);
  await dock.getByRole('button',{name:'Следующая серия',exact:true}).click();
  assert.match(await frame.getAttribute('src'),/sub=2/);
  assert.deepEqual(errors,[]);
  if(process.env.KOMI_CINEMA_OUTPUT&&[1440,390].includes(width)){
   await p.evaluate(async()=>openWatchModal('61967',1,1,'Озвучка AniLibria'));
   await p.locator('.komi-cinema-v7 iframe').waitFor();
   await p.locator('.komi-cinema-v7 iframe').contentFrame().getByRole('button',{name:'Начать просмотр'}).waitFor();
   await p.screenshot({...(width===390?{clip:{x:0,y:0,width:390,height:750}}:{}),path:path.join(process.env.KOMI_CINEMA_OUTPUT,width===1440?'Komi-Cinema-PC.png':'Komi-Cinema-Mobile.png'),animations:'disabled'});
  }
  await p.close();
 }}finally{await b.close()}
});
