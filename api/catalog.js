'use strict';
// A public HTML entry point for the existing catalog. Everyone receives the
// same shell and links; the normal app enhances it with search and filters.
const fs = require('node:fs');
const path = require('node:path');
const {CANONICAL, html, safeImage, plainText, read, send} = require('./_seo');
const {cachedPosterUrl} = require('../poster-cache-client');

const TITLE = 'Каталог аниме — сериалы и фильмы | KomiAnime';
const DESCRIPTION = 'Каталог KomiAnime: аниме-сериалы, фильмы, OVA и ONA. Ищите по названию, выбирайте жанр и год, смотрите информацию о сериях и сохраняйте тайтлы в свой список.';
const URL = CANONICAL + '/catalog';
let template;

function shell() {
  // Included explicitly in vercel.json. Read after the build has produced its
  // final first-paint stylesheet links; never maintain a second app document.
  if (!template) template = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  return template;
}

function metadata(source, indexable) {
  const robots = indexable ? 'index, follow, max-image-preview:large' : 'noindex, follow';
  let page = source.replace(/<title>[\s\S]*?<\/title>/i, '<title>' + html(TITLE) + '</title>')
    .replace(/<meta\s+name="description"[^>]*>/i, '<meta name="description" content="' + html(DESCRIPTION) + '">')
    .replace(/<link\s+rel="canonical"[^>]*>/i, '<link rel="canonical" href="' + URL + '">');
  for (const [property, value] of [['og:title', TITLE], ['og:description', DESCRIPTION], ['og:url', URL], ['og:site_name', 'KomiAnime']]) {
    page = page.replace(new RegExp('<meta\\s+property="' + property + '"[^>]*>', 'i'), '<meta property="' + property + '" content="' + html(value) + '">');
  }
  for (const [name, value] of [['twitter:title', TITLE], ['twitter:description', DESCRIPTION], ['robots', robots]]) {
    const tag = '<meta name="' + name + '" content="' + html(value) + '">';
    const pattern = new RegExp('<meta\\s+name="' + name + '"[^>]*>', 'i');
    page = pattern.test(page) ? page.replace(pattern, tag) : page.replace('</head>', tag + '\n</head>');
  }
  return page;
}

function card(row) {
  const data = row.data;
  const name = plainText(data.title || data.originalTitle || 'Без названия').slice(0, 180);
  const year = [data.year, data.aired_on, data.airedOn, data.releaseYear]
    .map(value => String(value ?? '').match(/(?:^|\D)((?:19|20)\d{2})(?:\D|$)/)?.[1]).find(Boolean) || '';
  const kind = String(data.type || data.kind || '').toLowerCase();
  const type = ['movie','film','фильм'].includes(kind) ? 'Фильм'
    : kind === 'ova' ? 'OVA' : kind === 'ona' ? 'ONA' : kind === 'special' ? 'Special' : 'Сериал';
  const count = Number.isSafeInteger(Number(data.episodeCount)) && Number(data.episodeCount) > 0 ? Number(data.episodeCount) : 0;
  const score = Number(data.shikiRating);
  const rating = Number.isFinite(score) && score > 0 && score <= 10 ? score.toFixed(1) : '';
  const original = safeImage(data.poster || data.banner);
  const image = cachedPosterUrl(original);
  const metadata = [year, type, count ? count + ' сер.' : ''].filter(Boolean).join(' · ');
  return '<article class="komi-catalog-card"><a class="komi-discovery-card komi-seo-card" href="/anime/' + row.shikimori_id + '" aria-label="Подробнее: ' + html(name) + '">'
    + '<span class="komi-discovery-poster"><img src="' + html(image) + '"'
    + ' width="240" height="360" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer"'
    + (image !== original ? ' data-poster-direct="' + html(original) + '"' : '') + ' data-komi-error="poster-error">'
    + (rating ? '<span class="komi-discovery-rating" aria-label="Оценка Shikimori: ' + rating + '">★ ' + rating + '</span>' : '')
    + '</span><span class="komi-discovery-copy"><strong>' + html(name) + '</strong><small>' + html(metadata) + '</small></span></a></article>';
}

function catalogMarkup(rows) {
  return '<section class="komi-hub-catalog-toolbar komi-catalog-v5" data-komi-ssr-catalog aria-labelledby="komiCatalogSeoTitle">'
    + '<div class="komi-catalog-head-row"><div class="komi-catalog-heading"><h1 id="komiCatalogSeoTitle">Каталог аниме</h1></div></div>'
    + '<p>Аниме-сериалы, фильмы, OVA и ONA в KomiAnime. Откройте карточку, чтобы узнать о тайтле и доступных сериях.</p>'
    + '<noscript><p>Ниже — часть каталога. Включите JavaScript для поиска, фильтров и просмотра всей коллекции.</p></noscript>'
    + '</section><div class="komi-catalog-card-grid" aria-label="Аниме в каталоге">' + rows.map(card).join('') + '</div>';
}

function render(rows, indexable) {
  let page = metadata(shell(), indexable);
  const main = /(<main\s+id="mainContainer"[^>]*>)[\s\S]*?(<\/main>)/i;
  if (!main.test(page)) throw new Error('Catalog app shell is unavailable');
  page = page.replace(main, (_match, open, close) => open + catalogMarkup(rows) + close);
  const schema = {
    '@context': 'https://schema.org', '@type': 'CollectionPage',
    '@id': URL + '#webpage', url: URL, name: TITLE, description: DESCRIPTION, inLanguage: 'ru',
    // The client can sort, filter and expand the visible cards. Describe the
    // collection itself without keeping a stale server-side ItemList in head.
    isPartOf: {'@type': 'WebSite', name: 'KomiAnime', url: CANONICAL + '/'}
  };
  if (indexable) page = page.replace('</head>', '<script id="komi-catalog-schema" type="application/ld+json">'
    + JSON.stringify(schema).replace(/</g, '\\u003c') + '</script>\n</head>');
  return page;
}

module.exports = async function catalogPage(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return send(res, 405, 'text/plain; charset=utf-8', 'Method Not Allowed');
  }
  // Query parameters are the interactive SPA's search and filter state. Do not
  // index unbounded combinations, and do not forward them into a database query.
  const hasQuery = Object.keys(req.query || {}).length > 0 || String(req.url || '').includes('?');
  const indexable = !hasQuery;
  if (!indexable) res.setHeader('X-Robots-Tag', 'noindex, follow');
  try {
    const rows = (await read('komi_catalog_cards', {
      select: 'shikimori_id,data', order: 'shikimori_id.asc', limit: 48
    })).filter(row => /^[1-9][0-9]{0,11}$/.test(String(row.shikimori_id))
      && row.data && typeof row.data === 'object' && !Array.isArray(row.data)).slice(0, 48);
    if (!rows.length) throw new Error('Catalog returned no public entries');
    const page = render(rows, indexable);
    return send(res, 200, 'text/html; charset=utf-8', req.method === 'HEAD' ? '' : page);
  } catch (error) {
    console.error('SEO catalog:', error.message);
    res.setHeader('X-Robots-Tag', 'noindex');
    res.setHeader('Retry-After', '120');
    return send(res, 503, 'text/plain; charset=utf-8', req.method === 'HEAD' ? '' : 'Каталог временно недоступен. Попробуйте обновить страницу позже.');
  }
};
