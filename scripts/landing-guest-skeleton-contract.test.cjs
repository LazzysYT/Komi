const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
const html=read('index.html'), app=read('app-main.js');
const css=read('mono-ui.css'), hubCss=read('komi-media-hub.css'), poster=read('api/poster.js');

test('guest first paint includes compact indexable recommendations and never ships admin editor UI',()=>{
  const cards=html.match(/class="komi-discovery-card komi-seo-card"/g)||[];
  assert.ok(cards.length>0&&cards.length<=12,'expected 1–12 static recommendation cards, got '+cards.length);
  assert.doesNotMatch(html,/id="(?:addAnimeBtn|adminPanelBtn|addModal|adminModal)"/);
  assert.match(app,/const isAdmin = Boolean\(currentUser\?\.authUserId && komiAdminVerified\)/);
  assert.match(html,/id="komiHeaderAniCoin"[^>]*\bhidden\b/);
  assert.match(hubCss,/not\(\.komi-authenticated\) \.komi-side-nav #notifBellBtn/);
  assert.doesNotMatch(html,/Email или старый никнейм Komi|Email для безопасной регистрации/);
  assert.match(poster,/s-maxage=\d+/);
});
test('roulette first paint is a quiet monochrome skeleton, not old placeholder copy',()=>{
  const section=html.slice(html.indexOf('id="randomRouletteModal"'),html.indexOf('id="watchModal"'));
  assert.match(section,/id="rouletteContainer" class="is-loading"/);
  assert.match(section,/id="rouletteTitle"[^>]*><\/div>/);
  assert.doesNotMatch(section,/Загрузка\.\.\.|◇ Выбираем аниме/);
  assert.match(css,/\.is-loading::after\s*\{\s*content:'';/);
  const revision=html.match(/<meta name="komi-ui-revision" content="([^"]+)"/)?.[1];
  assert.match(revision,/^\d{8}-[\w-]+$/);
  assert.equal(html.match(/komi\.production\.css\?v=([^"]+)/)?.[1],revision);
});
