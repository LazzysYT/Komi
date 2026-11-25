'use strict';
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {chromium}=require(process.env.KOMI_PLAYWRIGHT || 'playwright');
const css=['cinema-layout-v3.css','cinema-watch-monochrome.css','komi-watch-compact-v6.css']
  .map(name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8')).join('\n');
const title='Невероятное приключение ДжоДжо: Гонка «Стальной шар»';
const html=`<!doctype html><html lang="ru"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}
body{margin:0;background:#09090b;color:#fff;font:16px Inter,Arial,sans-serif}
#watchModal.active{position:relative;display:block;padding:12px}
#watchModal .komi-watch-stage.test{grid-template-columns:minmax(0,1fr)!important;max-width:1200px;margin:auto}
</style><body><div id="watchModal" class="active"><div class="komi-watch-stage test">
<div class="komi-player-heading"><div><h1>${title}</h1><p>Серия 1 из 10 <span class="komi-title-rating">· Рейтинг ★ 9.04 Shikimori</span></p></div>
<div class="komi-episode-navigation"><button class="komi-watch-navbtn" aria-label="Предыдущая серия" disabled>Предыдущая</button><button class="komi-watch-navbtn primary" aria-label="Следующая серия">Следующая</button></div></div>
<div class="komi-watch-quick-actions"><details class="komi-status-picker komi-compact-list"><summary>В список</summary><div><button>Смотрю</button></div></details><button class="komi-compact-favorite">★ В избранное</button><button class="komi-cinema-party">Смотреть вместе</button><button class="komi-episodes-toggle">Театр</button></div>
<section id="komiAnimeComments" aria-label="Комментарии"><div class="komi-comments-heading"><h2>Комментарии</h2><span class="komi-comments-count">0</span><span class="komi-comments-episode-label">Сезон 1, серия 1</span></div>
<div class="komi-comments-thread-switch"><button aria-pressed="true">Серия 1</button><button aria-pressed="false">Об аниме</button></div><p class="komi-comments-thread-note">Чтобы скрыть спойлер, заключи текст в ||двойные черты||.</p>
<form class="komi-comments-form"><span class="komi-comment-compose-avatar">K</span><textarea class="komi-comments-input" aria-label="Текст комментария" placeholder="Поделись впечатлениями о серии…" rows="2"></textarea><div class="komi-comments-actions"><button type="submit">Отправить</button></div></form>
<p class="komi-comments-status" role="status"></p><div class="komi-comments-list"><p class="komi-comments-empty">К этой серии пока нет комментариев.</p></div></section></div></div></body></html>`;
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.KOMI_CHROME?{executablePath:process.env.KOMI_CHROME}:{})});
 try{
  const page=await browser.newPage();
  for(const width of [1280,840,390,320]){
   await page.setViewportSize({width,height:760});
   await page.setContent(html);
   const g=await page.evaluate(()=>{
    const q=x=>document.querySelector(x).getBoundingClientRect();
    const section=q('#komiAnimeComments'),box=q('textarea'),send=q('[type=submit]'),nav=q('.komi-episode-navigation'),h=q('h1'),empty=q('.komi-comments-empty');
    return {doc:document.documentElement.scrollWidth,section:section.height,send:send.height,boxWidth:box.width,
      composeStack:send.top>=box.bottom,navSeparate:nav.left>=h.right||nav.top>=h.bottom,empty:empty.height};
   });
   assert.ok(g.doc<=width+1 && g.boxWidth>=120 && g.navSeparate && g.empty<70, JSON.stringify({width,...g}));
   assert.equal(g.composeStack,width<=480,JSON.stringify({width,...g}));
   if(width<=767)assert.ok(g.send>=44);
   const previous=page.getByRole('button',{name:'Предыдущая серия'});
   assert.equal(await previous.isEnabled(),false);
   await page.getByText('В список',{exact:true}).click();
   assert.equal(await page.getByRole('button',{name:'Смотрю',exact:true}).isVisible(),true);
   await page.getByText('В список',{exact:true}).click();
   await page.getByRole('textbox',{name:'Текст комментария'}).fill('Черновик без публикации');
   if(process.env.KOMI_SCREEN_DIR) await page.locator('.komi-watch-stage').screenshot({path:path.join(process.env.KOMI_SCREEN_DIR,width+'.png')});
  }
  console.log('PASS watch discussion layout at 1280, 840, 390 and 320px');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
