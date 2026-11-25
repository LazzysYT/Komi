const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8') + '\n' + fs.readFileSync(path.join(__dirname,'../app-main.js'),'utf8');

test('social links have inline icons and accessible names', () => {
  const nav = html.match(/<nav\b[^>]*aria-label="Социальные сети Komi Anime"[^>]*>([\s\S]*?)<\/nav>/)?.[1];
  assert.ok(nav, 'Missing social navigation');
  for (const label of ['TikTok Komi Anime', 'Telegram Komi Anime']) {
    const anchor = [...nav.matchAll(/<a\b[^>]*>[\s\S]*?<\/a>/g)]
      .map(([value]) => value).find(value => value.includes('aria-label="' + label + '"'));
    assert.ok(anchor, label + ' link missing');
    assert.match(anchor, /<svg\b[^>]*>[\s\S]*?<path\b[^>]*>[\s\S]*?<\/svg>/);
  }
});

test('initial main DOM has a compact, accessible storefront and functional anchors', () => {
  const main = html.match(/<main id="mainContainer">([\s\S]*?)<\/main>/)?.[1];
  assert.ok(main);
  assert.match(main, /komi-home-storefront komi-static-storefront/);
  assert.match(main, /aria-labelledby="komiStaticRecommendationsTitle"/);
  assert.match(main, /<div class="komi-home-rail" aria-label="Рекомендуемое аниме"/);
  const cards = main.match(/class="komi-discovery-card komi-seo-card"/g) || [];
  assert.ok(cards.length > 0 && cards.length <= 12);
  assert.doesNotMatch(main, /id="anime-grid"|komiHomeQuickFilters|data-komi-more-filters/);
  assert.doesNotMatch(main, /Загружаем каталог аниме/);
  assert.doesNotMatch(main, /class="komi-catalog-skeleton-card"/);
  assert.match(main, /<section id="shop"[^>]*aria-labelledby="komi-static-shop-title"/);
  const actions = main.match(/<div class="komi-seo-spotlight-actions">([\s\S]*?)<\/div>/)?.[1];
  assert.ok(actions);
  assert.equal((actions.match(/<a\b/g) || []).length, 2, 'Hero should have exactly two actions');
  assert.match(actions, /href="\/anime\/52991#player"/);
  assert.match(actions, /href="\/anime\/52991"/);
  assert.match(html, /function komiCatalogLoadingMarkup\(\)/);
  // The transient placeholder is still used when live data really has no cards.
  assert.match(html, /<div id="anime-grid" class="anime-grid" aria-busy="true" aria-label="Загрузка каталога">/);
});

test('all artwork placeholders are root absolute', () => {
  assert.doesNotMatch(html, /\.\/anime-artwork\.svg/);
  assert.match(html, /id="rouletteImage" src="\/anime-artwork\.svg"/);
});

test('admin UI is absent from guest HTML and mounted after checked RPC', () => {
  const rawHtml = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  const editor = fs.readFileSync(path.join(__dirname, '../komi-admin-ui.js'), 'utf8');
  assert.doesNotMatch(rawHtml, /id="(?:adminModal|addModal|animeForm|addAnimeBtn|adminPanelBtn|komiAdminAnimeModalTemplate)"/);
  assert.match(html, /async function openAddModal\(editId = null\) \{\s*if \(!\(await requireServerAdmin\(\)\) \|\| !\(await komiEnsureAdminUI\(\)\)\) return;/);
  assert.match(html, /script\.src = '\/komi-admin-ui\.js\?v=\d{8}[-\w]+'/);
  assert.match(editor, /window\.komiMountAdminUI/);
});


test('guest navigation and community have readable first-paint fallback before auth hydration', () => {
  const markup = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  assert.match(markup, /id="userHeaderArea"><button[^>]+data-komi-onclick="playSound\(\); openAuthModal\('login'\)"/);
  assert.match(markup, /id="komiFriendsDrawerList"[^>]*aria-live="polite"/);
  assert.match(markup, /Войдите, чтобы видеть друзей и участников сообщества/);
  assert.match(markup, /data-komi-click="friends-login"/);
  assert.doesNotMatch(markup, /Подключаем список пользователей/);
  assert.match(html, /function renderHeaderUser\(\)/);
  assert.match(html, /area\.replaceChildren\(pill\)/);
});

test('friends drawer is inert at rest and accessibility state tracks opening and closing', () => {
  assert.match(html, /<aside id="komiFriendsDrawer"[^>]*\binert>/);
  assert.match(html, /<aside id="komiFriendsDrawer"[^>]*aria-hidden="true"/);
  const open = html.match(/function openFriendsDrawer\(\) \{([\s\S]*?)\n        \}/)?.[1];
  const close = html.match(/function closeFriendsDrawer\(\) \{([\s\S]*?)\n        \}/)?.[1];
  assert.ok(open && close);
  assert.match(open, /removeAttribute\('inert'\)/);
  assert.match(open, /removeAttribute\('aria-hidden'\)/);
  assert.match(close, /contains\(document\.activeElement\)/);
  assert.match(close, /setAttribute\('inert'/);
  assert.match(close, /setAttribute\('aria-hidden', 'true'\)/);
});

test('SEO posters have safe delegated fallback and presence starts hidden', () => {
  const seo = html.match(/<main id="mainContainer">([\s\S]*?)<\/main>/)?.[1];
  assert.ok(seo);
  const posterTags = [...seo.matchAll(/<span class="komi-discovery-poster">(<img[^>]*>)/g)].map(m => m[1]);
  assert.ok(posterTags.length > 0 && posterTags.length <= 12);
  for (const poster of posterTags) {
    assert.match(poster, /data-komi-error="poster-error"/);
    assert.match(poster, /referrerpolicy="no-referrer"/);
    assert.match(poster, /width="240" height="360" loading="lazy"/);
  }
  assert.match(seo, /data-komi-error="poster-error"\s+width="360"/);
  assert.match(html, /class="online-counter" hidden/);
  assert.doesNotMatch(html, /Аккаунтов онлайн: проверяем…/);
});
