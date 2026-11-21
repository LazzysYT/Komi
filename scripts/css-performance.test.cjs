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
  assert.deepEqual(localStyles.map(href=>href.split('?')[0]),[
    '/komi.bundle.css','/mobile-home-polish.css','/mobile-catalog-dock.css',
    '/catalog-comfort.css','/player-comfort.css','/mobile-bottom-sheets.css',
    '/auth-dialog.css','/catalog-discovery-v4.css','/community-search.css','/komi-checkout.css'
  ]);
  for(const href of localStyles) assert.match(href,/\.css\?v=\d+[a-z]?$/);
  const all=builder.sources;
  assert.equal(all.at(-3),'komi-media-hub.css');
  assert.equal(all.at(-2),'komi-black-white.css');
  assert.equal(all.at(-1),'profile-premium-mono.css');
  assert.equal(fs.readFileSync(path.join(root,'komi.bundle.css'),'utf8'),builder.buildCSS());
});
test('mobile CSS profile rules and preconnections are included',()=>{
  const css=builder.buildCSS();
  assert.match(css,/Mobile profile: prevent long display names/);
  assert.match(css,/\.komi-media-hub \.komi-profile-v2 \.komi-profile-tabs/);
  assert.match(css,/--hub-hero-radius/);
  assert.match(css,/KomiAnime — black & white UI theme/);
  assert.match(html,/rel="preconnect" href="https:\/\/fonts.gstatic.com"/);
});
