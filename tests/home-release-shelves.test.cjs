'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
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
  assert.equal(result[0].href, '/anime/42');
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

test('ambiguous multi-season episode numbers lead to details instead of the wrong episode', () => {
  const episodes = [1,2].map(season => ({season,number:8,sources:{Source:'https://media.test/s'+season+'/8.mp4'}}));
  assert.equal(selectRecent([card({episodes})])[0].href, '/anime/42');
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
  assert.ok(html.includes('href="/anime/42"'));
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

test('unverified recent rows disappear and upcoming has an honest retryable empty state', () => {
  assert.equal(releases.renderRecent({now,animeList:[card({syncStatus:undefined})]}), '');
  const empty = releases.renderUpcoming({now,animeList:[]});
  assert.ok(empty.includes('Пока нет подтверждённых дат'));
  assert.ok(empty.includes('data-komi-onclick="loadKomiEpisodeSchedule(true)"'));
  const pending = releases.renderUpcoming({now,animeList:[],scheduleLoading:true});
  assert.ok(pending.includes('disabled aria-busy="true"'));
  assert.ok(pending.includes('Загружаем расписание'));
});
