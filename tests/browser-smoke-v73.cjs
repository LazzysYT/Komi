'use strict';
// Actual Chromium QA of the current checkout, with synthetic catalog/episode data.
// External services are mocked; no production account or payment operations.
const {chromium,devices}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const root=path.resolve(__dirname,'..');
const types={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.webp':'image/webp','.json':'application/json'};
const globalHeaders=JSON.parse(fs.readFileSync(path.join(root,'vercel.json'),'utf8')).headers
 .find(rule=>rule.source==='/(.*)'&&!rule.has&&!rule.missing)?.headers;
const csp=globalHeaders?.find(header=>header.key==='Content-Security-Policy')?.value;
assert.equal(typeof csp,'string','The global production CSP must be applied to the browser fixture');
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');
 const pathname=url.pathname;
 if(pathname.startsWith('/api/')){res.writeHead(200,{'Content-Type':'application/json'});return res.end(JSON.stringify({embedEnabled:false}));}
 const route=['/','/catalog','/shop','/profile','/partners'].includes(pathname)?'/index.html':pathname;
 const file=path.resolve(root,'.'+route);
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end();}
 res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Content-Security-Policy':csp,'Cache-Control':'no-store'});
 fs.createReadStream(file).pipe(res);
});
const rows=Array.from({length:48},(_,i)=>({shikimori_id:900001+i,updated_at:'2026-11-20T00:00:00Z',data:{title:'QA Test '+(i+1),originalTitle:'QA Test '+(i+1),poster:'https://qa-media.invalid/poster.svg',year:'2026',type:'Сериал',genres:['Экшен'],shikiRating:8,episodeCount:2,desc:'Synthetic QA fixture'}}));
const episodes=[1,2].map(number=>({number,season:1,title:'Fixture '+number,preview:'https://qa-media.invalid/frame'+number+'.svg',duration:18,sources:{'Тест A':'https://qa-media.invalid/a.mp4','Тест B':'https://qa-media.invalid/b.mp4'}}));
const json=(route,body)=>route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,OPTIONS','access-control-expose-headers':'content-range'},body:JSON.stringify(body)});
async function installFixtures(context,origin){
 await context.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url());
  if(url.origin===origin) return route.continue();
  if(url.hostname==='cdn.jsdelivr.net'&&url.pathname.includes('@supabase/supabase-js@'))return route.continue();
  if(req.method()==='OPTIONS')return route.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,OPTIONS'}});
  if(url.hostname.endsWith('.supabase.co')){
   if(url.pathname.endsWith('/komi_catalog_cards')){
    const gt=Number((url.searchParams.get('shikimori_id')||'').replace('gt.',''))||0;
    const data=rows.filter(x=>x.shikimori_id>gt);
    return json(route,data);
   }
   if(url.pathname.endsWith('/anime_catalog')){
    const id=Number((url.searchParams.get('shikimori_id')||'').replace('eq.',''));
    const row=rows.find(x=>x.shikimori_id===id)||rows[0];
    return json(route,{data:{...row.data,episodes}});
   }
   return json(route,[]);
  }
  if(url.hostname==='qa-media.invalid'){
   if(url.pathname.endsWith('.mp4'))return route.fulfill({status:200,contentType:'video/mp4',path:process.env.KOMI_QA_VIDEO,headers:{'access-control-allow-origin':'*'}});
   const color=url.pathname.includes('frame2')?'#2964ae':'#a44949';
   return route.fulfill({status:200,contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="320" height="180" fill="'+color+'"/></svg>'});
  }
  if(url.hostname==='graphql.anilist.co')return json(route,{data:{Page:{airingSchedules:[],pageInfo:{hasNextPage:false}}}});
  if(req.resourceType()==='image')return route.fulfill({status:200,contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="320" height="480"><rect width="320" height="480" fill="#333"/></svg>'});
  return route.abort();
 });
}
async function run(){
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true});
 const failures=[];
 try{
  for(const [name,options] of [['desktop',{viewport:{width:1440,height:900}}],['mobile-390',{...devices['iPhone 13']}],['mobile-360',{viewport:{width:360,height:800},isMobile:true,hasTouch:true,deviceScaleFactor:2}]]){
   const context=await browser.newContext({...options,serviceWorkers:'block'});
   await installFixtures(context,origin);
   const page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   try{
    await page.goto(origin+'/catalog',{waitUntil:'domcontentloaded'});
    const card=page.locator('.anime-card[data-komi-anime-id="900001"]').first();
    await card.waitFor({state:'visible',timeout:45000});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),true,'catalog horizontal overflow');
    // Exercise the real browser DOM, independent of network or media fixtures.
    const reconcile = await page.evaluate(()=>{
      const host=document.createElement('div');
      const markup=(sections)=>'<div class="komi-home-discovery">'+sections.map(([id,body])=>'<section id="'+id+'">'+body+'</section>').join('')+'</div>';
      const api=window.KomiHomeDiscovery;
      api.patch(host,markup([['hero','Public'],['history','Owner A'],['catalog','<button>Open</button>']]),'A');
      const home=host.firstElementChild, hero=home.children[0], history=home.children[1], catalog=home.children[2];
      catalog.dataset.qa='retained';
      api.patch(host,markup([['hero','Public'],['history','Updated A'],['catalog','<button>Open</button>'],['new','Added']]),'A');
      const same=host.firstElementChild===home&&home.children[0]===hero&&home.children[2]===catalog&&catalog.dataset.qa==='retained';
      const updated=home.children[1]!==history&&home.children[1].textContent==='Updated A';
      api.patch(host,markup([['hero','Public'],['history','Owner B'],['catalog','<button>Open</button>']]),'B');
      return {same,updated,isolated:host.firstElementChild!==home&&host.querySelector('#history').textContent==='Owner B'&&!host.querySelector('[data-qa]')};
    });
    assert.deepEqual(reconcile,{same:true,updated:true,isolated:true},'reuse unchanged DOM without crossing account boundary');

    await card.click();
    await page.locator('#watchModal.active').waitFor({state:'visible',timeout:20000});
    if (name.startsWith('mobile')) {
      await page.locator('#watchModal .komi-mobile-watch-episodes').click();
    }
    await page.locator('#watchModal.active .komi-episode-number').first().waitFor({state:'visible',timeout:20000});
    const thumbs=page.locator('#watchModal .komi-episode-thumb-image');
    await thumbs.first().waitFor({state:'visible'});
    await page.waitForFunction(()=>Array.from(document.querySelectorAll('#watchModal .komi-episode-thumb-image')).filter(i=>i.complete&&i.naturalWidth>0).length>=2);
    const urls=await thumbs.evaluateAll(images=>images.map(i=>i.src));
    assert.equal(new Set(urls).size,2,'episode previews must be distinct');
    await page.locator('#watchModal .komi-episode-number[data-episode-number="2"]').click();
    if (name.startsWith('mobile')) {
      await page.locator('#watchModal .komi-mobile-watch-episodes').click();
    }
    await page.locator('#watchModal .komi-episode-number[data-episode-number="2"].active').waitFor();
    await page.locator('#watchModal .komi-episode-view-toggle [data-view="grid"]').click();
    assert.equal(await page.locator('#watchModal .komi-episode-number-grid').evaluate(el=>el.classList.contains('komi-episode-list')),false);
    await page.locator('#watchModal .komi-episode-view-toggle [data-view="list"]').click();
    await page.locator('#watchModal .komi-episode-thumb-image').first().waitFor({state:'visible'});
    if (name.startsWith('mobile')) await page.locator('#watchModal .komi-mobile-sheet-close').click();
    await page.locator('#watchModal .modal-close').first().click();
    assert.equal(await page.locator('#watchModal').evaluate(el=>el.classList.contains('active')),false);
    await page.goto(origin+'/#catalog',{waitUntil:'domcontentloaded'});
    await card.waitFor({state:'visible',timeout:45000});
    await page.goto(origin+'/shop',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>document.documentElement.dataset.komiShopRoute==='true');
    await page.goto(origin+'/partners',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>typeof currentView!=='undefined'&&currentView==='partners');
    await page.goto(origin+'/profile',{waitUntil:'domcontentloaded'});
    const guestProfile=page.locator('#profile.komi-profile-guest');
    await guestProfile.waitFor({state:'visible',timeout:20000});
    assert.equal(await page.locator('#authModal.active').count(),0,
      'Guest profile waits for an explicit sign-in choice');
    await guestProfile.getByRole('button',{name:'Войти в профиль',exact:true}).click();
    await page.locator('#authModal.active').waitFor({state:'visible',timeout:20000});
    assert.deepEqual(errors,[],'uncaught browser errors');
    console.log('PASS '+name+' catalog, routes, episode switching, distinct previews, layout toggles, guest auth');
   }catch(e){failures.push(name+': '+e.message);console.error('FAIL '+name,e.message);}
   finally{await context.close();}
  }
 }finally{await browser.close();server.close();}
 if(failures.length)throw Error(failures.join('\n'));
}
run().catch(e=>{console.error(e);process.exitCode=1;server.close();});
