const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
const html=read('index.html'), app=read('app-main.js');
const css=read('mono-ui.css'), poster=read('api/poster.js');

test('guest first paint includes indexable catalog and never ships admin editor UI',()=>{
  const cards=html.match(/class="anime-card komi-seo-card"/g)||[];
  assert.ok(cards.length>=20,'expected at least 20 static cards, got '+cards.length);
  assert.doesNotMatch(html,/id="(?:addAnimeBtn|adminPanelBtn|addModal|adminModal)"/);
  assert.match(app,/const isAdmin = Boolean\(currentUser\?\.authUserId && komiAdminVerified\)/);
  assert.match(html,/id="komiHeaderAniCoin"[^>]*\bhidden\b/);
  assert.match(css,/not\(\.komi-authenticated\) \.komi-side-nav #notifBellBtn/);
  assert.doesNotMatch(html,/Email или старый никнейм Komi|Email для безопасной регистрации/);
  assert.match(poster,/s-maxage=\d+/);
});
test('roulette first paint is a quiet monochrome skeleton, not old placeholder copy',()=>{
  const section=html.slice(html.indexOf('id="randomRouletteModal"'),html.indexOf('id="watchModal"'));
  assert.match(section,/id="rouletteContainer" class="is-loading"/);
  assert.match(section,/id="rouletteTitle"[^>]*><\/div>/);
  assert.doesNotMatch(section,/Загрузка\.\.\.|Обложка случайного аниме|◇ Выбираем аниме/);
  assert.match(css,/\.is-loading::after\s*\{\s*content:'';/);
  assert.match(html,/komi\.bundle\.css\?v=20261120b/);
});
