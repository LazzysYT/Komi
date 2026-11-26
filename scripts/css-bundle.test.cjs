'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const {sources,buildCSS}=require('./build-css.cjs');
test('generated bundle leads the explicit, versioned mobile override cascade',()=>{
  const head=fs.readFileSync(path.join(root,'index.html'),'utf8').split('</head>')[0];
  const local=[...head.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*href="(\/[^"]+)"/g)]
    .map(match=>match[1].split('?')[0]);
  const expected=['/komi.production.css','/komi-pill-system.css'];
  if (head.includes('href="/komi-icon-rail.css')) expected.push('/komi-icon-rail.css');
   expected.push('/komi-collection.css','/komi-shop-v5.css','/komi-living-profile.css','/komi-shop-v6-goods.css');
  expected.push('/button-animations.css','/komi-genre-moods.css','/komi-watch-compact-v6.css','/komi-hero-senku.css','/profile-studio.css','/public-info.css');
  assert.deepEqual(local,expected,'Last-loaded mobile layers must preserve deliberate cascade order');
  assert.equal(new Set(local).size,local.length,'Stylesheets must not be loaded twice');
  for(const filename of expected) assert.ok(fs.existsSync(path.join(root,filename.slice(1))),filename+' missing');
  assert.match(head,/href="\/komi\.production\.css\?v=\d+(?:[a-z])?(?:-[a-z0-9-]+)?"/);
  const criticalStyles=[...head.matchAll(/<style\b([^>]*)>[\s\S]*?<\/style>/gi)];
  assert.deepEqual(criticalStyles.map(match=>match[1].match(/\bid="([^"]+)"/)?.[1]),
    ['komi-initial-visibility','komi-watch-entry-visibility'],
    'Only the named first-paint visibility guards may precede the CSS bundle');
  for (const style of criticalStyles) assert.ok(style.index<head.indexOf('rel="stylesheet"'));
  assert.match(head,/fonts\.googleapis\.com/);
});
test('generated CSS maintains source order and matches committed artifact',()=>{
  const expected=[
    'komi-comments.css','styles/inline-head.css','cinema-ui.css','mono-ui.css',
    'cinema-layout-v3.css','cinema-hud-v4.css','cinema-clean-v5.css','cinema-watch-monochrome.css',
    'home-discovery.css','styles/inline-tail.css','komi-monochrome.css',
    'komi-media-hub.css','komi-black-white.css','profile-premium-mono.css'
  ];
  assert.deepEqual(sources,expected);
  const saved=fs.readFileSync(path.join(root,'komi.bundle.css'),'utf8');
  assert.equal(saved,buildCSS(),'CSS source changed without rebuilding the bundle');
  let prev=-1;
  for(const file of sources){
    const idx=saved.indexOf('/* --- '+file+' --- */');
    assert.ok(idx>prev,'CSS cascade order changed at '+file);
    prev=idx;
  }
  for(const key of ['.komi-side-nav','.komi-seo-fallback','#watchModal','.komi-card-status','.komi-header-left']){
    assert.ok(saved.includes(key),'Missing important selector '+key);
  }
});

test('single production CSS keeps original cascading order and matches all source files',()=>{
 const builder=require('./build-production-css.cjs');
 const result=fs.readFileSync(path.join(root,'komi.production.css'),'utf8');
 assert.equal(builder.sources.length,14);
 assert.equal(builder.sources.at(-1),'header-tools-menu.css');
 assert.equal(result,builder.buildCSS());
 let last=-1;
 for(const name of builder.sources){
   const at=result.indexOf('/* --- '+name+' --- */');
   assert.ok(at>last,'CSS cascade order changed at '+name);
   last=at;
 }
 for(const mark of ['#shop.komi-shop-v3','.sv3-product-grid','.komi-shop-gift-button']){
   assert.ok(result.includes(mark),'CSS selector missing: '+mark);
 }
});

test('V4 sticker styles are retained in the same one-file production cascade',()=>{
 const css=fs.readFileSync(path.join(root,'komi.production.css'),'utf8');
 const shop=fs.readFileSync(path.join(root,'komi-shop-v3.css'),'utf8');
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 assert.ok(css.includes(shop.trimEnd()));
 assert.match(css,/\.sv4-feature-grid/);
 assert.match(css,/\.sv4-perk-badge/);
 const revision=html.match(/<meta name="komi-ui-revision" content="([^"]+)"/)?.[1];
 assert.match(revision,/^\d{8}-[\w-]+$/);
 assert.equal(html.match(/komi\.production\.css\?v=([^"]+)/)?.[1],revision);
 assert.doesNotMatch(html,/komi-shop-v3\.css\?v=/);
 assert.match(html,/class="komi-static-shop komi-shop-v3 komi-shop-v5 komi-shop-studio"/);
  assert.match(html,/komi-shop-v5\.css\?v=/);
  assert.match(html,/class="sv7-static-loading" role="status"/);
  assert.doesNotMatch(html,/class="sv5-weekly"/);
  assert.doesNotMatch(html,/sv4-feature-grid/);
});
