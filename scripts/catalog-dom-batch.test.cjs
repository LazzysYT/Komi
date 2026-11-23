'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'../app-main.js'),'utf8');
test('mobile catalog starts with 24 cards; desktop still uses 48',()=>{
  assert.match(src,/function komiCatalogPageSize\(\)\s*\{[\s\S]*?\? 24 : 48/);
  assert.match(src,/let catalogVisibleCount = komiCatalogPageSize\(\)/);
  assert.match(src,/catalogVisibleCount \+= komiCatalogPageSize\(\)/);
});
test('show more appends instead of replacing existing cards, preserving images',()=>{
  assert.match(src,/komiRefreshCatalogGrid\(previouslyRendered\)/);
  assert.match(src,/function komiRefreshCatalogGrid\(appendFrom = null\)/);
  assert.match(src,/grid\.insertAdjacentHTML\('beforeend'/);
  assert.match(src,/grid\.querySelectorAll\(':scope > \.anime-card'\)/);
});
test('saved mobile catalog positions are capped to avoid thousands of card nodes',()=>{
  assert.match(src,/matches \? 240 : 2400/);
});
