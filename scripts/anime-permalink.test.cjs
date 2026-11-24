const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const bridge = fs.readFileSync(path.join(root, 'anime-watch-bridge.js'), 'utf8');
const main = fs.readFileSync(path.join(root, 'app-main.js'), 'utf8');
const home = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

function simulateBridge(hash = '', search = '', posterBroken = false) {
  const redirects = [], writes = [], events = new Map(), posterEvents = new Map();
  const storage = new Map();
  const image = {
    complete: posterBroken, naturalWidth: 0, src:'https://example.org/broken.jpg',
    getAttribute(name) { return name === 'src' ? this.src : null; },
    addEventListener(name,fn) { posterEvents.set(name,fn); }
  };
  const location = {
    hash, search,
    replace(url) { redirects.push(url); }
  };
  const document = {
    querySelector(selector) {
      assert.equal(selector, 'meta[name="komi-anime-id"]');
      return { content:'52991' };
    },
    getElementById(id) {
      return id === 'komiSeoPoster' ? image : {textContent:''};
    }
  };
  const ctx = {
    URLSearchParams, location, document, window:{
      location, addEventListener(name,fn){events.set(name,fn)}
    },
    sessionStorage:{
      getItem(key){return storage.get(key)||null;},
      setItem(key,value){writes.push({key,value});storage.set(key,value)}
    }
  };
  vm.runInNewContext(bridge, ctx, {timeout:1000});
  return { redirects,writes,storage,location,events,image,posterEvents };
}

test('SEO detail remains readable and does not open a player without request', () => {
  const run = simulateBridge();
  assert.deepEqual(run.redirects, []);
  assert.equal(run.storage.size, 0);
  assert.ok(run.events.has('hashchange'));
});

test('watch link uses temporary same-tab handoff and canonical player URL', () => {
  const run = simulateBridge('#player');
  assert.deepEqual(run.redirects, ['/?anime=52991']);
  assert.equal(run.storage.size, 0);
  assert.match(bridge, /window\.location\.replace\('\/\?' \+ destination\.toString\(\)\)/);
  assert.match(main, /sessionStorage\.getItem\('komi_watch_deeplink_v1'\)/);
  assert.match(main, /history\.replaceState\(null, '', '\/anime\/' \+ requested \+ \(query\.size \? '\?' \+ query\.toString\(\) : ''\) \+ '#player'\)/);
  assert.doesNotMatch(home, /href="\/\?anime=/);
});

test('clicking watch on an existing detail page via #player triggers handoff', () => {
  const run = simulateBridge();
  run.location.hash = '#player';
  run.events.get('hashchange')();
  assert.deepEqual(run.redirects, ['/?anime=52991']);
  assert.equal(run.storage.size, 0);
});

test('broken SEO poster uses local SVG; no external executable error handler', () => {
  const run = simulateBridge('', '', true);
  assert.equal(run.image.src, '/anime-artwork.svg');
  assert.ok(run.posterEvents.has('error'));
});

test('auth callbacks never point to the SEO-only /anime/:id route', () => {
  assert.doesNotMatch(main, /window\.location\.origin \+ window\.location\.pathname/);
  assert.ok(main.includes("redirectTo: 'https://komianime.online/'"));
  assert.ok(main.includes("emailRedirectTo: 'https://komianime.online/'"));
});

test('episode permalink preserves validated season and episode through handoff',()=>{
 assert.deepEqual(simulateBridge('#player','?season=2&episode=5').redirects,['/?anime=52991&season=2&episode=5']);
 assert.deepEqual(simulateBridge('#player','?season=bad&episode=5').redirects,['/?anime=52991']);
});
