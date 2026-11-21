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
  const expected=[
    '/komi.bundle.css',
    '/mobile-home-polish.css',
    '/mobile-catalog-dock.css',
    '/catalog-comfort.css',
    '/player-comfort.css',
    '/mobile-bottom-sheets.css',
    '/auth-dialog.css',
    '/catalog-discovery-v4.css'
  ];
  assert.deepEqual(local,expected,'Last-loaded mobile layers must preserve deliberate cascade order');
  assert.equal(new Set(local).size,local.length,'Stylesheets must not be loaded twice');
  for(const filename of expected) assert.ok(fs.existsSync(path.join(root,filename.slice(1))),filename+' missing');
  assert.match(head,/href="\/komi\.bundle\.css\?v=\d+[a-z]"/);
  assert.doesNotMatch(head,/<style(?:\s|>)/i);
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
