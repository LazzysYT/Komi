const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

// Small DOM fixture for the public comments API. The query API and asynchronous
// response order are observable; no implementation functions are extracted.
class Node {
  constructor(tag = '', doc) {
    this.tagName = tag.toUpperCase(); this.doc = doc; this.children = [];
    this.parentElement = null; this.dataset = {}; this.attributes = {};
    this.style = {}; this.listeners = {}; this.value = ''; this.disabled = false;
    this.className = ''; this._text = ''; this.scrollHeight = 44;
    this.classList = {
      add: (...items) => { this.className = [...new Set([...this.className.split(/\s+/), ...items])].join(' ').trim(); },
      contains: item => this.className.split(/\s+/).includes(item)
    };
  }
  set textContent(value) { this._text = String(value); this.children = []; }
  get textContent() { return this._text + this.children.map(child => child.textContent).join(''); }
  append(...nodes) {
    for (let child of nodes) {
      if (!(child instanceof Node)) { const text = new Node('', this.doc); text.textContent = child; child = text; }
      child.remove(); child.parentElement = this; this.children.push(child);
    }
  }
  replaceChildren(...nodes) { for (const child of this.children) child.parentElement = null; this.children = []; this._text = ''; this.append(...nodes); }
  remove() { if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(child => child !== this); this.parentElement = null; }
  setAttribute(name, value) { this.attributes[name] = String(value); if (name === 'id') this.id = String(value); }
  getAttribute(name) { return this.attributes[name] ?? null; }
  removeAttribute(name) { delete this.attributes[name]; }
  addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
  fire(type) { for (const fn of this.listeners[type] || []) fn({ preventDefault() {}, target: this }); }
  focus() { this.doc.activeElement = this; }
  scrollIntoView() {}
  matches(selector) {
    if (selector.startsWith('#')) return this.id === selector.slice(1);
    if (selector.startsWith('.')) return this.classList.contains(selector.slice(1));
    if (selector === '[data-comment-thread]') return this.dataset.commentThread !== undefined;
    if (selector === 'button[type="submit"]') return this.tagName === 'BUTTON' && this.type === 'submit';
    return this.tagName === selector.toUpperCase();
  }
  querySelectorAll(selector) {
    const parts = selector.split(/\s+/); const found = [];
    const walk = node => {
      for (const child of node.children) {
        if (child.matches(parts.at(-1))) {
          let ancestor = child.parentElement; let index = parts.length - 2;
          while (ancestor && index >= 0) { if (ancestor.matches(parts[index])) index--; ancestor = ancestor.parentElement; }
          if (index < 0) found.push(child);
        }
        walk(child);
      }
    };
    walk(this); return found;
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  closest(selector) { for (let node = this; node; node = node.parentElement) if (node.matches(selector)) return node; return null; }
}

function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
async function settle() { await new Promise(resolve => setImmediate(resolve)); }
function comment(body, episode = 1, season = 1, id = 1) {
  return { id, anime_id: 5114, season, episode_number: episode, body, user_id: null,
    author_name: 'Зритель', created_at: '2026-11-25T09:00:00Z' };
}
function fixture(options = {}) {
  const document = new Node('document'); document.doc = document;
  document.createElement = tag => new Node(tag, document);
  document.createTextNode = text => { const node = new Node('', document); node.textContent = text; return node; };
  document.getElementById = id => document.querySelector('#' + id);
  const modal = document.createElement('div'); modal.id = 'watchModal'; modal.className = 'active';
  const content = document.createElement('div'); content.id = 'watchModalContent'; modal.append(content); document.append(modal);
  const queries = []; const inserts = [];
  const supabase = { from(table) {
    const request = { table, filters: [], orders: [] };
    const run = () => {
      if (table !== 'komi_comments') return Promise.resolve({ data: [], error: null });
      queries.push(request);
      return Promise.resolve(options.read?.(request) || { data: [], error: null });
    };
    return {
      select(value) { request.select = value; return this; },
      eq(key, value) { request.filters.push(['eq', key, value]); return this; },
      is(key, value) { request.filters.push(['is', key, value]); return this; },
      in(key, value) { request.filters.push(['in', key, value]); return this; },
      gt(key, value) { request.filters.push(['gt', key, value]); return this; },
      order(key, value) { request.orders.push([key, value]); return this; },
      limit(value) { request.limit = value; return run(); },
      insert(value) { inserts.push(value); return Promise.resolve(options.insert?.(value) || { error: null }); },
      delete() { request.delete = true; return this; },
      then(yes, no) { return run().then(yes, no); }
    };
  } };
  const context = { document, window: {}, console: { warn() {}, error() {} },
    currentUser: { authUserId: 'viewer' }, _supabase: supabase, animeComments: options.legacy || {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../komi-comments.js'), 'utf8'), context);
  const section = () => document.getElementById('komiAnimeComments');
  return { document, content, api: context.window.KomiComments, queries, inserts, context, section,
    list: () => section().querySelector('.komi-comments-list').textContent,
    field: () => section().querySelector('textarea'),
    status: () => section().querySelector('.komi-comments-status').textContent,
    switchTo: name => section().querySelectorAll('[data-comment-thread]').find(button => button.dataset.commentThread === name).fire('click'),
    submit: () => section().querySelector('form').fire('submit') };
}

test('episode query is scoped by stable season/number and excludes general, other-episode and legacy text', async () => {
  const f = fixture({ legacy: { 5114: [{ text: 'Старый общий комментарий' }] }, read: () => ({ data: [
    comment('К первой серии'), comment('К другой серии', 2, 1, 2), comment('Общее обсуждение', null, null, 3)
  ], error: null }) });
  f.api.mount(5114, { season: 1, episodeNumber: 1 }); await settle();
  assert.deepEqual(f.queries[0].filters, [['eq', 'anime_id', 5114], ['eq', 'season', 1], ['eq', 'episode_number', 1]]);
  assert.equal(f.queries[0].limit, 50);
  assert.match(f.list(), /К первой серии/);
  assert.doesNotMatch(f.list(), /К другой серии|Общее обсуждение|Старый общий/);
  f.switchTo('general'); await settle();
  assert.deepEqual(f.queries[1].filters, [['eq', 'anime_id', 5114], ['is', 'season', null], ['is', 'episode_number', null]]);
  assert.match(f.list(), /Общее обсуждение/); assert.match(f.list(), /Старый общий/);
  assert.doesNotMatch(f.list(), /К первой серии|К другой серии/);
  assert.match(f.section().querySelector('.komi-comments-episode-label').textContent, /Об аниме/);
  f.switchTo('episode'); await settle();
  assert.equal(f.queries.length, 2); assert.match(f.list(), /К первой серии/);
});

test('slow response for previous episode cannot replace the selected episode discussion', async () => {
  const first = deferred();
  const f = fixture({ read: request => request.filters.some(([_, key, value]) => key === 'episode_number' && value === 1)
    ? first.promise : { data: [comment('Вторая серия', 2)], error: null } });
  f.api.mount(5114, { season: 1, episodeNumber: 1 });
  f.api.mount(5114, { season: 1, episodeNumber: 2 }); await settle();
  assert.match(f.list(), /Вторая серия/);
  first.resolve({ data: [comment('Первая серия')], error: null }); await settle();
  assert.match(f.list(), /Вторая серия/); assert.doesNotMatch(f.list(), /Первая серия/);
  assert.equal(f.section().dataset.scopeKey, '5114:1:2');
});

test('newest refresh wins even when requests address the same episode', async () => {
  const old = deferred(); let count = 0;
  const f = fixture({ read: () => ++count === 1 ? old.promise : { data: [comment('Свежий ответ')], error: null } });
  f.api.mount(5114, { season: 1, episodeNumber: 1 });
  await f.api.refresh(5114, true, { season: 1, episodeNumber: 1 });
  old.resolve({ data: [comment('Устаревший ответ')], error: null }); await settle();
  assert.match(f.list(), /Свежий ответ/); assert.doesNotMatch(f.list(), /Устаревший ответ/);
});

test('posting captures episode identity and does not clear another thread draft', async () => {
  const write = deferred(); const f = fixture({ insert: () => write.promise });
  f.api.mount(5114, { season: 2, episodeNumber: 17 }); await settle();
  f.field().value = 'Мнение о серии'; f.submit();
  assert.equal(f.inserts.length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(f.inserts[0])), {
    anime_id: 5114, season: 2, episode_number: 17, user_id: 'viewer', body: 'Мнение о серии'
  });
  f.switchTo('general'); await settle(); f.field().value = 'Черновик об аниме';
  write.resolve({ error: null }); await settle();
  assert.equal(f.field().value, 'Черновик об аниме');
  assert.doesNotMatch(f.status(), /Комментарий опубликован/);
  f.switchTo('episode'); await settle(); assert.equal(f.field().value, '');
});

test('cooldown or network error preserves text and re-enables submit', async () => {
  const f = fixture({ insert: () => ({ error: { code: 'PT429', message: 'Подожди 10 секунд.' } }) });
  f.api.mount(5114, { season: 1, episodeNumber: 1 }); await settle();
  f.field().value = 'Черновик'; f.submit(); await settle();
  assert.equal(f.field().value, 'Черновик'); assert.equal(f.status(), 'Подожди 10 секунд.');
  assert.equal(f.section().querySelector('button[type="submit"]').disabled, false);
});

test('load failure exposes retry and never falls back to a whole-title thread', async () => {
  let offline = true;
  const f = fixture({ read: () => offline ? { error: { message: 'column missing or network unavailable' } }
    : { data: [comment('Загружено')], error: null } });
  f.api.mount(5114, { season: 1, episodeNumber: 1 }); await settle();
  assert.match(f.status(), /Не удалось загрузить/); assert.equal(f.queries.length, 1);
  offline = false; f.section().querySelector('.komi-comments-retry').fire('click'); await settle();
  assert.match(f.list(), /Загружено/); assert.equal(f.status(), '');
});

test('source-only remount keeps one episode cache and invalid scope never becomes general', async () => {
  const f = fixture({ read: () => ({ data: [comment('Одна серия')], error: null }) });
  f.api.mount(5114, { season: 1, episodeNumber: 1 }); await settle();
  f.api.mount(5114, { season: 1, episodeNumber: 1 }); await settle();
  assert.equal(f.queries.length, 1); assert.match(f.list(), /Одна серия/);
  f.api.mount(5114, { season: 1 }); f.api.mount(5114, { season: 0, episodeNumber: 1 });
  assert.equal(f.section().dataset.scopeKey, '5114:1:1'); assert.equal(f.queries.length, 1);
});

test('general comment timecodes cannot seek the currently playing unrelated episode', async () => {
  const f = fixture({ read: () => ({ data: [comment('Момент 1:23'), comment('Общий таймкод 2:34', null, null, 2)], error: null }) });
  const video = f.document.createElement('video'); video.duration = 600; video.currentTime = 0; f.content.append(video);
  f.api.mount(5114, { season: 1, episodeNumber: 1 }); await settle();
  f.section().querySelector('.komi-comment-timecode').fire('click'); assert.equal(video.currentTime, 83);
  f.switchTo('general'); await settle();
  f.section().querySelector('.komi-comment-timecode').fire('click'); assert.equal(video.currentTime, 83);
  assert.match(f.status(), /Таймкоды доступны в обсуждении выбранной серии/);
});
