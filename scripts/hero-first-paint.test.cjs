const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'../mono-ui.css'),'utf8');
const main=html.split('<main id="mainContainer">')[1]?.split('</main>')[0]||'';

test('first-paint hero is content-led but keeps readable SEO metadata',()=>{
  const intro=main.split('<section id="catalog"')[0];
  assert.match(intro,/komi-seo-fallback komi-seo-spotlight/);
  assert.match(intro,/<h1>Komi Anime Hub — каталог аниме<\/h1>/);
  assert.match(intro,/<h2>Провожающая в последний путь Фрирен<\/h2>/);
  assert.match(intro,/href="\/anime\/52991"/);
  assert.match(intro,/href="#catalog"/);
  assert.match(intro,/href="#shop"/);
  assert.match(intro,/alt="Постер аниме/);
  assert.match(intro,/fetchpriority="high"/);
  assert.match(css,/\.komi-seo-fallback\.komi-seo-spotlight\s*\{/);
  assert.match(css,/background:radial-gradient/);
});
test('streaming shelves preserve crawlable catalog and accessible labels',()=>{
  assert.match(css,/main \.komi-feature-section \.anime-grid/);
  assert.match(css,/scroll-snap-type:x proximity/);
  assert.ok((main.match(/class="anime-card komi-seo-card"/g)||[]).length >= 36);
  assert.match(main,/<section id="catalog"/);
  assert.match(main,/<section id="shop"/);
  assert.match(main,/id="anime-grid" class="anime-grid" aria-busy="false"/);
});
