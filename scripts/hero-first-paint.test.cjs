const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'../mono-ui.css'),'utf8');
const main=html.split('<main id="mainContainer">')[1]?.split('</main>')[0]||'';

test('first-paint hero is content-led but keeps readable SEO metadata',()=>{
  const intro=main.split('aria-labelledby="komiStaticRecommendationsTitle"')[0];
  assert.match(intro,/komi-seo-fallback komi-seo-spotlight/);
  assert.match(intro,/<h1>Komi Anime Hub — каталог аниме<\/h1>/);
  assert.match(intro,/<h2>Провожающая в последний путь Фрирен<\/h2>/);
  const links = intro.match(/<div class="komi-seo-spotlight-actions">([\s\S]*?)<\/div>/)?.[1] || '';
  assert.equal((links.match(/<a\b/g) || []).length, 2);
  assert.match(links,/href="\/anime\/52991#player"/);
  assert.match(links,/href="\/anime\/52991"/);
  assert.match(intro,/alt="Постер аниме/);
  assert.match(intro,/fetchpriority="high"/);
  assert.match(css,/\.komi-seo-fallback\.komi-seo-spotlight\s*\{/);
  assert.match(css,/background:radial-gradient/);
});
test('streaming shelves preserve crawlable recommendations and native catalog links',()=>{
  assert.match(css,/main \.komi-feature-section \.anime-grid/);
  assert.match(css,/scroll-snap-type:x proximity/);
  const cards=main.match(/class="komi-discovery-card komi-seo-card"/g)||[];
  assert.ok(cards.length>0 && cards.length<=12);
  assert.match(main,/komiStaticRecommendationsTitle/);
  assert.match(main,/<section id="shop"/);
  assert.match(main,/href="\/catalog\?genre=/);
  assert.doesNotMatch(main,/id="anime-grid"|data-komi-more-filters|komi-boot-resume/);
});
