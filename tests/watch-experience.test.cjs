'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const core = require('../player-core');
const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
const app = read('app-main.js');
function section(source, start, end) {
  const from = source.indexOf(start), to = source.indexOf(end, from + start.length);
  assert.ok(from >= 0 && to > from, 'Runtime entry points remain available: ' + start);
  return source.slice(from, to);
}
const escape = value => String(value ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const decode = value => value.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');

// Execute the real watch entry point, with media/network/storage boundaries
// stubbed. HTML output is captured only to expose the real select and handlers.
function watchFixture(episodes, options = {}) {
  const elements = new Map(); const storage = new Map(); const mounts = []; const bindings = []; const comments = []; const saved = [];
  let markup = '', frame = null, lastNote = null;
  function node(id, attrs = '') {
    const classes = new Set(); const attributes = new Map(); const listeners = new Map();
    for (const attr of attrs.matchAll(/([\w-]+)="([^"]*)"/g)) attributes.set(attr[1], decode(attr[2]));
    const item = {
      id, isConnected: true, value: '', hidden: /\bhidden\b/.test(attrs), textContent: '', dataset: {},
      classList: { contains: value => classes.has(value), add: value => classes.add(value), remove: value => classes.delete(value) },
      addEventListener: (type, callback) => listeners.set(type, callback),
      fire: type => listeners.get(type)?.(),
      setAttribute: (key, value) => attributes.set(key, String(value)),
      getAttribute: key => attributes.get(key) ?? null,
      removeAttribute: key => attributes.delete(key),
      focus() { this.focused = true; }, scrollIntoView() { this.scrolled = true; },
      querySelector: () => null, querySelectorAll: () => []
    };
    return item;
  }
  const modal = node('watchModal'); const content = node('watchModalContent'); const watchStyle = { media: 'print' };
  elements.set(modal.id, modal); elements.set(content.id, content);
  Object.defineProperty(content, 'innerHTML', {
    get: () => markup,
    set(value) {
      markup = value;
      for (const [id, item] of elements) if (![modal.id, content.id].includes(id)) { item.isConnected = false; elements.delete(id); }
      for (const match of markup.matchAll(/<[^>]+\bid="([^"]+)"[^>]*>/g)) elements.set(match[1], node(match[1], match[0]));
      const source = markup.match(/<select id="komiWatchSourceSelect"[^>]*>([\s\S]*?)<\/select>/)?.[1];
      if (source) {
        const selected = source.match(/<option value="([^"]*)"[^>]*\bselected\b/);
        elements.get('komiWatchSourceSelect').value = selected ? decode(selected[1]) : '';
      }
      if (frame) frame.isConnected = false;
      frame = markup.includes('<iframe') ? node('external-frame') : null;
    }
  });
  content.replaceChildren = () => { content.innerHTML = ''; };
  const context = vm.createContext({
    URL, URLSearchParams, console,
    document: {
      getElementById: id => elements.get(id) || null,
      querySelector: selector => selector === 'link[data-komi-deferred-style="watch"]' ? watchStyle
        : selector === '#watchModalContent .player-wrapper iframe' ? frame : null,
      querySelectorAll: () => []
    },
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)) },
    animeList: [{ id: 5114, title: 'Стальной алхимик', poster: 'https://image.test/poster.jpg', genres: [],
      komiDetailsLoaded: true, komiDetailsLoadedAt: 'ready', komiCardUpdatedAt: 'ready', episodes },
      ...(options.moreAnime || [])],
    siteStats: { views: 0 }, saveData() {}, komiDetailOpenToken: 0, komiWatchSourceIntent: null,
    KomiPlayerCore: core,
    komiAdFreeOnly: () => !!options.strict,
    setKomiAdFreeOnly: enabled => { options.strict = enabled; },
    KOMI_ANIVIBE_LABEL: 'AniVibe · партнёрский',
    komiAniVibeEpisodeSource: async () => options.partnerUrl || '',
    getKomiProgress: () => options.progress || null,
    saveKomiEpisode: (...args) => saved.push(args),
    escapeFriendHtml: escape, cleanAnimeDescription: () => '', animeArtwork: item => item.poster,
    animeDetailsMarkup: () => '', renderAnimeExtras() {},
    location: { origin: 'https://komianime.online', pathname: '/anime/5114', hash: '#player' },
    history: { replaceState: (_state, _title, url) => { context.lastUrl = url; } },
    currentUser: null, _supabase: null, userWatchHistory: {}, userFavorites: {}, userAnimeStatuses: {}, userCustomFolders: {},
    bindKomiPlayer: (...args) => bindings.push(args),
    KomiPlayerUX: { mount(settings) { mounts.push(settings); lastNote = { textContent: '' }; return { note: lastNote }; } },
    KomiComments: { mount: (...args) => comments.push(args) },
    KomiMobileSheets: { ensureWatchDock() {} },
    komiMountFollowButton: async () => {}, activePlayerSource: '',
    changePlayerSource() {}, playSound() {}, createWatchPartyFromAnime() {}, komiFindEpisode() {},
    saveProgress() {}, disposeKomiMedia() {}
  });
  context.window = context;
  vm.runInContext(read('player-source-preferences.js'), context);
  vm.runInContext(section(app, 'function closeWatchModal(', 'const KOMI_ADFREE_ONLY_KEY'), context);
  vm.runInContext(section(app, 'function komiPlayerKind(', 'function restoreKomiVideo('), context);
  vm.runInContext(section(app, 'function komiWatchEpisodePresentation(', '// Follows are stored per verified account'), context);
  return { context, elements, storage, mounts, bindings, comments, saved, modal,
    open: (...args) => context.openWatchModal(5114, ...args),
    get markup() { return markup; }, get note() { return lastNote?.textContent; }, get frame() { return frame; },
    get selected() { return elements.get('komiWatchSourceSelect')?.value; }
  };
}
const ep = (number, sources, season = 1) => ({ number, season, sources });
const embed = number => 'https://embed.example/episode/' + number;
const direct = number => 'https://media.example/episode/' + number + '.mp4';

test('a consciously selected iframe voice stays selected across next/previous and season navigation', async () => {
  const f = watchFixture([
    ep(1, { Voice: embed(1), Direct: direct(1) }), ep(2, { Voice: embed(2), Direct: direct(2) }),
    ep(1, { Voice: embed('s2'), Direct: direct('s2') }, 2)
  ]);
  await f.open(1, 0, 'Voice'); assert.equal(f.selected, 'Voice');
  await f.open(1, 1); assert.equal(f.selected, 'Voice'); assert.equal(f.bindings.at(-1)[3], embed(2));
  await f.open(1, 0); assert.equal(f.selected, 'Voice');
  await f.open(2, 0); assert.equal(f.selected, 'Voice');
  assert.equal(f.storage.size, 0, 'automatic continuity does not rewrite explicit preferences');
  assert.deepEqual(JSON.parse(JSON.stringify(f.comments.at(-1))), [5114, { season: 2, episodeNumber: 1 }]);
});

test('unavailable voice falls back to a valid source with an explanation and no preference write', async () => {
  const f = watchFixture([ep(1, { Voice: embed(1) }), ep(2, { Direct: direct(2) })]);
  await f.open(1, 0, 'Voice'); await f.open(1, 1);
  assert.equal(f.selected, 'Direct'); assert.equal(f.bindings.at(-1)[3], direct(2));
  assert.match(f.note, /Voice.*недоступна.*Direct/); assert.equal(f.storage.size, 0);
});

test('original voice returns after a temporary missing-voice fallback without changing explicit preference', async () => {
  const f = watchFixture([
    ep(1, { Voice: embed(1), Direct: direct(1) }), ep(2, { Direct: direct(2) }),
    ep(3, { Voice: embed(3), Direct: direct(3) })
  ]);
  await f.open(1, 0, 'Voice'); await f.open(1, 1); assert.equal(f.selected, 'Direct');
  await f.open(1, 2); assert.equal(f.selected, 'Voice'); assert.equal(f.bindings.at(-1)[3], embed(3));
  assert.equal(f.note, ''); assert.equal(f.storage.size, 0);
  await f.open(1, 1, 'Direct'); await f.open(1, 2);
  assert.equal(f.selected, 'Direct', 'a new conscious selection replaces the previous intent');
});

test('voice labels with duplicate-source suffixes still match the same studio on the next episode', async () => {
  const f = watchFixture([
    ep(1, { 'Voice (2)': embed(1), Direct: direct(1) }), ep(2, { Voice: embed(2), Direct: direct(2) })
  ]);
  await f.open(1, 0, 'Voice (2)'); await f.open(1, 1);
  assert.equal(f.selected, 'Voice'); assert.equal(f.bindings.at(-1)[3], embed(2));
  assert.equal(f.note, '', 'matching labels must not announce a false unavailable-voice warning');
});

test('initial automatic source selection stays consistent when an old stored iframe ranks behind direct video', async () => {
  const f = watchFixture([
    ep(1, { Voice: embed(1), Direct: direct(1) }), ep(2, { Voice: embed(2), Direct: direct(2) })
  ]);
  f.storage.set('komi_source_5114', 'Voice');
  await f.open(1, 0); assert.equal(f.selected, 'Direct');
  await f.open(1, 1); assert.equal(f.selected, 'Direct');
  assert.equal(f.storage.get('komi_source_5114'), 'Voice');
});

test('continuing ordinary voice never overrides the strict approved-source rule', async () => {
  const options = {};
  const f = watchFixture([ep(1, { Voice: embed(1), 'Без рекламы · Partner': direct(1) })], options);
  await f.open(1, 0, 'Voice'); assert.equal(f.selected, 'Voice');
  options.strict = true; await f.open(1, 0);
  assert.equal(f.selected, 'Без рекламы · Partner');
  assert.equal(f.bindings.at(-1)[3], direct(1));
});

test('closing a title does not carry its visible source into a new watch session', async () => {
  const f = watchFixture([ep(1, { Voice: embed(1), Direct: direct(1) })]);
  await f.open(1, 0, 'Voice'); f.context.closeWatchModal();
  await f.open(1, 0); assert.equal(f.selected, 'Direct');
});

test('full episode mapping preserves all 68 rows, supplemental sources, progress and links', async () => {
  const episodes = Array.from({ length: 68 }, (_, index) => ep(index + 1, index < 64
    ? { Main: direct(index + 1) } : { 'Озвучка STEPonee': embed(index + 1) }));
  episodes.reverse();
  const f = watchFixture(episodes);
  await f.open(1, 0, null, 68);
  assert.equal(f.selected, 'Озвучка STEPonee'); assert.equal(f.bindings.at(-1)[3], embed(68));
  const settings = f.mounts.at(-1);
  assert.equal(settings.index, 67); assert.equal(settings.displayNumber, 68);
  assert.equal(settings.originalIndex, 0, 'Watch Party uses the original source record after sorting');
  assert.equal(settings.episodeSlots.length, 68);
  assert.deepEqual(JSON.parse(JSON.stringify(settings.episodeSlots.flat())), Array.from({ length: 68 }, (_, index) => index));
  assert.equal(settings.episodeMeta.filter(item => item.supplementalLabel).length, 4);
  assert.match(settings.episodeSummary, /64 серии \+ 4 дополнительных/);
  assert.equal(f.context.lastUrl, '/anime/5114?season=1&episode=68#player');
  assert.deepEqual(JSON.parse(JSON.stringify(f.comments.at(-1))), [5114, { season: 1, episodeNumber: 68 }]);
  assert.match(f.markup, /Дополнительный выпуск 68/);
  await f.open(1, 0, null, 64);
  assert.equal(f.mounts.at(-1).hasNext, true, 'additional available releases remain navigable after episode 64');
});

test('supplemental classification is conservative when title, provider or main count differ', () => {
  const f = watchFixture([]);
  const episodes = Array.from({ length: 68 }, (_, index) => ep(index + 1, index < 64
    ? { Main: direct(index + 1) } : { 'Озвучка STEPonee': embed(index + 1) }));
  for (const [id, season, rows] of [[1, 1, episodes], [5114, 2, episodes], [5114, 1, episodes.slice(1)]]) {
    const view = f.context.komiWatchEpisodePresentation(id, season, rows);
    assert.equal(view.summary, ''); assert.ok(view.supplemental.every(value => !value));
    assert.equal(view.mainCount, rows.length);
  }
});

test('recovery starts hidden, manual help reveals it and retry keeps the selected source', async () => {
  const f = watchFixture([ep(1, { Voice: embed(1), Direct: direct(1) })]);
  await f.open(1, 0, 'Voice');
  const recovery = f.elements.get('komiPlayerRecovery'), help = f.elements.get('komiPlayerHelp');
  assert.equal(recovery.hidden, true); assert.equal(help.getAttribute('aria-expanded'), 'false');
  help.fire('click');
  assert.equal(recovery.hidden, false); assert.equal(help.getAttribute('aria-expanded'), 'true');
  assert.match(f.elements.get('komiPlayerStatus').textContent, /реклама/);
  assert.equal(f.elements.get('komiRetryPlayer').focused, true);
  await f.elements.get('komiRetryPlayer').fire('click');
  assert.equal(f.selected, 'Voice'); assert.equal(f.elements.get('komiPlayerRecovery').hidden, true);
});

test('detached media errors cannot reveal recovery on a newer episode', async () => {
  const f = watchFixture([ep(1, { Voice: embed(1) }), ep(2, { Direct: direct(2) })]);
  await f.open(1, 0, 'Voice'); const oldFrame = f.frame;
  await f.open(1, 1); assert.equal(f.elements.get('komiPlayerRecovery').hidden, true);
  oldFrame.fire('error'); assert.equal(f.elements.get('komiPlayerRecovery').hidden, true);
  const video = f.elements.get('animeVideoPlayer');
  f.context.showKomiPlayerError({}); assert.equal(f.elements.get('komiPlayerRecovery').hidden, true);
  f.context.showKomiPlayerError(video);
  assert.equal(video.komiMediaFailed, true); assert.equal(f.elements.get('komiPlayerRecovery').hidden, false);
});

test('compact comments adapter forwards episode context unchanged to the canonical owner', () => {
  const calls = []; const result = { canonical: true };
  const context = vm.createContext({
    document: { addEventListener() {}, getElementById: () => null },
    KomiPlayerUX: { mount: () => null },
    KomiComments: { mount(...args) { calls.push(args); return result; } }
  });
  vm.runInContext(read('komi-watch-compact-v6.js'), context);
  const episode = { season: 2, episodeNumber: 17 };
  assert.equal(context.KomiComments.mount(5114, episode), result);
  assert.equal(calls[0][0], 5114); assert.equal(calls[0][1], episode);
});

test('mobile sheet restores every previous inert value before restoring origin focus', () => {
  const mobile = read('mobile-bottom-sheets.js');
  const content = { inert: false }, alreadyInert = { inert: true };
  const parts = new Map();
  for (const key of ['#komiMobileSheetTitle', '.komi-mobile-sheet-body', '.komi-mobile-sheet-footer'])
    parts.set(key, { textContent: '', replaceChildren() {} });
  const layer = { hidden: true, classList: { add() {}, remove() {} }, querySelector: key => parts.get(key) };
  const parent = { children: [content, alreadyInert], classList: { contains: () => true }, append(node) { this.children.push(node); } };
  const style = { overflow: 'clip', removeProperty(key) { delete this[key]; } };
  let focusCount = 0;
  const origin = { isConnected: true, disabled: false, focus() {
    assert.equal(content.inert, false, 'focus can only return after the content is operable again'); focusCount++;
  } };
  const context = vm.createContext({ mobile: { matches: true }, opened: null,
    createLayer: () => layer, document: { body: { style }, getElementById: () => parent }, requestAnimationFrame() {} });
  vm.runInContext(section(mobile, 'function close(', 'function watchReady('), context);
  const view = context.open('source', 'Озвучка', origin, 'watch');
  assert.ok(view); assert.equal(content.inert, true); assert.equal(alreadyInert.inert, true);
  assert.equal(style.overflow, 'hidden'); assert.equal(layer.hidden, false);
  context.close();
  assert.equal(content.inert, false); assert.equal(alreadyInert.inert, true);
  assert.equal(style.overflow, 'clip'); assert.equal(layer.hidden, true); assert.equal(focusCount, 1);
});

test('selecting the current voice closes the mobile sheet with focus restoration; a new voice dispatches once', async () => {
  const mobile = read('mobile-bottom-sheets.js');
  const options = [{ value: 'A', textContent: 'Voice A' }, { value: 'B', textContent: 'Voice B' }];
  const closes = []; const changed = []; const body = [];
  const select = { value: 'A', options, isConnected: true, dispatchEvent(event) { changed.push([event.type, this.value]); } };
  function element() {
    return { children: [], attrs: {}, listeners: {}, append(child) { this.children.push(child); },
      setAttribute(key, value) { this.attrs[key] = value; }, addEventListener(type, fn) { this.listeners[type] = fn; } };
  }
  const context = vm.createContext({
    watchReady: () => true, leaveFullscreen: async () => {}, close: restore => closes.push(restore),
    open: () => ({ body: { append: value => body.push(value) }, footer: { append() {} }, focus() {} }),
    document: { getElementById: id => id === 'komiWatchSourceSelect' ? select : null, createElement: element },
    Event: class Event { constructor(type) { this.type = type; } }
  });
  vm.runInContext(section(mobile, 'function button(', 'function createLayer(') +
    section(mobile, 'async function openSource(', 'async function openEpisodes('), context);
  await context.openSource({}); body.at(-1).children[0].listeners.click();
  assert.deepEqual(closes, [true]); assert.deepEqual(changed, []);
  await context.openSource({}); body.at(-1).children[1].listeners.click();
  assert.deepEqual(closes, [true, false]); assert.deepEqual(changed, [['change', 'B']]);
});

test('switch teardown saves and clears playback without hiding the watch surface',async()=>{
  const f=watchFixture([ep(1,{Voice:embed(1)}),ep(2,{Voice:embed(2)})]);
  await f.open(1,0,'Voice');
  let hidden=0;
  const remove=f.modal.classList.remove;
  f.modal.classList.remove=value=>{if(value==='active')hidden++;remove(value);};
  await f.open(1,1,'Voice');
  assert.equal(hidden,0);
  assert.equal(f.modal.classList.contains('active'),true);
  assert.equal(f.context.lastUrl,'/anime/5114?season=1&episode=2#player');
  f.context.closeWatchModal();
  assert.equal(hidden,1);
});

test('cold episode request loads a single title before waiting for catalogue pagination',async()=>{
  const calls=[], loaded=[];
  const query=new URLSearchParams({anime:'61469',season:'1',episode:'2'});
  const context=vm.createContext({
    URLSearchParams,location:{search:'?'+query},sessionStorage:{getItem:()=>'',removeItem(){}},
    _supabase:{},animeList:[],
    history:{replaceState(_state,_name,url){calls.push(['route',url]);}},
    ensureKomiAnimeDetails:async anime=>{loaded.push(anime.id);anime.title='ДжоДжо';return anime;},
    openWatchModal:async (...args)=>{calls.push(['watch',...args]);}
  });
  vm.runInContext(section(app,'let komiSeoDeepLinkOpened','let komiCatalogLoadPending'),context);
  context.komiMaybeOpenSeoAnime();
  context.komiMaybeOpenSeoAnime();
  await Promise.resolve();await Promise.resolve();
  assert.deepEqual(loaded,['61469']);
  assert.deepEqual(calls,[['route','/anime/61469?season=1&episode=2#player'],['watch','61469',1,0,null,2]]);
});

test('episode-only release links resolve the real season and never play episode one accidentally', async()=>{
  const f=watchFixture([ep(1,{Voice:embed(1)},1),ep(8,{Voice:embed('s2e8')},2)]);
  await f.open(null,0,'Voice',8);
  assert.equal(f.context.lastUrl,'/anime/5114?season=2&episode=8#player');
  assert.equal(f.mounts[0].displayNumber,8);
  const missing=watchFixture([ep(1,{Voice:embed(1)})]);
  await missing.open(null,0,'Voice',8);
  assert.match(missing.markup,/не нашлось доступного источника/);
  assert.equal(missing.bindings.length,0);
});
test('duplicate numbers across seasons ask the viewer instead of playing an incorrect source', async()=>{
  const f=watchFixture([ep(8,{Voice:embed('s1e8')},1),ep(8,{Voice:embed('s2e8')},2)]);
  await f.open(null,0,'Voice',8);
  assert.match(f.markup,/нескольких сезонах/);
  assert.match(f.markup,/>Сезон 1<\/button>/);
  assert.match(f.markup,/>Сезон 2<\/button>/);
  assert.equal(f.bindings.length,0);
  await f.elements.get('komiEpisodeLinkSeason2').fire('click');
  assert.equal(f.context.lastUrl,'/anime/5114?season=2&episode=8#player');
});

const brokenAlchemyDub = 'https://kodikplayer.com/serial/7884/d5bb968fd3ac83b29b02a5c955166563/720p?season=1&only_episode=true&episode=2';

test('only the observed Alchemist episode 2 embed is excluded, never the studio or catalog record', () => {
  const validSameStudio = brokenAlchemyDub.replace('/7884/', '/9999/');
  const alternateQueryOrder = brokenAlchemyDub.split('?')[0] + '?episode=2&only_episode=true&season=1';
  const sources = {'AniDUB':brokenAlchemyDub,'AniDUB (2)':validSameStudio,'Дубль':alternateQueryOrder,Kodik:embed(2)};
  const exact = {animeId:'5114',season:1,number:2};
  assert.deepEqual(core.watchEpisodeSources(sources, exact), {'AniDUB (2)':validSameStudio,Kodik:embed(2)});
  for (const identity of [{...exact,animeId:'512'}, {...exact,season:2},{...exact,number:3}])
    assert.deepEqual(core.watchEpisodeSources(sources, identity), sources);
  assert.equal(sources.AniDUB, brokenAlchemyDub);
});

test('deep-link episode 2 falls back from the dead player while keeping original episode/Party slots', async () => {
  const f = watchFixture([
    ep(1, {AniDUB:embed(1)}), ep(2, {AniDUB:brokenAlchemyDub}), ep(2,{Альтернатива:embed('alt-2')}),
    ep(3, {AniDUB:embed(3)})
  ], {watchRoute:true});
  await f.open(1, 0, 'AniDUB', 2);
  assert.equal(f.selected,'Альтернатива');
  assert.equal(f.bindings.at(-1)[3],embed('alt-2'));
  assert.equal(f.mounts.at(-1).originalIndex,2,'Party uses the index of the original working record');
  assert.equal(f.mounts.at(-1).originalSource,'Альтернатива');
  assert.deepEqual(JSON.parse(JSON.stringify(f.mounts.at(-1).episodeSlots)),[[0],[1,2],[3]]);
  assert.match(f.note,/AniDUB.*недоступна.*Альтернатива/);
  assert.doesNotMatch(f.markup,/kodikplayer\.com/);
  assert.match(f.markup,/komi-player-support[^>]*>[\s\S]*?id="komiPlayerHelp"/);
  const recovery = f.elements.get('komiPlayerRecovery'), help = f.elements.get('komiPlayerHelp');
  help.fire('click');
  assert.equal(recovery.hidden,false);
  help.fire('click');
  assert.equal(recovery.hidden,true);
  assert.equal(help.getAttribute('aria-expanded'),'false');
  await f.open(1, 2);
  assert.equal(f.selected,'AniDUB','Source intent is restored on the next real episode');
});

test('episode 2 does not mount a broken iframe if there is no supported alternative', async () => {
  const f = watchFixture([ep(1,{AniDUB:embed(1)}),ep(2,{AniDUB:brokenAlchemyDub})]);
  await f.open(1,1,'AniDUB');
  assert.equal(f.selected,'Недоступно');
  assert.equal(f.bindings.at(-1)[3],'');
  assert.equal(f.frame,null);
  assert.match(f.note,/Других доступных источников нет/);
  assert.equal(f.storage.size,0);
});

test('explicit links resolve older catalogue entries whose number comes from “Эпизод 2”',async()=>{
  const f=watchFixture([{season:1,title:'Эпизод 1',sources:{Voice:embed(1)}},
    {season:1,title:'Эпизод 2',sources:{Voice:embed(2)}}]);
  await f.open(1,0,'Voice',2);
  assert.equal(f.bindings[0][3],embed(2));
  assert.equal(f.mounts[0].displayNumber,2);
  assert.equal(f.context.lastUrl,'/anime/5114?season=1&episode=2#player');
  assert.equal(core.episodeNumber({title:'Тайна 2'}),null,'unrelated numbers in a title are not guessed');
});
