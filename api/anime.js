'use strict';
const {CANONICAL,html,safeImage,plainText,read,send} = require('./_seo');
module.exports = async function animePage(req,res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow','GET, HEAD');
    return send(res,405,'text/plain; charset=utf-8','Method Not Allowed');
  }
  const rawId = String(req.query?.id ?? '');
  if (!/^[1-9][0-9]{0,11}$/.test(rawId)) {
    return send(res,404,'text/plain; charset=utf-8','Аниме не найдено');
  }
  try {
    const rows = await read('anime_catalog', {
      select:'shikimori_id,data,updated_at', shikimori_id:'eq.'+rawId,limit:1
    });
    const row = rows[0];
    if (!row || !row.data || typeof row.data !== 'object') {
      return send(res,404,'text/plain; charset=utf-8','Аниме не найдено');
    }
    const data = row.data;
    const title = plainText(data.title || data.originalTitle || 'Без названия').slice(0,180);
    const description = plainText(data.desc || data.description || '').slice(0,550)
      || ('Информация, постер и серии аниме «'+title+'» в каталоге Komi Anime.');
    const poster = safeImage(data.poster || data.banner);
    const animeUrl = CANONICAL + '/anime/' + rawId;
    const watchUrl = CANONICAL + '/?anime=' + rawId;
    const kind = String(data.type || '').toLowerCase();
    const movie = /movie|фильм/.test(kind);
    const year = /^[0-9]{4}$/.test(String(data.year||'')) ? String(data.year) : '';
    const genres = Array.isArray(data.genres) ? data.genres.slice(0,12).map(plainText).filter(Boolean) : [];
    const count = Array.isArray(data.episodes) ? data.episodes.length : Math.max(0,Number(data.episodeCount)||0);
    const type = movie ? 'Movie' : 'TVSeries';
    const schema = {
      '@context':'https://schema.org','@type':type,name:title,url:animeUrl,
      image:poster.startsWith('https:')?poster:CANONICAL+poster,description
    };
    if (year) schema.datePublished=year;
    if(genres.length) schema.genre=genres;
    const jsonLd = JSON.stringify(schema).replace(/</g,'\\u003c');
    const richTitle = html(title+' — Komi Anime');
    const desc = html(description);
    const page = `<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${richTitle}</title><meta name="description" content="${desc}">
<meta name="robots" content="index,follow"><link rel="canonical" href="${animeUrl}">
<meta property="og:type" content="video.other"><meta property="og:title" content="${richTitle}">
<meta property="og:description" content="${desc}"><meta property="og:url" content="${animeUrl}">
<meta property="og:image" content="${html(poster)}"><meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">${jsonLd}</script>
<style>*,*:before,*:after{box-sizing:border-box}body{margin:0;background:#090909;color:#f2f2f2;font:16px/1.6 system-ui,sans-serif}a{color:inherit}header{padding:22px max(24px,5vw);border-bottom:1px solid #282828}header a{text-decoration:none;font-weight:800;font-size:20px}main{max-width:1080px;margin:52px auto;padding:0 24px;display:grid;grid-template-columns:minmax(180px,300px) 1fr;gap:38px}img{display:block;width:100%;border-radius:18px;background:#1e1e1e;border:1px solid #292929}h1{font-size:clamp(28px,4vw,48px);line-height:1.2;margin:0 0 18px}p{color:#c0c0c0}small{color:#a6a6a6}.actions{display:flex;flex-wrap:wrap;gap:14px;margin:24px 0}.action{display:inline-flex;padding:13px 22px;border:1px solid #444;border-radius:12px;text-decoration:none;font-weight:700;background:#191919}.primary{background:#e6e6e6;color:#111}@media(max-width:650px){main{grid-template-columns:1fr;margin:22px auto}img{max-width:260px}}</style>
</head><body><header><a href="/">Komi Anime</a></header><main>
<div><img src="${html(poster)}" alt="Постер: ${html(title)}" loading="eager" width="300" height="450"></div>
<article><h1>${html(title)}</h1><small>${html([year,movie?'Фильм':'Сериал'].filter(Boolean).join(' · '))}</small>
<p>${desc}</p>
${genres.length?'<p>Жанры: '+genres.map(html).join(', ')+'</p>':''}
${count?'<p>Количество серий: '+Math.floor(count)+'</p>':''}
<nav class="actions" aria-label="Действия"><a class="action primary" href="${watchUrl}">Открыть в Komi Anime</a><a class="action" href="/#catalog">Весь каталог</a></nav>
</article></main></body></html>`;
    return send(res,200,'text/html; charset=utf-8',req.method==='HEAD'?'':page);
  } catch(e) {
    console.error('SEO anime page:',e.message);
    res.setHeader('X-Robots-Tag','noindex');
    return send(res,503,'text/plain; charset=utf-8','Каталог временно недоступен');
  }
};
