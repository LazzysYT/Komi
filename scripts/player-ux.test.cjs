const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {seekTarget,validSegment,watchedStorageKey}=require('../player-ux.js');
const root=path.join(__dirname,'..');
test('native seek targets respect media bounds, not external embed',()=>{
  assert.equal(seekTarget(10,10,1200),20);
  assert.equal(seekTarget(535,10,540),539);
  assert.equal(seekTarget(5,-10,1200),0);
  assert.equal(seekTarget(0,10,Number.NaN),10);
  assert.equal(seekTarget('n/a',10,1200),0);
});
test('intro ranges must be explicit, finite and within the current media',()=>{
  assert.deepEqual(validSegment('12','88',1200),{start:12,end:88});
  assert.deepEqual(validSegment(0,90,1200),{start:0,end:90});
  for (const start of [null,undefined,'',' ',false,true,Infinity,-1]) {
    assert.equal(validSegment(start,90,1200),null);
  }
  for (const end of [null,undefined,' ',true,1,212,1201]) {
    assert.equal(validSegment(1,end,1200),null);
  }
  assert.equal(validSegment(0,100,NaN),null);
});
test('watched marker storage is account-scoped and absent for guests',()=>{
  assert.equal(watchedStorageKey('','123'),'');
  assert.equal(watchedStorageKey('account-a','123'),'komi_viewed_episodes_v1:account-a:123');
  assert.notEqual(watchedStorageKey('account-a','123'),watchedStorageKey('account-b','123'));
});
test('the real watch modal mounts controls without changing stored episode data',()=>{
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const app=fs.readFileSync(path.join(root,'app-main.js'),'utf8');
  const ux=fs.readFileSync(path.join(root,'player-ux.js'),'utf8');
  assert.match(html,/<script defer src="\.\/player-runtime\.js(?:\?v=[\w-]+)?"><\/script>\s*<script defer src="\.\/player-ux\.js(?:\?v=[\w-]+)?"><\/script>/);
  assert.match(app,/bindKomiPlayer\(String\(anime\.id\), activeSeason, activeIndex, activeUrl, progressIndex, watchOptions\?\.playNative === true, currentEp\.slots\[0\]\);/);
  assert.match(app,/window\.KomiPlayerUX\?\.mount\(\{/);
  assert.match(app,/localStorage\.getItem\('komi_source_' \+ anime\.id\)/);
  assert.match(app,/class="komi-episode-number-grid"/);
  assert.match(ux,/video\.addEventListener\('ended', \(\) => \{\s*if \(root\.KomiWatchStats\?\.completion\?\.\(video\)\) markCurrentWatched/);
  assert.match(ux,/event\.pointerType !== 'touch'/);
  assert.match(ux,/event\.key\.toLowerCase\(\) === 'n'/);
});
