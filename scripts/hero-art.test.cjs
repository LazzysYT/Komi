'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'hero-hd-art.js'), 'utf8');
const home = fs.readFileSync(path.join(__dirname, '..', 'home-discovery.js'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '..', 'komi-media-hub.css'), 'utf8');

test('relative hero stills accept only exact bundled daily paths on the current origin',()=>{
  const daily=require('../komi-home-boot.js');
  const body=source.slice(source.indexOf('  function safeStill(raw)'),source.indexOf('  function safeVideo(raw)'));
  const validator=href=>vm.runInNewContext(body+'\nsafeStill;',{URL,root:{KomiHeroDaily:daily,location:{href}}});
  for(const origin of ['https://komianime.online','http://127.0.0.1:8765']) {
    const safe=validator(origin+'/catalog');
    for(const id of ['61316','61469','61967','60636','59978'])
      assert.equal(safe(daily.artwork(id)),origin+daily.artwork(id));
    const valid=daily.artwork('61316');
    for(const raw of ['/other.webp',valid+'?cache=1',valid+'#frame',valid.replace('61316','61469'),
      valid.replace('f7StpjhGI5xdIecti2jQkQY38ov','unknown'),'//outside.example'+valid,
      '/assets/hero/daily/../'+valid.split('/').at(-1)])
      assert.equal(safe(raw),'',raw+' must not broaden the relative-asset allowlist');
    assert.equal(safe('https://example.test/still.webp'),'https://example.test/still.webp');
    assert.equal(safe('http://example.test/still.webp'),'');
  }
  assert.equal(validator('file:///tmp/index.html')(daily.artwork('61316')),'');
});

function tick() {
  return new Promise(resolve => setImmediate(resolve));
}

async function runFixture({ids = ['52991'], media = [], imageSizes = {}, select = true} = {}) {
  const requests = [];
  const selectors = [];
  const storage = new Map();
  const slides = ids.map(id => {
    const classes = new Set(['hero-slide', 'komi-hd-poster', ...(id===ids[0]?['active']:[])]);
    const events = {};
    const img = {
      dataset: {},
      isConnected: true,
      complete: true,
      naturalWidth: 240,
      naturalHeight: 350,
      get src() { return this._src || 'https://shikimori.io/cover.jpg'; },
      set src(url) {
        this._src = url;
        const sizes = imageSizes[url];
        if (sizes) {
          this.naturalWidth = sizes[0];
          this.naturalHeight = sizes[1];
        }
        queueMicrotask(() => events.load?.());
      },
      addEventListener(name, cb) { events[name] = cb; }
    };
    return {
      img,
      classes,
      dataset: {komiAnimeId: id, komiHeroStill: ''},
      classList: {
        contains(name) { return classes.has(name); },
        toggle(name, enabled) {
          if (enabled) classes.add(name); else classes.delete(name);
        }
      },
      querySelector(selector) {
        return selector === 'img.komi-hub-hero-art' ? img : null;
      }
    };
  });
  class FakeImage {
    set src(url) {
      const sizes = imageSizes[url];
      queueMicrotask(() => {
        if (sizes) {
          this.naturalWidth = sizes[0];
          this.naturalHeight = sizes[1];
          this.onload?.();
        } else this.onerror?.();
      });
    }
  }
  const context = {
    window: {navigator:{},matchMedia:()=>({matches:false})},
    AbortController,
    clearTimeout() {},
    URL,
    Date,
    Promise,
    Image: FakeImage,
    MutationObserver: class { observe() {} },
    sessionStorage: {
      getItem(key) { return storage.get(key) || null; },
      setItem(key, value) { storage.set(key, value); }
    },
    document: {
      hidden:false,
      addEventListener() {},
      getElementById() { return {}; },
      querySelectorAll(selector) {
        selectors.push(selector);
        return selector.endsWith('.active') ? slides.filter(s=>s.classes.has('active')) : slides;
      }
    },
    setTimeout() { return 1; },
    fetch: async (_url, options) => {
      const body = JSON.parse(options.body);
      requests.push(body);
      return {ok:true,json:async()=>({data:{Page:{media}}})};
    }
  };
  vm.runInNewContext(source, context, {filename: 'hero-hd-art.js'});
  if(select) context.window.KomiHeroArt.selectedSlide();
  for (let i = 0; i < 12; i++) await tick();
  return {slides, requests, selectors, storage};
}

test('hero uses one filtered Page query and upgrades a real landscape banner', async () => {
  const banner = 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/123.jpg';
  const result = await runFixture({
    ids: ['52991', '54321'],
    media: [{idMal: 52991, isAdult:false, bannerImage: banner, coverImage:null}],
    imageSizes: {[banner]: [1900, 560]}
  });
  assert.equal(result.requests.length, 1);
  assert.match(result.requests[0].query, /idMal_in:\$ids/);
  assert.deepEqual(Array.from(result.requests[0].variables.ids), [52991]);
  assert.equal(result.slides[0].img.src, banner);
  assert.equal(result.slides[0].classes.has('komi-hd-wide'), true);
  assert.equal(result.slides[0].classes.has('komi-hd-poster'), false);
  assert.equal(result.slides[1].classes.has('komi-hd-poster'), true);
});

test('missing landscape fills hero softly; no false HD upgrade', async () => {
  const badBanner = 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/low.jpg';
  const cover = 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/extraLarge/big.jpg';
  const result = await runFixture({
    media:[{idMal:52991, isAdult:false, bannerImage:badBanner,coverImage:{extraLarge:cover}}],
    imageSizes:{[badBanner]:[650,180],[cover]:[650,960]}
  });
  assert.equal(result.slides[0].img.src, cover);
  assert.equal(result.slides[0].classes.has('komi-hd-wide'), false);
  assert.equal(result.slides[0].classes.has('komi-hd-poster'), true);
});

test('empty AniList response leaves the existing image intact', async () => {
  const result = await runFixture({media:[]});
  assert.equal(result.slides[0].img.src, 'https://shikimori.io/cover.jpg');
  assert.equal(result.slides[0].classes.has('komi-hd-poster'), true);
});

test('CSS encodes full-bleed soft fallback and native HD wide layouts', () => {
  assert.match(home, /hero-slide komi-hd-poster/);
  assert.match(home, /data-komi-anime-id/);
  assert.match(css, /hero-slide\.komi-hd-poster \.komi-hub-hero-art/);
  assert.match(css, /hero-slide\.komi-hd-softwide \.komi-hub-hero-art/);
  assert.match(css, /filter: blur\(14px\)/);
  assert.doesNotMatch(css, /object-fit: scale-down !important/);
  assert.match(css, /hero-slide\.komi-hd-wide \.komi-hub-hero-art/);
  assert.match(css, /object-fit: cover !important/);
});

test('medium native-resolution landscape fills hero with slight softening', async () => {
  const mediumBanner = 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/medium.jpg';
  const result = await runFixture({
    media:[{idMal:52991, isAdult:false, bannerImage:mediumBanner,coverImage:null}],
    imageSizes:{[mediumBanner]:[1050,590]}
  });
  assert.equal(result.slides[0].img.src, mediumBanner);
  assert.equal(result.slides[0].classes.has('komi-hd-softwide'), true);
  assert.equal(result.slides[0].classes.has('komi-hd-poster'), false);
});

test('initial slide remains stable and inactive slides do not request HD artwork',async()=>{
 const result=await runFixture({ids:['52991','54321'],select:false});
 assert.equal(result.requests.length,0);
 assert.equal(result.slides[0].img.src,'https://shikimori.io/cover.jpg');
});
