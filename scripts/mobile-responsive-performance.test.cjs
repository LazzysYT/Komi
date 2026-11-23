'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'komi-mobile-stable.css'),'utf8');
const home=fs.readFileSync(path.join(root,'home-discovery.js'),'utf8');
const moods=fs.readFileSync(path.join(root,'komi-genre-moods.js'),'utf8');
test('mobile four-column dock wins final cascade and preserves destinations',()=>{
  const genre=html.indexOf('/komi-genre-moods.css?');
  const stable=html.indexOf('/komi-mobile-stable.css?');
  assert.ok(genre>=0&&stable>genre,'Mobile styles must load after legacy navigation overrides');
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
