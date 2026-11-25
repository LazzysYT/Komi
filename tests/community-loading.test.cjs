'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const app = fs.readFileSync(path.join(__dirname, '../app-main.js'), 'utf8');
const start = app.indexOf('// Community drawer:');
const end = app.indexOf('function handleFriendSearchInput(', start);
assert.ok(start >= 0 && end > start, 'the real community loader and renderer must be present');
const communitySource = app.slice(start, end);

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return {promise, resolve, reject};
}

function fixture({user = {authUserId:'account-a', username:'Alice'}, online = true} = {}) {
  let clock = 0, nextTimer = 0;
  const timers = new Map(), requests = [], elements = new Map();
  const document = {activeElement:null, addEventListener() {},
    getElementById(id) { return elements.get(id) || null; }};
  for (const id of ['komiFriendsDrawerList', 'komiFriendsDrawer', 'komiFriendsBackdrop',
    'sideFriendsBtn', 'komiFriendsSearch', 'komiFriendsAllTab', 'komiFriendsMyTab']) {
    const classes = new Set(), attributes = new Map();
    let markup = '';
    const element = {value:'', children:[], parentNode:null, focusCalls:0,
      get innerHTML() { return markup; },
      set innerHTML(html) {
        // Replacing a focused descendant removes its focus in the real DOM.
        if (document.activeElement !== this && this.contains(document.activeElement))
          document.activeElement = null;
        for (const child of this.children) child.parentNode = null;
        this.children = [];
        markup = html;
        if (html.includes('data-komi-click="friends-retry"')) {
          this.children.push({action:'friends-retry', parentNode:this, focus:element.focus, focusCalls:0});
        }
      },
      querySelector(selector) {
        return selector === '[data-komi-click="friends-retry"]'
          ? this.children.find(child => child.action === 'friends-retry') || null : null;
      },
      setAttribute(name, value) { attributes.set(name, String(value)); },
      getAttribute(name) { return attributes.get(name) ?? null; },
      removeAttribute(name) { attributes.delete(name); },
      focus(options) { document.activeElement = this; this.focusOptions = options; this.focusCalls++; },
      contains(target) {
        for (let node = target; node; node = node.parentNode) if (node === this) return true;
        return false;
      },
      classList:{
        add(name) { classes.add(name); },
        remove(name) { classes.delete(name); },
        contains(name) { return classes.has(name); },
        toggle(name, enabled) { if (enabled) classes.add(name); else classes.delete(name); }
      }
    };
    elements.set(id, element);
  }
  const scope = {AbortController, document, navigator:{onLine:online}, currentUser:user,
    // A historical local profile must never become a guest community result.
    userProfiles:{Admin:{displayName:'Cached Admin', avatar:'https://example.org/admin.png'}},
    protectedFriendSent:{owner:null, names:new Set()}, friendsFor:() => [],
    komiSafeAvatarUrl:url => url || '',
    komiVisibleUsername:(name, profile) => profile.displayName || name,
    openProfile() {}, sendFriendRequest:async () => {},
    setTimeout(callback, delay) {
      const id = ++nextTimer;
      timers.set(id, {callback, at:clock + delay});
      return id;
    },
    clearTimeout(id) { timers.delete(id); },
    _supabase:{from(table) {
      const response = deferred();
      const request = {table, response, signal:null};
      requests.push(request);
      const query = {
        select() { return query; },
        limit() { return query; },
        // Deliberately ignore cancellation in the transport. The application
        // must still leave its loading state when an SDK request stalls.
        abortSignal(signal) { request.signal = signal; return response.promise; }
      };
      return query;
    }}
  };
  scope.window = scope;
  vm.createContext(scope);
  vm.runInContext(communitySource, scope, {filename:'app-main.js:community'});
  return {scope, requests, list:elements.get('komiFriendsDrawerList'), timers,
    names:() => Array.from(scope.komiFriendNames || []),
    advance(milliseconds) {
      const until = clock + milliseconds;
      for (;;) {
        const due = [...timers].filter(([, timer]) => timer.at <= until)
          .sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        clock = due[1].at;
        timers.delete(due[0]);
        due[1].callback();
      }
      clock = until;
    }
  };
}

const profile = (username, displayName = username) => ({username, display_name:displayName,
  avatar_url:'https://example.org/' + username + '.png'});
const success = rows => ({data:rows, error:null});

test('guests see a sign-in action immediately without fetching or exposing a cached Admin profile', async () => {
  for (const user of [null, {username:'Guest'}]) {
    const f = fixture({user});
    f.scope.renderFriendsDrawer();
    assert.match(f.list.innerHTML, /Войдите, чтобы видеть друзей и участников сообщества/);
    assert.match(f.list.innerHTML, /data-komi-click="friends-login"/);
    assert.equal(f.list.getAttribute('aria-busy'), 'false');
    await f.scope.loadKomiCommunityProfiles();
    assert.equal(f.requests.length, 0);
    assert.deepEqual(f.names(), []);
    assert.doesNotMatch(f.list.innerHTML, /Admin|Подключаем|Загружаем|friends-retry/);
  }
});

test('a stalled transport reaches an actionable timeout even when it ignores AbortSignal', async () => {
  const f = fixture();
  const loading = f.scope.loadKomiCommunityProfiles();
  assert.equal(f.requests.length, 1);
  assert.equal(f.list.getAttribute('aria-busy'), 'true');
  assert.match(f.list.innerHTML, /Загружаем участников/);
  f.advance(7999);
  assert.equal(f.requests[0].signal.aborted, false);
  assert.equal(f.list.getAttribute('aria-busy'), 'true');
  f.advance(1);
  await loading;
  assert.equal(f.requests[0].signal.aborted, true);
  assert.equal(f.list.getAttribute('aria-busy'), 'false');
  assert.match(f.list.innerHTML, /Не удалось загрузить участников/);
  assert.match(f.list.innerHTML, /data-komi-click="friends-retry"/);
  assert.doesNotMatch(f.list.innerHTML, /Загружаем участников/);
  assert.equal(f.timers.size, 0);
});

test('opening or retrying while a request is pending shares one read and renders its result once available', async () => {
  const f = fixture();
  const first = f.scope.loadKomiCommunityProfiles();
  const second = f.scope.loadKomiCommunityProfiles();
  const third = f.scope.loadKomiCommunityProfiles();
  assert.equal(f.requests.length, 1);
  assert.equal(f.timers.size, 1);
  f.requests[0].response.resolve(success([profile('Alice'), profile('Rin', 'Рин')]));
  await Promise.all([first, second, third]);
  assert.deepEqual(f.names(), ['Rin']);
  assert.match(f.list.innerHTML, /Рин/);
  assert.doesNotMatch(f.list.innerHTML, /Cached Admin|Не удалось|Загружаем участников/);
  assert.equal(f.list.getAttribute('aria-busy'), 'false');
  assert.equal(f.timers.size, 0);
});

test('retry after timeout succeeds and a late response from the timed-out request cannot overwrite it', async () => {
  const f = fixture();
  const first = f.scope.loadKomiCommunityProfiles();
  f.advance(8000);
  await first;
  const retry = f.scope.loadKomiCommunityProfiles();
  assert.equal(f.requests.length, 2);
  assert.equal(f.list.getAttribute('aria-busy'), 'true');
  f.requests[1].response.resolve(success([profile('Rin', 'Рин')]));
  await retry;
  f.requests[0].response.resolve(success([profile('OldResponse')]));
  await Promise.resolve();
  assert.deepEqual(f.names(), ['Rin']);
  assert.match(f.list.innerHTML, /Рин/);
  assert.doesNotMatch(f.list.innerHTML, /OldResponse|Не удалось|friends-retry/);
  assert.equal(f.scope.userProfiles.OldResponse, undefined);
  assert.equal(f.list.getAttribute('aria-busy'), 'false');
});

test('keyboard retry moves focus to the persistent search before replacing the list and preserves it after success', async () => {
  const f = fixture({online:false});
  await f.scope.loadKomiCommunityProfiles();
  const retryButton = f.list.querySelector('[data-komi-click="friends-retry"]');
  const search = f.scope.document.getElementById('komiFriendsSearch');
  assert.ok(retryButton, 'the failure state must expose a retry action');
  retryButton.focus();
  assert.equal(f.scope.document.activeElement, retryButton);
  f.scope.navigator.onLine = true;
  const retry = f.scope.loadKomiCommunityProfiles();
  assert.equal(f.list.getAttribute('aria-busy'), 'true');
  assert.equal(retryButton.parentNode, null, 'the old retry action was removed during loading');
  assert.equal(f.scope.document.activeElement, search);
  assert.equal(search.focusOptions.preventScroll, true);
  assert.equal(search.focusCalls, 1);
  f.requests[0].response.resolve(success([profile('Rin', 'Рин')]));
  await retry;
  assert.match(f.list.innerHTML, /Рин/);
  assert.equal(f.list.getAttribute('aria-busy'), 'false');
  assert.equal(f.scope.document.activeElement, search);
  assert.equal(search.focusCalls, 1, 'finishing a refresh must not steal focus from the persistent input');
});

test('switching accounts aborts the old read and rejects a late old-account response', async () => {
  const f = fixture();
  const oldLoad = f.scope.loadKomiCommunityProfiles();
  f.scope.currentUser = {authUserId:'account-b', username:'Bob'};
  const newLoad = f.scope.loadKomiCommunityProfiles();
  assert.equal(f.requests[0].signal.aborted, true);
  assert.equal(f.requests.length, 2);
  f.requests[1].response.resolve(success([profile('BobFriend')]));
  await newLoad;
  f.requests[0].response.resolve(success([profile('AliceFriend')]));
  await oldLoad;
  assert.deepEqual(f.names(), ['BobFriend']);
  assert.match(f.list.innerHTML, /BobFriend/);
  assert.doesNotMatch(f.list.innerHTML, /AliceFriend|Не удалось/);
  assert.equal(f.scope.userProfiles.AliceFriend, undefined);
  assert.equal(f.list.getAttribute('aria-busy'), 'false');
  assert.equal(f.timers.size, 0);
});

test('an account change before the next render still prevents the previous response from populating profiles', async () => {
  const f = fixture();
  const loading = f.scope.loadKomiCommunityProfiles();
  f.scope.currentUser = {authUserId:'account-b', username:'Bob'};
  f.requests[0].response.resolve(success([profile('AliceFriend')]));
  await loading;
  assert.deepEqual(f.names(), []);
  assert.equal(f.scope.userProfiles.AliceFriend, undefined);
  assert.doesNotMatch(f.list.innerHTML, /AliceFriend|Cached Admin/);
  assert.equal(f.list.getAttribute('aria-busy'), 'false');
});

test('a failed refresh retains only this account’s successfully loaded list and offers retry', async () => {
  const f = fixture();
  const initial = f.scope.loadKomiCommunityProfiles();
  f.requests[0].response.resolve(success([profile('Rin', 'Рин')]));
  await initial;
  const refresh = f.scope.loadKomiCommunityProfiles();
  assert.match(f.list.innerHTML, /Рин/);
  assert.equal(f.list.getAttribute('aria-busy'), 'true');
  f.requests[1].response.resolve({data:null, error:new Error('Server unavailable')});
  await refresh;
  assert.deepEqual(f.names(), ['Rin']);
  assert.match(f.list.innerHTML, /Рин/);
  assert.match(f.list.innerHTML, /Показаны ранее загруженные участники/);
  assert.match(f.list.innerHTML, /role="status"/);
  assert.match(f.list.innerHTML, /data-komi-click="friends-retry"/);
  assert.doesNotMatch(f.list.innerHTML, /Cached Admin|Server unavailable/);
  assert.equal(f.list.getAttribute('aria-busy'), 'false');
  assert.equal(f.timers.size, 0);

  f.scope.currentUser = {authUserId:'account-b', username:'Bob'};
  f.scope.navigator.onLine = false;
  await f.scope.loadKomiCommunityProfiles();
  assert.deepEqual(f.names(), []);
  assert.doesNotMatch(f.list.innerHTML, /Рин|Cached Admin|Показаны ранее загруженные/);
  assert.match(f.list.innerHTML, /Не удалось загрузить участников/);
  assert.equal(f.requests.length, 2);
});

test('signing out during a read immediately clears community names and keeps the guest view after a late response', async () => {
  const f = fixture();
  const loading = f.scope.loadKomiCommunityProfiles();
  f.scope.currentUser = null;
  f.scope.renderFriendsDrawer();
  assert.equal(f.requests[0].signal.aborted, true);
  assert.match(f.list.innerHTML, /data-komi-click="friends-login"/);
  f.requests[0].response.resolve(success([profile('PrivateResult')]));
  await loading;
  assert.deepEqual(f.names(), []);
  assert.doesNotMatch(f.list.innerHTML, /PrivateResult|Admin|Загружаем/);
  assert.equal(f.scope.userProfiles.PrivateResult, undefined);
  assert.equal(f.list.getAttribute('aria-busy'), 'false');
  assert.equal(f.timers.size, 0);
});
