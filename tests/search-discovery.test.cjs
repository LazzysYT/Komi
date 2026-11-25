'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {metadata} = require('../komi-page-meta');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

test('home identifies the same brand in original HTML, metadata and site-name schema', () => {
  const page = metadata('home', '/', '');
  assert.ok(html.includes('<title>' + page.title + '</title>'));
  assert.ok(html.includes('name="description" content="' + page.description + '"'));
  const json = html.match(/<script type="application\/ld\+json" id="komi-site-schema">([\s\S]*?)<\/script>/);
  assert.ok(json, 'Search engines must receive site-name data before executing scripts');
  const schema = JSON.parse(json[1]);
  assert.equal(schema['@type'], 'WebSite');
  assert.equal(schema.name, 'KomiAnime');
  assert.equal(schema.url, page.canonical);
  assert.ok(schema.alternateName.includes('Коми Аниме'));
  assert.doesNotMatch(html, /Komi Anime Hub/);
});

test('catalog filters do not leave noindex or the wrong canonical on later navigation', () => {
  assert.match(metadata('catalog', '/catalog', '?q=anime').robots, /noindex/);
  assert.equal(metadata('catalog', '/catalog', '?genre=Drama').canonical, 'https://komianime.online/catalog');
  assert.doesNotMatch(metadata('catalog', '/catalog', '').robots, /noindex/);
  assert.doesNotMatch(metadata('home', '/', '').robots, /noindex/);
  assert.equal(metadata('home', '/', '').canonical, 'https://komianime.online/');
  for (const view of ['profile', 'shop', 'partners']) assert.match(metadata(view, '/' + view, '').robots, /noindex/);
});

test('SPA metadata leaves server-rendered anime titles and canonicals alone', () => {
  assert.equal(metadata('home', '/anime/5114', ''), null);
  assert.equal(metadata('home', '/anime/5114', '?episode=2'), null);
});

test('public information links survive SPA main-container replacement and Google verification is preserved', () => {
  const afterMain = html.slice(html.indexOf('</main>') + 7);
  assert.match(afterMain, /class="komi-public-footer"/);
  for (const route of ['/catalog', '/about', '/contacts']) assert.ok(afterMain.includes('href="' + route + '"'));
  assert.equal(fs.readFileSync(path.join(root, 'googleb2a31730acd740a6.html'), 'utf8').trim(), 'google-site-verification: googleb2a31730acd740a6.html');
});
