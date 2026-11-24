'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const app=fs.readFileSync(path.join(__dirname,'../app-main.js'),'utf8');

test('animeArtwork is defined before the card renderer and reuses the safe poster resolver',()=>{
  const helper=app.match(/        function animeArtwork\(anime\) \{[\s\S]*?\n        \}/);
  assert.ok(helper,'Home discovery and player both require the animeArtwork helper');
  assert.ok(app.indexOf(helper[0])<app.indexOf('function renderCard('));
  const calls=[];
  const artwork=vm.runInNewContext('('+helper[0].trim()+')',{
    // Match the live high-resolution source path, rather than the older
    // preview-thumbnail helper, which is intended only for catalog cards.
    currentView: 'home', window: {},
    komiSafeUrl(source) {
      if (!source || !String(source).startsWith('https://')) return '';
      return String(source);
    },
    komiCachedPosterUrl(source, width) {
      assert.equal(width,768);
      calls.push(source);
      return source;
    }
  });
  assert.equal(artwork({poster:'https://example.com/poster.jpg'}),'https://example.com/poster.jpg');
  assert.equal(artwork({banner:'https://example.com/banner.jpg',poster:'https://example.com/poster.jpg'}),'https://example.com/banner.jpg');
  assert.equal(artwork({banner:'javascript:alert(1)'}),'/anime-artwork.svg');
  assert.equal(artwork({}),'/anime-artwork.svg');
  assert.deepEqual(calls,['https://example.com/poster.jpg','https://example.com/banner.jpg','/anime-artwork.svg','/anime-artwork.svg']);
});
