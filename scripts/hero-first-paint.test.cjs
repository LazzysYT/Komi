const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'../mono-ui.css'),'utf8');
const main=html.split('<main id="mainContainer">')[1]?.split('</main>')[0]||'';

test('fixed hero reference stays inside a template until daily artwork is decoded',()=>{
  const templates=[...main.matchAll(/<template class="komi-boot-real-hero">([\s\S]*?)<\/template>/g)];
  assert.equal(templates.length,1,'One dormant hero template is retained');
  assert.match(templates[0][1],/<section class="komi-home-hero"/);
  assert.match(templates[0][1],/data-komi-promo="brand-loop"/);
  const visibleMain=main.replace(templates[0][0],'');
  assert.doesNotMatch(visibleMain,/id="heroSlider"|class="hero-slide\b/,
    'A fixed editorial title must not paint before the daily hero is ready');
  assert.match(visibleMain,/<div class="komi-boot-hero">/);
  const boot=fs.readFileSync(path.join(__dirname,'../komi-home-boot.js'),'utf8');
  assert.doesNotMatch(boot,/classList\.add\([^)]*komi-home-boot-preview/);
  const before=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
  execFileSync(process.execPath,[path.join(__dirname,'build-home-shell.cjs'),'--check']);
  assert.equal(fs.readFileSync(path.join(__dirname,'../index.html'),'utf8'),before,
    'Checking the generated template does not modify the HTML or boot wrapper');
});

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
