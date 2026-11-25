'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const handler = require('../api/catalog');
const root = path.join(__dirname, '..');
const config = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
const sample = [{shikimori_id: 52991, data: {
  title: 'Провожающая в последний путь Фрирен', year: 2023, type: 'Сериал',
  shikiRating: 9.25, episodeCount: 28, genres: ['Приключения', 'Фэнтези'],
  poster: 'https://shikimori.io/uploads/poster/animes/52991/dc841cc9fce2aa1e9907a4b61c5d1d92.jpeg'
}}];
function response() {
  return {statusCode: 200, headers: {}, body: '',
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    end(body) { this.body = body || ''; }};
}
async function withRows(rows, run) {
  const original = global.fetch;
  const calls = [];
  global.fetch = async (url, options) => {
    calls.push({url: new URL(url), options});
    return {ok: true, status: 200, json: async () => rows};
  };
  try { await run(calls); } finally { global.fetch = original; }
}

test('catalog response contains crawlable links and its own metadata before JavaScript', async () => {
  await withRows(sample, async calls => {
    const res = response();
    await handler({method: 'GET', url: '/catalog', query: {}}, res);
    assert.equal(res.statusCode, 200);
    assert.match(res.headers['cache-control'], /s-maxage=1800/);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url.pathname, '/rest/v1/komi_catalog_cards');
    assert.equal(calls[0].url.searchParams.get('select'), 'shikimori_id,data');
    assert.equal(calls[0].url.searchParams.get('limit'), '48');
    assert.ok(calls[0].options.headers.apikey);
    assert.match(res.body, /<title>Каталог аниме — сериалы и фильмы \| KomiAnime<\/title>/);
    assert.match(res.body, /<link rel="canonical" href="https:\/\/komianime.online\/catalog">/);
    assert.match(res.body, /<meta property="og:url" content="https:\/\/komianime.online\/catalog">/);
    assert.match(res.body, /<meta name="robots" content="index, follow, max-image-preview:large">/);
    assert.equal((res.body.match(/<link rel="canonical"/g) || []).length, 1);
    const main = res.body.split('<main id="mainContainer">')[1].split('</main>')[0];
    assert.match(main, /<h1 id="komiCatalogSeoTitle">Каталог аниме<\/h1>/);
    assert.match(main, /href="\/anime\/52991"/);
    assert.match(main, /class="komi-catalog-card-grid"/);
    assert.match(main, /class="komi-discovery-poster"/);
    assert.match(main, /class="komi-discovery-rating"/);
    assert.match(main, /<small>2023 · Сериал · 28 сер\.<\/small>/);
    assert.doesNotMatch(main, /anime-poster-box|komi-card-hover-ui/);
    assert.match(main, /Провожающая в последний путь Фрирен/);
    assert.doesNotMatch(main, /komi-static-storefront|komi-home-hero|<template/);
    assert.match(res.body, /src="(?:\.\/|\/)?app-main\.js/);
    const schema = JSON.parse(res.body.match(/<script id="komi-catalog-schema" type="application\/ld\+json">([^<]+)<\/script>/)[1]);
    assert.equal(schema['@type'], 'CollectionPage');
    assert.equal(schema.url, 'https://komianime.online/catalog');
    assert.equal(schema.isPartOf.url, 'https://komianime.online/');
    assert.equal(schema.mainEntity, undefined, 'Hydrated card order must not leave a stale ItemList in head');
    assert.doesNotMatch(JSON.stringify(schema), /ItemList|itemListElement/);
  });
});

test('people and search crawlers receive the same catalog document', async () => {
  await withRows(sample, async () => {
    const human = response(), crawler = response();
    await handler({method: 'GET', url: '/catalog', query: {}, headers: {'user-agent': 'Mozilla/5.0'}}, human);
    await handler({method: 'GET', url: '/catalog', query: {}, headers: {'user-agent': 'Googlebot'}}, crawler);
    assert.equal(human.body, crawler.body);
    assert.deepEqual(human.headers, crawler.headers);
  });
});

test('filter and search state stays outside the search index and database query', async () => {
  await withRows(sample, async calls => {
    for (const query of [{genre: 'Драма'}, {q: 'cat"/><script>alert(1)</script>'}, {page: '999999'}, {hide: '1'}]) {
      const res = response();
      await handler({method: 'GET', url: '/catalog?' + new URLSearchParams(query), query}, res);
      assert.equal(res.statusCode, 200);
      assert.equal(res.headers['x-robots-tag'], 'noindex, follow');
      assert.match(res.body, /name="robots" content="noindex, follow"/);
      assert.doesNotMatch(res.body, /id="komi-catalog-schema"/);
      assert.doesNotMatch(res.body, /<script>alert\(1\)<\/script>/);
    }
    assert.ok(calls.every(call => call.url.search === calls[0].url.search));
  });
});

test('catalog data cannot inject executable markup or unsafe images', async () => {
  await withRows([{shikimori_id: 42, data: {
    title: '<img src=x onerror=alert(1)> & "<script>unsafe()</script>',
    type: '</span><script>alert(2)</script>', genres: ['<svg onload=alert(3)>'],
    poster: 'javascript:alert(4)', shikiRating: '101', episodeCount: '-1'
  }}, {shikimori_id: '../private', data: {title: 'Invalid'}}], async () => {
    const res = response();
    await handler({method: 'GET', query: {}}, res);
    assert.equal(res.statusCode, 200);
    assert.doesNotMatch(res.body, /<img src=x|<script>unsafe|<script>alert|src="javascript:|href="\/anime\/\.\.\//);
    assert.match(res.body, /href="\/anime\/42"/);
    assert.match(res.body, /src="\/anime-artwork.svg"/);
    assert.doesNotMatch(res.body, /Оценка Shikimori: 101/);
  });
});

test('HEAD exposes metadata headers without a response body and writes are rejected', async () => {
  await withRows(sample, async calls => {
    const head = response();
    await handler({method: 'HEAD', query: {}}, head);
    assert.equal(head.statusCode, 200);
    assert.equal(head.body, '');
    const post = response();
    await handler({method: 'POST', query: {}}, post);
    assert.equal(post.statusCode, 405);
    assert.equal(post.headers.allow, 'GET, HEAD');
    assert.equal(calls.length, 1);
  });
});

test('empty and unavailable catalogs do not become indexable soft errors', async () => {
  await withRows([], async () => {
    const empty = response();
    await handler({method: 'GET', query: {}}, empty);
    assert.equal(empty.statusCode, 503);
    assert.equal(empty.headers['x-robots-tag'], 'noindex');
    assert.equal(empty.headers['cache-control'], 'no-store');
    assert.equal(empty.headers['retry-after'], '120');
  });
  const original = global.fetch;
  global.fetch = async () => { throw new Error('Upstream unavailable'); };
  try {
    const res = response();
    await handler({method: 'HEAD', query: {}}, res);
    assert.equal(res.statusCode, 503);
    assert.equal(res.body, '');
  } finally { global.fetch = original; }
});

test('deployment makes only the populated catalog indexable and packages its source shell', () => {
  assert.ok(config.rewrites.some(rule => rule.source === '/catalog' && rule.destination === '/api/catalog'));
  assert.ok(!config.headers.some(rule => rule.source === '/catalog' && rule.headers.some(header => /noindex/.test(header.value))));
  assert.equal(config.functions['api/catalog.js'].includeFiles, 'index.html');
  assert.ok(config.headers.some(rule => rule.missing?.some(condition => condition.type === 'host')
    && rule.headers.some(header => /noindex/.test(header.value))));
  for (const route of ['about', 'contacts']) {
    assert.ok(config.rewrites.some(rule => rule.source === '/' + route && rule.destination === '/' + route + '.html'));
  }
});

test('sitemap exposes public entry points and preserves stored modification dates', async () => {
  await withRows([{shikimori_id: 42, updated_at: '2026-11-20T08:00:00Z'}], async () => {
    const res = response();
    await require('../api/sitemap')({method: 'GET'}, res);
    assert.equal(res.statusCode, 200);
    for (const route of ['/', '/catalog', '/about', '/contacts']) {
      assert.equal(res.body.split('<loc>https://komianime.online' + route + '</loc>').length - 1, 1);
    }
    assert.match(res.body, /<loc>https:\/\/komianime.online\/anime\/42<\/loc><lastmod>2026-11-20<\/lastmod>/);
  });
});
