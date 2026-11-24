'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'app-main.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const boot = fs.readFileSync(path.join(root, 'komi-home-boot.js'), 'utf8');
new vm.Script(app);
new vm.Script(boot);
for (const id of ['notifBellBtn', 'komiFriendsMyTab', 'notifDropdown']) {
  assert.match(html, new RegExp('id="' + id + '"[^>]*hidden'));
}
assert.match(html, /data-komi-mobile-extra="notifications" hidden/);
assert.match(html, /app-main\.js\?v=20261124-v8-stability4/);
assert.match(html, /komi-home-boot\.js\?v=20261124-v8-stability1/);
assert.equal((html.match(/class="anime-card komi-seo-card"/g) || []).length, 36);
assert.doesNotMatch(html, /Добавить \/ Редактировать аниме/);
assert.match(boot, /setTimeout\(finish, 5000\)/);
assert.match(app, /limit\(pageSize\)\.abortSignal\(controller.signal\)/);
assert.match(app, /nextId <= lastId/);
assert.match(app, /clearTimeout\(requestTimer\)/);
assert.match(app, /control.hidden = !authenticated/);
const randomStart = app.indexOf('function randomAnimeWithAnimation()');
const randomEnd = app.indexOf('\n            playSound();', randomStart);
assert.ok(randomStart >= 0 && randomEnd > randomStart);
const emptyBranch = app.slice(randomStart, randomEnd) + '\n}';
function testEmpty(failed, complete, pending) {
  let calls = 0;
  const classes = new Set(['is-loading']);
  const modalClasses = new Set();
  const retry = {hidden:true}, img = {style:{opacity:'0'}}, title = {};
  const map = {
    rouletteImage: img, rouletteTitle: title, rouletteRetry: retry,
    rouletteContainer: {classList: {remove: k => classes.delete(k)}},
    randomRouletteModal: {classList:{add:k => modalClasses.add(k)}},
    komiRouletteMood: {value:'all'}
  };
  const ctx = vm.createContext({
    document:{getElementById:k=>map[k]},
    animeList:[], komiRandomPlayableAnime:()=>[], komiRouletteRun:0,
    catalogInitialLoadComplete:complete, catalogInitialLoadFailed:failed,
    komiCatalogLoadPending:pending, loadDataFromCloud:()=>{calls++;},
    setTimeout:()=>{throw Error('Empty roulette must not schedule auto-close');}
  });
  vm.runInContext(emptyBranch + '\nrandomAnimeWithAnimation();', ctx);
  assert.equal(retry.hidden,false);
  assert.equal(img.style.opacity,'1');
  assert.equal(classes.has('is-loading'),false);
  assert.equal(modalClasses.has('active'),true);
  assert.equal(calls, !complete && !pending ? 1 : 0);
  assert.match(title.textContent, failed&&!complete ? /Не удалось/ : complete ? /Пока нет/ : /загружается/);
}
testEmpty(false,false,false);
testEmpty(false,false,true);
testEmpty(true,false,false);
testEmpty(false,true,false);
const hero = fs.readFileSync(path.join(root, 'hero-hd-art.js'), 'utf8');
const community = fs.readFileSync(path.join(root, 'komi-community.js'), 'utf8');
new vm.Script(hero);
new vm.Script(community);
assert.match(hero, /setTimeout\(\(\) => controller.abort\(\), 6000\)/);
assert.match(hero, /signal: controller.signal/);
assert.match(hero, /retryAfter.set\(id, Date.now\(\) \+ 60000\)/);
assert.match(hero, /if \(!stillActive\(\)\) return/);
assert.doesNotMatch(html, /<script[^>]+src="[^"]*komi-(?:import|wrapped)\.js/);
assert.match(community, /featureScripts.has\(name\)/);
assert.match(community, /button.isConnected&&owner\(\)===uid/);
assert.match(community, /featureButton\('Импорт списков','KomiImport'/);
assert.match(community, /featureButton\('Anime Wrapped','KomiWrapped'/);
console.log('V8 stability checks passed (syntax, guest markup, static SEO, timeout and empty roulette).');

assert.match(app, /if \(!rows.length\) \{\s*catalogRefreshSince = until;\s*return;/);
assert.match(app, /nextId <= lastUpdatedId/);
assert.match(app, /document.hidden \|\| navigator.onLine === false \|\| !catalogInitialLoadComplete/);
assert.equal((html.match(/rel="preconnect" href="https:\/\/wsrv\.nl"/g)||[]).length,1);
