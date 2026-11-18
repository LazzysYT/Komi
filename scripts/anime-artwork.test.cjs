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
    komiCardPosterSource(source) {
      calls.push(source);
      return {preferred:source||'/anime-artwork.svg'};
    }
  });
  assert.equal(artwork({poster:'https://example.com/poster.jpg'}),'https://example.com/poster.jpg');
  assert.equal(artwork({banner:'https://example.com/banner.jpg',poster:'https://example.com/poster.jpg'}),'https://example.com/banner.jpg');
  assert.equal(artwork({}),'/anime-artwork.svg');
  assert.deepEqual(calls,['https://example.com/poster.jpg','https://example.com/banner.jpg',undefined]);
});
