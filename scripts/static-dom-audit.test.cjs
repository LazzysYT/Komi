const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8') + '\n' + fs.readFileSync(path.join(__dirname,'../app-main.js'),'utf8');

test('social links have inline icons and accessible names', () => {
  const nav = html.match(/<nav class="komi-social-links"[^>]*>([\s\S]*?)<\/nav>/)?.[1];
  assert.ok(nav, 'Missing social navigation');
  for (const label of ['TikTok Komi Anime', 'Telegram Komi Anime']) {
    const anchor = [...nav.matchAll(/<a\b[^>]*>[\s\S]*?<\/a>/g)]
      .map(([value]) => value).find(value => value.includes('aria-label="' + label + '"'));
    assert.ok(anchor, label + ' link missing');
    assert.match(anchor, /<svg\b[^>]*>[\s\S]*?<path\b[^>]*>[\s\S]*?<\/svg>/);
  }
});

test('initial main DOM has a populated, accessible static catalog and functional anchors', () => {
  const main = html.match(/<main id="mainContainer">([\s\S]*?)<\/main>/)?.[1];
  assert.ok(main);
  assert.match(main, /<section id="catalog"[^>]*aria-label="Каталог аниме"/);
  assert.match(main, /<div id="anime-grid" class="anime-grid" aria-busy="false"/);
  assert.ok((main.match(/class="anime-card komi-seo-card"/g) || []).length >= 36);
  assert.doesNotMatch(main, /Загружаем каталог аниме/);
  assert.doesNotMatch(main, /class="komi-catalog-skeleton-card"/);
  assert.match(main, /<section id="shop"[^>]*aria-labelledby="komi-static-shop-title"/);
  assert.match(main, /href="#catalog"/);
  assert.match(main, /href="#shop"/);
  assert.match(html, /function komiCatalogLoadingMarkup\(\)/);
  // The transient placeholder is still used when live data really has no cards.
  assert.match(html, /<div id="anime-grid" class="anime-grid" aria-busy="true" aria-label="Загрузка каталога">/);
});

test('all artwork placeholders are root absolute', () => {
  assert.doesNotMatch(html, /\.\/anime-artwork\.svg/);
  assert.match(html, /id="rouletteImage" src="\/anime-artwork\.svg"/);
});

test('admin form lives in an inert template until a verified admin action', () => {
  const modalTemplate = html.match(/<template id="komiAdminAnimeModalTemplate">([\s\S]*?)<\/template>/)?.[1];
  assert.ok(modalTemplate);
  assert.match(modalTemplate, /id="addModal"/);
  assert.match(modalTemplate, /id="animeForm"/);
  const activeHtml = html.replace(/<template id="komiAdminAnimeModalTemplate">[\s\S]*?<\/template>/, '');
  assert.doesNotMatch(activeHtml.slice(0, activeHtml.indexOf('<script src="./player-core.js">')), /id="addModal"/);
  assert.match(html, /async function openAddModal\(editId = null\) \{\s*if \(!\(await requireServerAdmin\(\)\)\) return;/);
  assert.match(html, /template\.content\.cloneNode\(true\)/);
});

test('friends drawer is inert at rest and accessibility state tracks opening and closing', () => {
  assert.match(html, /<aside id="komiFriendsDrawer"[^>]*\binert>/);
  assert.doesNotMatch(html, /<aside id="komiFriendsDrawer"[^>]*aria-hidden="true"/);
  const open = html.match(/function openFriendsDrawer\(\) \{([\s\S]*?)\n        \}/)?.[1];
  const close = html.match(/function closeFriendsDrawer\(\) \{([\s\S]*?)\n        \}/)?.[1];
  assert.ok(open && close);
  assert.match(open, /removeAttribute\('inert'\)/);
  assert.match(open, /removeAttribute\('aria-hidden'\)/);
  assert.match(close, /contains\(document\.activeElement\)/);
  assert.match(close, /setAttribute\('inert'/);
  assert.match(close, /setAttribute\('aria-hidden', 'true'\)/);
});
