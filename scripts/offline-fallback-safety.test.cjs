'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const js=fs.readFileSync(path.join(__dirname,'..','app-main.js'),'utf8');
const fallback=js.slice(js.indexOf('let defaultAnime = ['),js.indexOf('let animeList = defaultAnime;'));

test('offline fallback never advertises demo films or a copied Kodik URL as real episodes',()=>{
  assert.ok(fallback.startsWith('let defaultAnime = ['));
  assert.doesNotMatch(fallback,/BigBuckBunny|gtv-videos-bucket|kodik\.info\/serial\/49733/);
  assert.doesNotMatch(fallback,/ratings:\s*\{\s*Admin:/);
  const emptyEpisodes=[...fallback.matchAll(/episodes:\s*\[\]/g)];
  assert.equal(emptyEpisodes.length,3,'All three hardcoded fallback cards must have no fake episodes');
});

test('site initializes optional Web Audio on interaction, never at startup',()=>{
  assert.doesNotMatch(js,/const audioCtx\s*=\s*new\s*\(window\.AudioContext/);
  assert.match(js,/let audioCtx\s*=\s*null/);
  assert.match(js,/if\s*\(!AudioCtor\)\s*return/);
  assert.match(js,/audioCtx\s*=\s*new AudioCtor\(\)/);
});
