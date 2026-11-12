const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8') + '\n' + fs.readFileSync(path.join(__dirname,'../app-main.js'),'utf8');
const migration=fs.readFileSync(path.join(root,'supabase/migrations/20261111155000_secure_catalog_admin_and_legacy.sql'),'utf8');
const config=JSON.parse(fs.readFileSync(path.join(root,'vercel.json'),'utf8'));
function mockResponse(){
  return {statusCode:200,headers:{},body:'',setHeader(k,v){this.headers[k]=v},end(s){this.body=s||''}};
}
test('initial DOM exposes real crawlable anime card links without JS',()=>{
  const main=html.split('<main id="mainContainer">')[1].split('</main>')[0];
  const cards=[...main.matchAll(/<a class="anime-card komi-seo-card" href="\/anime\/([0-9]+)"/g)];
  assert.ok(cards.length>=24,'SEO cards missing from original HTML');
  assert.equal(new Set(cards.map(x=>x[1])).size,cards.length,'duplicate anime IDs');
  assert.match(main,/id="anime-grid"/);
  assert.match(html,/function komiMaybeOpenSeoAnime\(\)/);
});
test('Vercel rewrites and sitemap discovery are defined',()=>{
  assert.ok(config.rewrites.some(r=>r.source==='/anime/:id'&&r.destination.includes('/api/anime')));
  assert.ok(config.rewrites.some(r=>r.source==='/sitemap.xml'&&r.destination==='/api/sitemap'));
  assert.match(fs.readFileSync(path.join(root,'robots.txt'),'utf8'),/Sitemap: https:\/\/komianime\.online\/sitemap\.xml/);
});
test('public/legacy writes are revoked and admin membership is not assignable by nickname',()=>{
  assert.match(migration,/revoke insert, update, delete, truncate, trigger, references on public\.animes from anon, authenticated/i);
  assert.match(migration,/grant execute on function public\.komi_is_admin\(\) to authenticated/i);
  assert.match(migration,/revoke all on table public\.komi_admin_members from public, anon, authenticated/i);
  assert.match(migration,/with check \(\(select public\.komi_is_admin\(\)\)\)/i);
  assert.doesNotMatch(html,/const adminList = \[\]/);
  assert.match(html,/await requireServerAdmin\(\)/);
  assert.match(html,/\.from\('anime_catalog'\)/);
  assert.doesNotMatch(html,/\.from\('animes'\)\.upsert\(\{ id: 1/);
});
test('anime SEO handler validates IDs and escapes catalog text',async()=>{
  const handle=require('../api/anime.js');
  const bad=mockResponse();
  await handle({method:'GET',query:{id:'abc'}},bad);
  assert.equal(bad.statusCode,404);
  const previous=global.fetch;
  global.fetch=async(url)=>({
    ok:true,status:200,json:async()=>[{
      shikimori_id:42,
      data:{title:'<img src=x onerror=alert(1)>',desc:'<script>alert(2)</script> Description',
        poster:'javascript:alert(3)',year:'2026',type:'movie',genres:['Drama']}
    }]
  });
  try{
    const res=mockResponse();
    await handle({method:'GET',query:{id:'42'}},res);
    assert.equal(res.statusCode,200);
    assert.match(res.body,/href="https:\/\/komianime\.online\/anime\/42"/);
    assert.doesNotMatch(res.body,/<img src=x onerror=alert/);
    assert.doesNotMatch(res.body,/<script>alert\(2\)<\/script>/);
    assert.doesNotMatch(res.body,/src="javascript:/);
    assert.match(res.body,/application\/ld\+json/);
  }finally{global.fetch=previous;}
});
test('dynamic sitemap publishes a valid URL collection with dates',async()=>{
  const handle=require('../api/sitemap.js');
  const previous=global.fetch;
  let calls=0;
  global.fetch=async()=>{
    calls++;
    return {ok:true,status:200,json:async()=>[
      {shikimori_id:42,updated_at:'2026-11-11T00:00:00Z'},
      {shikimori_id:57,updated_at:'2026-11-11T00:00:00Z'}]};
  };
  try{
    const res=mockResponse();
    await handle({method:'GET'},res);
    assert.equal(res.statusCode,200);
    assert.equal(calls,1);
    assert.match(res.body,/<urlset/);
    assert.match(res.body,/https:\/\/komianime\.online\/anime\/42/);
    assert.match(res.body,/<lastmod>2026-11-11<\/lastmod>/);
  }finally{global.fetch=previous;}
});
