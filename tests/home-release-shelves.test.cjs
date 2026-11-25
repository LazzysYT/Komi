'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const releases = require('../home-release-shelves.js');
const core = require('../player-core.js');
const now = Date.parse('2026-11-25T12:00:00Z');
const ago = hours => new Date(now - hours * 3600000).toISOString();
const later = hours => new Date(now + hours * 3600000).toISOString();
const card = overrides => ({id:'42', title:'Аниме', episodeCount:8, episodes:[], syncStatus:'synced',
  lastEpisodeNumber:8, lastEpisodeAddedAt:ago(2), ...overrides});
const selectRecent = list => releases.selectRecent(list, {now, core});

test('recent releases require the bot availability contract, not just a timestamp or count', () => {
  const valid = card();
  const result = selectRecent([valid, card({id:'43',syncStatus:'failed'}), card({id:'44',syncStatus:'no_match'}),
    card({id:'45',syncStatus:undefined}), card({id:'46',lastEpisodeNumber:undefined}),
    card({id:'47',episodeCount:0}), card({id:'48',lastEpisodeAddedAt:later(1)}),
    card({id:'49',lastEpisodeAddedAt:ago(24 * 15)})]);
  assert.deepEqual(result.map(item => item.id), ['42']);
  assert.equal(result[0].number, 8);
  assert.equal(result[0].season, null);
  assert.equal(result[0].href, '/anime/42?episode=8#player');
});

test('hydrated episodes resolve the exact season and source without assuming season one', () => {
  const item = card({episodes:[{season:2,number:8,sources:{Source:'https://media.test/8.m3u8'}}],
    komiDetailsLoaded:true});
  const result = selectRecent([item]);
  assert.equal(result[0].season, 2);
  assert.equal(result[0].href, '/anime/42?season=2&episode=8#player');
});

test('padded detailed episode and season numbers resolve the verified actual source', () => {
  const item = card({komiDetailsLoaded:true,episodes:[
    {season:'02',number:'08',sources:{Broken:'javascript:alert(1)'}},
    {season:'02',number:'08',sources:{Working:'https://media.test/s2/8.m3u8'}},
    {season:'01',number:'08',sources:{Missing:''}}
  ]});
  const result = selectRecent([item]);
  assert.equal(result.length, 1);
  assert.equal(result[0].number, 8);
  assert.equal(result[0].season, 2);
  assert.equal(result[0].href, '/anime/42?season=2&episode=8#player');
  assert.deepEqual(selectRecent([card({komiDetailsLoaded:true,episodes:[
    {season:'02',number:'08',sources:{Broken:'javascript:alert(1)'}}
  ]})]), []);
});

test('loaded data that contradicts the public summary must not claim availability', () => {
  const result = selectRecent([
    card({id:'41', komiDetailsLoaded:true}),
    card({id:'42', episodes:[{season:1,number:7,sources:{Source:'https://media.test/7.mp4'}}]}),
    card({id:'43', episodes:[{season:1,number:8,sources:{Source:'javascript:alert(1)'}}]}),
    card({id:'44', episodes:[{season:1,number:8,sources:{Source:'https://user:pass@media.test/8.mp4'}}]}),
    card({id:'45', episodes:[{season:1,number:8,sources:{Source:'https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'}}]})
  ]);
  assert.deepEqual(result, []);
});

test('an ambiguous number is passed to the player for explicit season selection', () => {
  const episodes = [1,2].map(season => ({season,number:8,sources:{Source:'https://media.test/s'+season+'/8.mp4'}}));
  assert.equal(selectRecent([card({episodes})])[0].href, '/anime/42?episode=8#player');
  assert.equal(selectRecent([card({episodes,lastEpisodeSeason:2})])[0].href,
    '/anime/42?season=2&episode=8#player');
  assert.deepEqual(selectRecent([card({episodes,lastEpisodeSeason:3})]), []);
});

test('recent sorting is descending, deduplicated and bounded', () => {
  const result = releases.selectRecent([card({id:'41',lastEpisodeAddedAt:ago(8)}),
    card({id:'42'}),card({id:'42',lastEpisodeAddedAt:ago(3)}),card({id:'43',lastEpisodeAddedAt:ago(1)})],
    {now,core,limit:2});
  assert.deepEqual(result.map(item => item.id), ['43','42']);
});

test('upcoming requires explicit future schedule dates inside fourteen days', () => {
  const result = releases.selectUpcoming([
    card({id:'41',nextEpisodeAt:later(24),nextEpisodeNumber:9}),
    card({id:'42',nextEpisodeAt:ago(24),nextEpisodeNumber:9}),
    card({id:'43',nextEpisodeAt:later(24*15),nextEpisodeNumber:9}),
    card({id:'44',nextEpisodeAt:'Friday',nextEpisodeNumber:9}),
    card({id:'45',releaseStatus:'ongoing'})
  ], {now});
  assert.deepEqual(result.map(item => item.id), ['41']);
  assert.equal(result[0].href, '/anime/41');
  assert.equal(result[0].number, 9);
});

test('existing live schedule overrides old catalogue metadata without a new network path', () => {
  const list = [card({id:'41',shikimoriId:100,nextEpisodeAt:later(48),nextEpisodeNumber:9}),
    card({id:'42',nextEpisodeAt:later(24),nextEpisodeNumber:4})];
  const schedule = new Map([[100,{at:now+6*3600000,episode:10}]]);
  const result = releases.selectUpcoming(list, {now,schedule});
  assert.deepEqual(result.map(item => item.id), ['41','42']);
  assert.equal(result[0].number, 10);
  assert.equal(result[0].date, now+6*3600000);
});

test('invalid identifiers and malformed episode values cannot produce unsafe watch routes', () => {
  assert.deepEqual(selectRecent([card({id:'../bad'}),card({lastEpisodeNumber:'8<script>'}),
    card({lastEpisodeNumber:-1}),card({lastEpisodeNumber:Infinity})]), []);
  assert.deepEqual(releases.selectUpcoming([card({id:'../bad',nextEpisodeAt:later(2)})], {now}), []);
});

test('release markup escapes catalogue content and defers posters', () => {
  const html = releases.renderRecent({now,core,animeList:[card({title:'<img src=x onerror=alert(1)> & тест'})],
    artwork:()=>'https://media.test/poster.jpg'});
  assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt; &amp; тест'));
  assert.ok(html.includes('data-komi-lazy-src="https://media.test/poster.jpg"'));
  assert.ok(html.includes('src="/anime-artwork.svg"'));
  assert.ok(html.includes('href="/anime/42?episode=8#player"'));
  assert.ok(html.includes('Свежие серии'));
  assert.ok(!html.includes('<img src=x'));
});

test('both release shelves use compact lazy thumbnails and preserve the fallback chain', () => {
  const {cachedPosterUrl} = require('../poster-cache-client.js');
  const original = 'https://shikimori.io/system/animes/original/42.jpg?123';
  const direct = original.replace('/original/', '/preview/');
  const preferred = cachedPosterUrl(direct, 360);
  const item = card({poster:original,nextEpisodeAt:later(24),nextEpisodeNumber:9});
  const requests = [];
  const context = {now,core,animeList:[item],
    artwork:() => { throw new Error('Small release posters must not request hero artwork'); },
    posterSource:anime => {requests.push(anime.id);return {preferred,direct,original};}
  };
  for (const render of [releases.renderRecent, releases.renderUpcoming]) {
    const html = render(context);
    assert.ok(html.includes('data-komi-lazy-src="' + preferred.replace(/&/g, '&amp;') + '"'));
    assert.ok(html.includes('&amp;w=360&amp;output=webp'));
    assert.ok(!html.includes('w=768'));
    assert.ok(html.includes('src="/anime-artwork.svg"'));
    assert.ok(html.includes('data-poster-direct="' + direct + '"'));
    assert.ok(html.includes('data-poster-original="' + original + '"'));
    assert.ok(html.includes('data-komi-onerror="komiCardPosterFallback(this)"'));
  }
  assert.deepEqual(requests, ['42','42']);
});

test('release thumbnail context cannot introduce executable fallback attributes', () => {
  const html = releases.renderRecent({now,core,animeList:[card()],
    posterSource:() => ({preferred:'https://media.test/poster.jpg',direct:'javascript:alert(1)',
      original:'data:text/html,<script>alert(1)</script>'})});
  assert.ok(html.includes('data-komi-lazy-src="https://media.test/poster.jpg"'));
  assert.ok(!html.includes('data-poster-direct'));
  assert.ok(!html.includes('data-poster-original'));
});

test('upcoming copy distinguishes broadcast schedule from dubbed availability', () => {
  const html = releases.renderUpcoming({now,animeList:[card({nextEpisodeAt:later(24),nextEpisodeNumber:9})]});
  assert.ok(html.includes('id="komiHomeUpcoming"'));
  assert.ok(html.includes('По расписанию. Озвучка может появиться позже.'));
  assert.ok(html.includes('href="/anime/42"'));
  assert.ok(!html.includes('#player'));
  assert.ok(html.includes('<time datetime="'));
});

function formatterFixture() {
  const constructions = [];
  let timezone = 'UTC';
  const scope = {Date, module:{exports:{}}, Intl:{DateTimeFormat:function(locale, options) {
    constructions.push({locale, options:{...options}});
    // Simulate the browser's default timezone without changing the test process.
    return new Intl.DateTimeFormat(locale, {...options, timeZone:timezone});
  }}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../home-release-shelves.js'),'utf8'),scope);
  return {api:scope.module.exports, constructions, setTimezone:value=>{timezone=value;}};
}
const datedCards = () => Array.from({length:8},(_,index)=>card({id:String(index+1),
  lastEpisodeAddedAt:ago(index*22+0.5),nextEpisodeAt:later(index*22+0.5),nextEpisodeNumber:9}));

test('release dates match the previous Russian labels and follow timezone changes between renders', () => {
  const fixture = formatterFixture(), context = {now,core,animeList:datedCards()};
  for (const timezone of ['UTC','Europe/Kyiv','America/New_York','Pacific/Kiritimati']) {
    fixture.setTimezone(timezone);
    for (const upcoming of [false,true]) {
      const entries = upcoming ? releases.selectUpcoming(context.animeList,context)
        : releases.selectRecent(context.animeList,context);
      const html = upcoming ? fixture.api.renderUpcoming(context) : fixture.api.renderRecent(context);
      const actual = [...html.matchAll(/<time datetime="([^"]+)">([^<]+)<\/time>/g)]
        .map(match=>({datetime:match[1],label:match[2]}));
      const expected = entries.map(entry=>{
        const date = new Date(entry.date);
        const day = date.toLocaleDateString('ru-RU',{day:'numeric',month:'short',timeZone:timezone});
        const time = upcoming ? ' · '+date.toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit',timeZone:timezone}) : '';
        return {datetime:date.toISOString(),label:(upcoming?'':'Добавлена ')+day+time};
      });
      assert.deepEqual(actual,expected,timezone+(upcoming?' upcoming':' recent'));
    }
  }
  assert.ok(fixture.constructions.every(({options})=>!Object.hasOwn(options,'timeZone')),
    'production must use the viewer’s default timezone');
});

test('each release shelf creates only its needed formatters and empty shelves create none', () => {
  const fixture = formatterFixture(), context = {now,core,animeList:datedCards()};
  fixture.api.renderRecent(context);
  assert.deepEqual(fixture.constructions,[{locale:'ru-RU',options:{day:'numeric',month:'short'}}]);
  fixture.constructions.length=0;
  fixture.api.renderUpcoming(context);
  assert.deepEqual(fixture.constructions,[
    {locale:'ru-RU',options:{day:'numeric',month:'short'}},
    {locale:'ru-RU',options:{hour:'2-digit',minute:'2-digit'}}
  ]);
  fixture.constructions.length=0;
  fixture.api.renderRecent({...context,animeList:[]});
  fixture.api.renderUpcoming({...context,animeList:[]});
  assert.equal(fixture.constructions.length,0);
});

test('unverified recent rows and empty upcoming dates create no storefront widget', () => {
  assert.equal(releases.renderRecent({now,animeList:[card({syncStatus:undefined})]}), '');
  for (const state of [{}, {scheduleLoading:true}, {scheduleError:'Upstream unavailable'}]) {
    assert.equal(releases.renderUpcoming({now,animeList:[],...state}), '');
    assert.equal(releases.renderUpcoming({now,animeList:[
      card({nextEpisodeAt:ago(1)}), card({id:'43',nextEpisodeAt:later(24*15)}),
      card({id:'44',releaseStatus:'ongoing'})
    ],...state}), '');
  }
});

test('a pending refresh keeps confirmed dates and disables only its refresh action', () => {
  const html = releases.renderUpcoming({now,scheduleLoading:true,
    animeList:[card({nextEpisodeAt:later(24),nextEpisodeNumber:9})]});
  assert.match(html,/disabled aria-busy="true"/);
  assert.match(html,/class="komi-home-release-card"/);
  assert.doesNotMatch(html,/Загружаем расписание|Пока нет подтверждённых дат/);
});

test('a failed refresh retains future confirmed dates with recovery beside the data', () => {
  const html = releases.renderUpcoming({now,scheduleError:'Upstream unavailable',
    animeList:[card({nextEpisodeAt:later(24),nextEpisodeNumber:9})]});
  assert.match(html,/class="komi-home-release-card"/);
  assert.match(html,/role="status">Не удалось обновить расписание/);
  assert.match(html,/Показаны последние подтверждённые даты/);
  assert.match(html,/data-komi-onclick="loadKomiEpisodeSchedule\(true\)"/);
  assert.doesNotMatch(html,/disabled|aria-busy|Upstream unavailable/);
});

test('upcoming appears after a matching schedule arrives and disappears when the date expires', () => {
  const animeList = [card({shikimoriId:100})];
  const schedule = new Map();
  assert.equal(releases.renderUpcoming({now,animeList,schedule,scheduleLoading:true}), '');
  schedule.set(100, {at:now+3600000,episode:9});
  assert.match(releases.renderUpcoming({now,animeList,schedule}),/Серия 9/);
  assert.equal(releases.renderUpcoming({now:now+3600000,animeList,schedule}), '');
});

function storefrontFixture() {
  const document = {activeElement:null};
  function node(kind) {
    const element = {kind,children:[],parentNode:null,ownerDocument:document,
      querySelector(selector) {
        const kind = {'#komiHomeUpcoming':'upcoming','.komi-home-browse-footer':'footer',
          '.komi-home-all':'refresh','.komi-home-catalog-link':'catalog'}[selector];
        return this.children.find(child => child.kind === kind) ||
          this.children.map(child => child.querySelector(selector)).find(Boolean) || null;
      },
      contains(target) { return this === target || this.children.some(child => child.contains(target)); },
      insertBefore(child, before) {
        child.remove();
        const index = before ? this.children.indexOf(before) : this.children.length;
        assert.notEqual(index,-1);
        this.children.splice(index,0,child); child.parentNode = this;
      },
      remove() {
        if (!this.parentNode) return;
        this.parentNode.children.splice(this.parentNode.children.indexOf(this),1);
        this.parentNode = null;
      },
      replaceWith(child) { const parent = this.parentNode; parent.insertBefore(child,this); this.remove(); },
      focus(options) { document.activeElement = this; this.focusOptions = options; }
    };
    return element;
  }
  document.createElement = tag => {
    assert.equal(tag,'template');
    return {content:{firstElementChild:null},set innerHTML(html) {
      assert.match(html,/^<section id="komiHomeUpcoming"/);
      const section = node('upcoming'); section.markup = html;
      section.insertBefore(node('refresh'),null);
      this.content.firstElementChild = section;
    }};
  };
  const container = node('storefront'), hero = node('hero'), recent = node('recent'), footer = node('footer');
  const catalog = node('catalog'); footer.insertBefore(catalog,null);
  for (const child of [hero,recent,footer]) container.insertBefore(child,null);
  return {document,container,hero,recent,footer,catalog};
}

test('schedule refresh inserts, updates and removes only its shelf while preserving focus', () => {
  const fixture = storefrontFixture();
  const context = {now,animeList:[card({nextEpisodeAt:later(1),nextEpisodeNumber:9})]};
  assert.equal(releases.updateUpcoming(fixture.container,{now,animeList:[]}),null);
  const first = releases.updateUpcoming(fixture.container,context);
  assert.deepEqual(fixture.container.children.map(child => child.kind),['hero','recent','upcoming','footer']);
  const firstButton = first.querySelector('.komi-home-all'); firstButton.focus();
  const second = releases.updateUpcoming(fixture.container,{...context,scheduleError:'Offline'});
  assert.notEqual(second,first);
  assert.equal(fixture.document.activeElement,second.querySelector('.komi-home-all'));
  assert.deepEqual(fixture.document.activeElement.focusOptions,{preventScroll:true});
  assert.match(second.markup,/Не удалось обновить расписание/);
  assert.equal(releases.updateUpcoming(fixture.container,{...context,now:now+3600000}),null);
  assert.deepEqual(fixture.container.children,[fixture.hero,fixture.recent,fixture.footer]);
  assert.equal(fixture.document.activeElement,fixture.catalog);
  assert.equal(releases.updateUpcoming(null,context),null);
});
