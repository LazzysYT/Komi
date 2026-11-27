'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
let chromium;try{({chromium}=require('playwright'));}catch{}
const root=path.resolve(__dirname,'..'),origin='https://komianime.online';
const tinyVideo=Buffer.from(fs.readFileSync(path.join(__dirname,'player-ux-browser.cjs'),'utf8')
 .match(/body:Buffer\.from\('([A-Za-z0-9+/=]+)','base64'\)/)[1],'base64');
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
   if(u.hostname==='media.test'&&u.pathname==='/approved.webm')return r.fulfill({contentType:'video/webm',headers:{'access-control-allow-origin':'*'},body:tinyVideo});
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
   localStorage.setItem('komi_adfree_only_v1','false');
   localStorage.setItem('komi_source_5114','Озвучка AniLibria');
   await openWatchModal('5114',1,0,'Озвучка AniLibria');
  });
  const dock=p.locator('.komi-cinema-v7 .komi-player-support'),heading=p.locator('.komi-cinema-v7 > .komi-player-heading'),frame=p.locator('.komi-cinema-v7 iframe');
  const next=p.locator('.komi-cinema-v7').getByRole('button',{name:'Следующая серия',exact:true});
  await next.waitFor();
  await p.waitForFunction(()=>document.querySelector('link[data-komi-deferred-style="watch"]')?.sheet);
  const allow=p.getByRole('button',{name:'Открыть другой источник',exact:true});
  await allow.waitFor();
  assert.equal(await frame.count(),0,'saved source and legacy preference must not load an unverified iframe');
  assert.equal(await p.locator('video#animeVideoPlayer').count(),0);
  await allow.click();
  const [head,player,strip]=await Promise.all([heading.evaluate(layout),frame.evaluate(layout),dock.evaluate(layout)]);
  const layoutInOrder=width>1050 ? player.bottom<=head.top+1&&head.bottom<=strip.top+1
                                  : head.bottom<=player.top+1&&player.bottom<=strip.top+1;
  assert.ok(layoutInOrder,JSON.stringify({width,head,player,strip}));
  assert.ok(Math.abs(player.w/player.h-16/9)<.06);
  assert.ok(strip.bottom<=height-2,'Playback strip should fit in the first viewport');
  const nextButton=await next.evaluate(layout),nextText=await next.locator('.komi-cinema-next-text').evaluate(layout);
  assert.ok(nextButton.left<nextText.left&&nextButton.right>=nextText.right+2,'Next label must fit within the button');
  const helpBox=await dock.getByRole('button',{name:'Видео не работает?',exact:true}).evaluate(layout);
  assert.ok(helpBox.right<=strip.right);
  assert.ok(nextButton.bottom<=height-2);
  assert.equal(await (width>1050?heading:dock).getByRole('button',{name:'Следующая серия',exact:true}).count(),1);
  if(width===1920){
   await next.focus();
   await p.setViewportSize({width:390,height});
   const moved=dock.getByRole('button',{name:'Следующая серия',exact:true});
   await moved.waitFor();
   assert.equal(await moved.evaluate(x=>x===document.activeElement),true);
   await p.setViewportSize({width,height});
   await heading.getByRole('button',{name:'Следующая серия',exact:true}).waitFor();
  }
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
  await next.click();
  await allow.waitFor();
  assert.equal(await frame.count(),0,'consent does not carry to the next episode');
  await allow.click();
  assert.match(await frame.getAttribute('src'),/sub=2/);
  await p.evaluate(async()=>{
    const anime=animeList.find(x=>x.id==='5114');
    anime.episodes[0].sources['Без рекламы · Тест']='https://media.test/approved.webm';
    closeWatchModal();
    await openWatchModal('5114',1,0,'Озвучка AniLibria');
  });
  assert.equal(await frame.count(),0,'an approved stream outranks the old external preference');
  assert.equal(await p.locator('#komiWatchSourceSelect').inputValue(),'Без рекламы · Тест');
  const native=p.locator('#animeVideoPlayer');
  await p.waitForFunction(()=>document.querySelector('#animeVideoPlayer')?.readyState>=1);
  const hud=p.locator('.komi-v4-source-trigger');
  assert.equal(await hud.isVisible(),width>1050);
  assert.equal(await p.locator('#komiWatchSourceSelect').isVisible(),false);
  assert.equal(await native.count(),1);
  const shelf=p.locator('.komi-cinema-v7 > .komi-watch-quick-actions');
  const list=shelf.locator('.komi-status-picker > summary');
  const favorite=shelf.getByRole('button',{name:'В избранное',exact:true});
  const party=shelf.getByRole('button',{name:'Смотреть вместе',exact:true});
  const overflow=shelf.locator('.komi-deck-more > summary');
  const share=shelf.locator('.komi-cinema-share');
  const comments=p.locator('#komiAnimeComments');
  const thread=comments.getByRole('button',{name:'Серия 1',exact:true});
  const general=comments.getByRole('button',{name:'Об аниме',exact:true});
  const input=comments.getByRole('textbox',{name:'Текст комментария'});
  const bounds=await shelf.evaluate(layout);
  for(const button of [list,favorite,party,overflow,share]){
   assert.equal(await button.evaluate(x=>getComputedStyle(x).borderTopLeftRadius),'999px');
   const box=await button.evaluate(layout);
   assert.ok(box.h>=44&&box.w>=44&&box.left>=bounds.left-1&&box.right<=bounds.right+1,JSON.stringify({width,bounds,box}));
  }
  if(width>1050) assert.ok(Math.abs((await party.evaluate(layout)).right-bounds.right)<=2,'Party should hug the right edge');
  assert.equal(await shelf.locator('.komi-episodes-toggle').isVisible(),width>767);
  await list.click();
  assert.equal(await shelf.locator('.komi-status-picker').getAttribute('open'),'');
  await p.keyboard.press('Escape');
  assert.equal(await shelf.locator('.komi-status-picker').getAttribute('open'),null);
  await overflow.click();
  assert.equal(await shelf.locator('.komi-deck-more').getAttribute('open'),'');
  await p.keyboard.press('Escape');
  assert.equal(await shelf.locator('.komi-deck-more').getAttribute('open'),null);
  await input.fill('Черновик к серии');
  await general.click();
  assert.equal(await general.getAttribute('aria-pressed'),'true');
  assert.equal(await input.inputValue(),'');
  await thread.click();
  assert.equal(await input.inputValue(),'Черновик к серии');
  assert.equal(await thread.evaluate(x=>getComputedStyle(x).borderTopLeftRadius),'999px');
  assert.equal(await input.evaluate(x=>getComputedStyle(x).borderTopLeftRadius),'22px');
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);

  assert.deepEqual(errors,[]);
  if(process.env.KOMI_CINEMA_OUTPUT&&[1440,390].includes(width)){
   await p.evaluate(async()=>{
    const demo=animeList.find(x=>x.id==='61967');
    demo.episodes[1].sources['Без рекламы · AniLibria']='https://media.test/approved.webm';
    await openWatchModal('61967',1,1);
    _supabase={
     from(){return {select(){return this},eq(){return this},is(){return this},order(){return this},async limit(){return {data:[],error:null}}}}
    };
    window.KomiComments.mount(61967,{season:1,episodeNumber:2});
   });
   await p.waitForFunction(()=>document.querySelector('#animeVideoPlayer')?.readyState>=1);
   await p.locator('#komiAnimeComments .komi-comments-empty').waitFor();
   await p.locator('.komi-cinema-v7 > .komi-watch-quick-actions').evaluate(x=>x.scrollIntoView({block:innerWidth>1050?'center':'start'}));
   const crop=await p.evaluate(()=>{
    const src=document.querySelector('.komi-cinema-v7 > .komi-watch-quick-actions').getBoundingClientRect();
    const title=document.querySelector('.komi-cinema-v7 > .komi-player-heading').getBoundingClientRect();
    const end=document.querySelector('#komiAnimeComments').getBoundingClientRect();
    const x=Math.max(0,Math.floor(src.left-7)), y=Math.max(0,Math.floor((innerWidth>1050?title.top:src.top)-10));
    return {x,y,width:Math.min(innerWidth-x,Math.ceil(src.right+7-x)),height:Math.min(innerHeight-y,Math.ceil(end.bottom+12-y))};
   });
   await p.screenshot({clip:crop,path:path.join(process.env.KOMI_CINEMA_OUTPUT,width===1440?'Komi-Nizhnyaya-panel-PK.png':'Komi-Nizhnyaya-panel-Telefon.png'),animations:'disabled'});
  }
  await p.close();
 }}finally{await b.close()}
});
