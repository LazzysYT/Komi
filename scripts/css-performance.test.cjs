'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const builder=require('./build-css.cjs');
test('one generated base bundle plus intentional mobile overrides retain exact cascade order',()=>{
  const stylesheetLinks=[...html.matchAll(/<link\s+[^>]*rel="stylesheet"[^>]*href="([^"]+)"/g)]
    .map(match=>match[1]);
  const localStyles=stylesheetLinks.filter(href=>href.startsWith('/'));
  const expected=['/komi.production.css','/komi-pill-system.css'];
  if (localStyles.some(href=>href.startsWith('/komi-icon-rail.css?'))) expected.push('/komi-icon-rail.css');
  expected.push('/komi-collection.css','/komi-shop-v5.css','/komi-shop-v6-goods.css');
  expected.push('/button-animations.css','/komi-genre-moods.css','/komi-watch-compact-v6.css','/komi-hero-senku.css','/profile-studio.css','/public-info.css');
  assert.deepEqual(localStyles.map(href=>href.split('?')[0]),expected);
  for(const href of localStyles) assert.match(href,/\.css\?v=\d+(?:[a-z]|-[a-z0-9-]+)(?:-[a-z0-9-]+)?$/);
  const all=builder.sources;
  assert.equal(all.at(-3),'komi-media-hub.css');
  assert.equal(all.at(-2),'komi-black-white.css');
  assert.equal(all.at(-1),'profile-premium-mono.css');
  assert.equal(fs.readFileSync(path.join(root,'komi.bundle.css'),'utf8'),builder.buildCSS());
  const production=require('./build-production-css.cjs');
  assert.equal(fs.readFileSync(path.join(root,'komi.production.css'),'utf8'),production.buildCSS());
});
test('mobile CSS profile rules and preconnections are included',()=>{
  const css=builder.buildCSS();
  assert.match(css,/Mobile profile: prevent long display names/);
  assert.match(css,/\.komi-media-hub \.komi-profile-v2 \.komi-profile-tabs/);
  assert.match(css,/--hub-hero-radius/);
  assert.match(css,/KomiAnime — black & white UI theme/);
  assert.match(html,/rel="preconnect" href="https:\/\/fonts.gstatic.com"/);
});
