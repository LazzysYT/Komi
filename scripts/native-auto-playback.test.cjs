const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ux = require('../player-ux.js');
const src = fs.readFileSync(path.join(__dirname,'../player-ux.js'),'utf8');
test('only bounded metadata can define an intro or ending segment',()=>{
  assert.deepEqual(ux.validSegment(5,95,1500),{start:5,end:95});
  assert.equal(ux.validSegment(null,90,1500),null);
  assert.equal(ux.validSegment('oops',90,1500),null);
  assert.equal(ux.validSegment(-2,90,1500),null);
  assert.equal(ux.validSegment(100,80,1500),null);
  assert.equal(ux.validSegment(1,400,1500),null);
  assert.equal(ux.validSegment(100,200,150),null);
  assert.equal(ux.validSegment(10,90,NaN),null);
});
test('only Premium native playback receives automatic OP/ED skip; no iframe playback control',()=>{
  assert.match(src,/KomiPremium\?\.isActiveId\?\.\(context\.authId\)/);
  assert.match(src,/if \(video\) \{/);
  assert.match(src,/context\.autoNext && context\.hasNext/);
  assert.match(src,/if \(active !== context \|\| !video\.isConnected\) return/);
  assert.match(src,/root\.openWatchModal\(context\.animeId, context\.season, context\.index \+ 1\)/);
});
