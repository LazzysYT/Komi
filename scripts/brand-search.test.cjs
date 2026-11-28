'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
test('the original homepage identifies the brand and alternative names', () => {
  const html = read('index.html');
  const schema = JSON.parse(html.match(/<script type="application\/ld\+json" id="komi-site-schema">([\s\S]*?)<\/script>/)[1]);
  assert.equal(schema.name, 'KomiAnime');
  assert.equal(schema.url, 'https://komianime.online/');
  for (const name of ['Komi Anime', 'Коми Аниме', 'КомиАниме', 'komianime.online']) assert.ok(schema.alternateName.includes(name));
  assert.match(html.slice(html.indexOf('<footer class="komi-public-footer"')), /Коми Аниме — каталог аниме/);
  assert.match(read('about.html'), /KomiAnime \(Komi Anime, «Коми Аниме»\)/);
});
test('brand sitemap is static, canonical and independently discoverable', () => {
  const robots = read('robots.txt');
  assert.match(robots, /Sitemap: https:\/\/komianime\.online\/sitemap-brand\.xml/);
  assert.match(robots, /Sitemap: https:\/\/komianime\.online\/sitemap\.xml/);
  const xml = read('sitemap-brand.xml');
  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
  assert.deepEqual(urls, ['/', '/catalog', '/about', '/contacts'].map(p => 'https://komianime.online' + p));
  assert.doesNotMatch(xml, /<lastmod>/);
  const cfg = JSON.parse(read('vercel.json'));
  assert.ok(cfg.headers.some(r => r.source === '/sitemap-brand.xml' && r.headers.some(h => h.key === 'Content-Type' && h.value.includes('application/xml'))));
  assert.ok(!cfg.rewrites.some(r => r.source === '/sitemap-brand.xml'));
  assert.ok(cfg.rewrites.some(r => r.source === '/sitemap.xml' && r.destination === '/api/sitemap'));
});
