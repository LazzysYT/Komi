'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..');
const src=fs.readFileSync(path.join(root,'komi-public-catalog-cache.js'),'utf8');
const app=fs.readFileSync(path.join(root,'app-main.js'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const env={window:{}};
vm.runInNewContext(src,env);
const cache=env.window.KomiPublicCatalogCache;
test('public catalog snapshot strips sensitive, user-specific and player fields',()=>{
  const original={id:'52991',title:'Anime',year:'2026',genres:['Фэнтези'],
    poster:'https://example.com/poster.jpg',episodeCount:2,
    user_id:'private',profile:{name:'Private'},watchProgress:123,
    token:'secret',episodes:[{sources:{Kodik:'https://example.com/video'}}]};
  const cards=cache.project([original]);
  assert.equal(cards.length,1);
  assert.equal(cards[0].title,'Anime');
  assert.equal(cards[0].episodes.length,0);
  for(const field of ['user_id','profile','watchProgress','token'])assert.equal(cards[0][field],undefined);
});
test('public cache is optional and unavailable storage fails closed',async()=>{
  assert.equal(await cache.read(),null);
  assert.equal(await cache.write([]),false);
  assert.match(html,/komi-public-catalog-cache\.js[^"]*"><\/script>[\s\S]*app-main\.js/);
  assert.match(app,/KomiPublicCatalogCache\.read\(\)/);
  assert.match(app,/KomiPublicCatalogCache\?\.write\(catalog\)/);
  assert.match(app,/if \(!komiHomeCatalogReady/);
});
test('profile index remains account-agnostic and is version invalidated',()=>{
  assert.match(app,/komiProfileAnimeIndexCache\.revision !== komiCatalogRevision/);
  assert.match(app,/new Map\(sharedAnimeIndex\) : sharedAnimeIndex/);
});
