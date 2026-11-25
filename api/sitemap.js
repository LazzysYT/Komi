'use strict';
const {CANONICAL,read,send} = require('./_seo');
const PUBLIC_PAGES = ['/', '/catalog', '/about', '/contacts'];
module.exports = async function sitemap(req,res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow','GET, HEAD');
    return send(res,405,'text/plain; charset=utf-8','Method Not Allowed');
  }
  try {
    // Static pages have no invented current-date lastmod. Catalog record dates
    // below come from the stored update timestamp, not from sitemap requests.
    const entries=PUBLIC_PAGES.map(path=>'<url><loc>'+CANONICAL+path+'</loc></url>');
    const limit=1000;
    for(let offset=0;offset<50000;offset+=limit) {
      const batch=await read('komi_catalog_cards',{
        select:'shikimori_id,updated_at',order:'shikimori_id.asc',limit,offset
      });
      for(const row of batch) {
        if(!Number.isSafeInteger(Number(row.shikimori_id))) continue;
        const id=String(row.shikimori_id);
        if(!/^[1-9][0-9]*$/.test(id)) continue;
        const last=String(row.updated_at||'').slice(0,10);
        entries.push('<url><loc>'+CANONICAL+'/anime/'+id+'</loc>'
          +(/^\d{4}-\d{2}-\d{2}$/.test(last)?'<lastmod>'+last+'</lastmod>':'')+'</url>');
      }
      if(batch.length<limit) break;
    }
    const xml='<?xml version="1.0" encoding="UTF-8"?>'
     +'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
     +entries.join('')+'</urlset>';
    return send(res,200,'application/xml; charset=utf-8',req.method==='HEAD'?'':xml);
  } catch(e) {
    console.error('SEO sitemap:',e.message);
    return send(res,503,'text/plain; charset=utf-8','Sitemap temporarily unavailable');
  }
};
