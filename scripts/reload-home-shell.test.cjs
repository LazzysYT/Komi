'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = name => fs.readFileSync(path.join(__dirname,'..',name),'utf8');
const html = read('index.html');
const js = read('komi-home-boot.js');
const css = read('komi-home-boot.css');

test('SEO HTML remains indexable, JS shell is isolated and loads before the body', () => {
  assert.match(html,/komi-home-boot\.js\?v=20261123-v1/);
  assert.ok(html.indexOf('komi-home-boot.js') < html.indexOf('<body'));
  assert.match(html,/class="anime-card komi-seo-card"/);
  assert.match(html,/class="komi-boot-shell"/);
  assert.match(css,/html\.komi-home-booting[^\n]*\.komi-static-catalog/);
  assert.match(css,/\.komi-boot-shell\s*\{\s*display:\s*none/);
  assert.match(js,/new MutationObserver\(checkReady\)/);
});
test('on reload, leave SEO markup in DOM but reveal the home only after hydration', () => {
  const states = new Set();
  let loaded, observer, timer, hydrated=false, detached=false;
  const main = {children:[{}], querySelector(selector) {
    if(selector === '.komi-home-discovery') return hydrated ? {} : null;
    return !hydrated && (selector === '.komi-seo-fallback'||selector === '.komi-seo-card') ? {} : null;
  }};
  const document = {
    documentElement:{classList:{add:x=>states.add(x),remove:x=>states.delete(x)}},
    readyState:'loading',
    addEventListener:(name,fn)=>{if(name==='DOMContentLoaded')loaded=fn},
    getElementById:id=>id==='mainContainer'?main:null
  };
  class Observer {
    constructor(callback){this.callback=callback;observer=this}
    observe(){this.started=true}
    disconnect(){detached=true}
  }
  vm.runInNewContext(js,{document,location:{pathname:'/',hash:'',search:''},
    window:{addEventListener(){}},URLSearchParams,MutationObserver:Observer,
    setTimeout:fn=>{timer=fn;return 42},clearTimeout(){}});
  assert.ok(states.has('komi-home-booting'));
  loaded();
  assert.ok(observer.started);
  assert.ok(states.has('komi-home-booting'));
  hydrated=true;
  observer.callback();
  assert.ok(!states.has('komi-home-booting'));
  assert.ok(detached);
  timer();
  assert.ok(!states.has('komi-home-booting'));
});