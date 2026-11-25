'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = name => fs.readFileSync(path.join(__dirname,'..',name),'utf8');
const html = read('index.html');
const js = read('komi-home-boot.js');
const css = read('komi-icon-rail.css');

test('SEO HTML remains indexable, JS shell is isolated and loads before the body', () => {
  assert.match(html,/komi-home-boot\.js\?v=\d{8}-[\w-]+/);
  assert.ok(html.indexOf('komi-home-boot.js') < html.indexOf('<body'));
  const cards=[...html.matchAll(/<a\b[^>]*class="komi-discovery-card komi-seo-card"[^>]*>/g)];
  assert.equal(cards.length,12,'Indexable discovery cards stay available before hydration');
  for(const [card] of cards) assert.match(card,/href="\/anime\/[1-9][0-9]{0,11}"/);
  assert.match(html,/class="komi-boot-shell"/);
  assert.doesNotMatch(html,/href="\/komi-home-boot\.css/);
  assert.match(css,/html\.komi-home-booting[^\n]*\.komi-static-catalog/);
  assert.match(css,/\.komi-boot-shell\s*\{\s*display:\s*none/);
  assert.match(js,/new MutationObserver\(checkReady\)/);
});
test('on reload, leave SEO markup in DOM but reveal the home only after hydration', () => {
  const states = new Set();
  let observer, timer, hydrated=false, detached=false;
  const loaded=[];
  const main = {children:[{}], querySelector(selector) {
    if(selector === '.komi-home-discovery') return hydrated ? {} : null;
    return !hydrated && (selector === '.komi-seo-fallback'||selector === '.komi-seo-card') ? {} : null;
  }};
  const document = {
    documentElement:{classList:{add:(...xs)=>xs.forEach(x=>states.add(x)),remove:(...xs)=>xs.forEach(x=>states.delete(x))}},
    readyState:'loading', head:{}, querySelector:()=>null,
    addEventListener:(name,fn)=>{if(name==='DOMContentLoaded')loaded.push(fn)},
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
  loaded.forEach(fn=>fn());
  assert.ok(observer.started);
  assert.ok(states.has('komi-home-booting'));
  hydrated=true;
  observer.callback();
  assert.ok(!states.has('komi-home-booting'));
  assert.ok(detached);
  timer();
  assert.ok(!states.has('komi-home-booting'));
});
