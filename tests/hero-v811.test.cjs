'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const app = fs.readFileSync(path.join(__dirname, '..', 'app-main.js'), 'utf8');

function timerFixture(count = 3) {
  let now = 0, nextTimer = 0, changes = 0, selected = 0, progress = '0%';
  const timers = new Map();
  const state = {paused:false, reduced:false, hidden:false, complete:true};
  const slider = {
    isConnected:true,
    style:{setProperty:(key, value) => {if (key === '--komi-hero-progress') progress = value;}},
    matches:() => state.paused,
    querySelectorAll:() => Array(count).fill({}),
    querySelector:() => ({complete:state.complete, naturalWidth:1920})
  };
  const context = vm.createContext({
    document:{getElementById:() => slider, get hidden() {return state.hidden;}, readyState:'complete'},
    window:{matchMedia:() => ({matches:state.reduced}), KomiHeroArt:{
      isPaused:() => state.paused || state.hidden || state.reduced,
      syncVideos:() => {}, selectedSlide:() => selected++
    }},
    navigator:{}, komiHomeCatalogReady:true, slideInterval:null, currentSlideIndex:0,
    performance:{now:() => now},
    setInterval:cb => {const id = ++nextTimer; timers.set(id, cb); return id;},
    clearInterval:id => timers.delete(id),
    updateHeroSlideView:() => changes++
  });
  const source = app.slice(app.indexOf('function startHeroAutoSlide()'), app.indexOf('function updateHeroSlideView()'));
  vm.runInContext(source + '\nstartHeroAutoSlide();', context);
  return {
    state, slider, timers, context,
    get changes() {return changes;}, get progress() {return progress;}, get selected() {return selected;},
    advance(ticks) {for (let i = 0; i < ticks; i++) {now += 100; for (const cb of [...timers.values()]) cb();}}
  };
}

test('progress and slide use seven seconds of unpaused time', () => {
  const f = timerFixture();
  f.advance(35);
  assert.equal(f.progress, '50.0%');
  f.state.paused = true;
  f.advance(60);
  assert.equal(f.progress, '50.0%');
  assert.equal(f.changes, 0);
  f.state.paused = false;
  f.advance(34);
  assert.equal(f.changes, 0);
  f.advance(1);
  assert.equal(f.changes, 1);
  assert.equal(f.progress, '0%');
});

test('manual selection resets progress without duplicating the timer', () => {
  const f = timerFixture();
  f.advance(30);
  f.context.setSlide(2);
  assert.equal(f.context.currentSlideIndex, 2);
  assert.equal(f.progress, '0%');
  assert.equal(f.timers.size, 1);
  f.advance(69);
  assert.equal(f.changes, 1);
  f.advance(1);
  assert.equal(f.context.currentSlideIndex, 0);
  assert.equal(f.changes, 2);
  f.context.setSlide(-1);
  assert.equal(f.changes, 2);
  f.context.changeSlide(-1);
  assert.equal(f.context.currentSlideIndex, 2);
  assert.equal(f.selected, 2);
});

test('hidden tabs, reduced motion and a loading poster do not accumulate time', () => {
  const f = timerFixture();
  for (const key of ['hidden', 'reduced']) {
    f.state[key] = true;
    f.advance(90);
    f.state[key] = false;
  }
  f.state.complete = false;
  f.advance(90);
  f.state.complete = true;
  assert.equal(f.changes, 0);
  f.advance(70);
  assert.equal(f.changes, 1);
});

test('leaving the home destroys its timer; one or zero slides need no timer', () => {
  const f = timerFixture();
  f.slider.isConnected = false;
  f.advance(1);
  assert.equal(f.timers.size, 0);
  assert.equal(f.context.slideInterval, null);
  assert.equal(timerFixture(0).timers.size, 0);
  assert.equal(timerFixture(1).timers.size, 0);
});

test('hero descriptions are plain text while HTML callers retain escaping', () => {
  const context = vm.createContext({window:{KomiDescription:require('../anime-description.js')},
    escapeFriendHtml:value => value.replace(/&/g, '&amp;').replace(/</g, '&lt;')});
  const source = app.slice(app.indexOf('function cleanAnimeDescriptionText('), app.indexOf('// Shikimori\'s legacy REST image API'));
  vm.runInContext(source, context);
  const text = '[b]Tom & Jerry[/b] <em>возвращаются</em> [character=1]Рем[/c';
  assert.equal(context.cleanAnimeDescriptionText(text), 'Tom & Jerry возвращаются Рем');
  assert.equal(context.cleanAnimeDescription(text), 'Tom &amp; Jerry возвращаются Рем');
});

test('hero metadata uses a small public projection, not full episode payloads', async () => {
  let projection, filteredId, signal;
  const query = {
    select:value => {projection = value; return query;},
    eq:(_key, value) => {filteredId = value; return query;},
    abortSignal:value => {signal = value; return query;},
    maybeSingle:async () => ({data:{description:'Tom & Jerry', banner:'https://example.test/banner.jpg'}, error:null})
  };
  const context = vm.createContext({window:{KomiDescription:require('../anime-description.js')}, _supabase:{from:name => {assert.equal(name, 'anime_catalog'); return query;}},
    AbortController, setTimeout:() => 1, clearTimeout:() => {}, cleanAnimeDescriptionText:value => value});
  const source = app.slice(app.indexOf('window.komiFetchHeroMetadata ='), app.indexOf('function startHeroAutoSlide()'));
  vm.runInContext(source, context);
  const item = await context.window.komiFetchHeroMetadata('61316');
  assert.equal(item.description, 'Tom & Jerry');
  assert.equal(filteredId, 61316);
  assert.equal(signal.aborted, false);
  assert.doesNotMatch(projection, /episodes|\*/);
  assert.match(projection, /banner:data->>banner_url,video:data->>banner_video_url/);
  assert.equal(await context.window.komiFetchHeroMetadata('invalid'), null);
});
