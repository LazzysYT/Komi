'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'komi-genre-moods.css'),'utf8');
const home=fs.readFileSync(path.join(root,'home-discovery.js'),'utf8');
const moods=fs.readFileSync(path.join(root,'komi-genre-moods.js'),'utf8');
test('mobile four-column dock wins final cascade and preserves destinations',()=>{
  assert.match(html,/komi-genre-moods\.css\?v=20261123-mobilefix-v4/);
  assert.doesNotMatch(html,/komi-mobile-stable\.css/);
  assert.ok(css.includes('Final post-bundle layer'), 'The last stylesheet must contain stable mobile rules');
  assert.match(css,/grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/);
  for(const id of ['sideHomeBtn','sideCatalogBtn','sideListsBtn','notifBellBtn','sideFriendsBtn'])assert.ok(css.includes(id));
  assert.match(css,/safe-area-inset-bottom/);
  assert.match(css,/\.komi-side-account/);
});
test('off-screen mobile shelves defer paint but preserve all collection actions',()=>{
  assert.match(css,/content-visibility: auto/);
  assert.match(home,/list\.slice\(0, 7\)/);
  assert.match(home,/collectionAction\(kind\)/);
  assert.match(moods,/loading="lazy"/);
});
