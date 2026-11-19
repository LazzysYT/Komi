'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const {sources,buildCSS}=require('./build-css.cjs');
test('media hub stylesheet follows the single generated bundle, with no inline head CSS',()=>{
  const head=fs.readFileSync(path.join(root,'index.html'),'utf8').split('</head>')[0];
  const local=[...head.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*>/g)]
    .filter(m=>!m[0].includes('fonts.googleapis.com'));
  assert.equal(local.length,1,'All local CSS layers are bundled into one request');
  assert.match(local[0][0],/href="\/komi\.bundle\.css\?v=\d+[a-z]"/);
  assert.doesNotMatch(head,/<style(?:\s|>)/i);
  assert.match(head,/fonts\.googleapis\.com/);
});
test('generated CSS maintains source order and matches committed artifact',()=>{
  const expected=[
    'komi-comments.css','styles/inline-head.css','cinema-ui.css','mono-ui.css',
    'cinema-layout-v3.css','cinema-hud-v4.css','cinema-clean-v5.css',
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
