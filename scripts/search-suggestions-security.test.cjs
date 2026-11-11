const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const start=html.indexOf('function komiSearchSuggestion(');
const end=html.indexOf('        function selectAnimeFromSearch(id)',start);
assert.ok(start>=0&&end>start,'Search functions not found');
const section=html.slice(start,end);
test('search suggestions use textContent and event listeners, never HTML or inlined IDs',()=>{
 assert.match(section,/document\.createElement\('button'\)/);
 assert.match(section,/addEventListener\('click'/);
 assert.match(section,/name\.textContent = String\(anime\.title/);
 assert.match(section,/poster\.src = komiSafeUrl\(anime\.poster\)/);
 assert.doesNotMatch(section,/\.innerHTML\s*=/);
 assert.doesNotMatch(section,/onclick=["']/);
 assert.doesNotMatch(section,/\$\{anime\.id\}/);
});
test('clearing search closes dropdown and discards prior suggestions',()=>{
 assert.match(section,/dd\.replaceChildren\(\)/);
 assert.match(section,/dd\.classList\.remove\('active'\)/);
});
