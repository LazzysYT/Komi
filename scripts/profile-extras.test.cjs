const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8'),window={};
vm.runInNewContext(read('komi-profile-extras-catalog.js'),{window});
const cat=window.KomiExtrasCatalog;
test('60 independently illustrated medals and 16 fixed-price cosmetics match the server catalog',()=>{
 const sql=read('docs/profile-extras-v1.sql');
 assert.equal(cat.medals.length,60);assert.equal(new Set(cat.medals.map(m=>m.id)).size,60);
 for(const rarity of Object.keys(cat.rarities))assert.equal(cat.medals.filter(m=>m.rarity===rarity).length,10);
 const art=new Set();
 for(const m of cat.medals){const svg=read('assets/profile-medals/'+m.id+'.svg');assert.match(svg,/<svg[^>]*viewBox="0 0 120 120"/);assert.doesNotMatch(svg,/<(?:script|image|foreignObject)\b/);art.add(svg);assert.ok(sql.includes("'"+m.id+"','"+m.metric+"',"),m.id);}
 assert.equal(art.size,60);
 assert.equal(cat.products.filter(p=>p.kind==='cursor').length,10);assert.equal(cat.products.filter(p=>p.kind==='effect').length,6);
 for(const p of cat.products){assert.ok(sql.includes("('"+p.id+"','"+p.kind+"',"+p.cost+")"),p.id);if(p.kind==='cursor'){const svg=read('assets/profile-cursors/'+p.art+'.svg');assert.match(svg,/width="32" height="32"/);assert.ok(read('komi-profile-extras.css').includes('/assets/profile-cursors/'+p.art+'.svg'));}}
 assert.match(sql,/security invoker set search_path=''/);assert.match(sql,/expected_cost/);assert.match(sql,/for update;/);
});
test('optional profile, friends and shop integration stays scoped to the logged-in viewer',()=>{
 for(const p of ['komi-profile-extras.js','app-main.js','profile-premium.js','anicoin.js'])assert.doesNotThrow(()=>new vm.Script(read(p),{filename:p}));
 const app=read('app-main.js'),index=read('index.html'),js=read('komi-profile-extras.js'),css=read('komi-profile-extras.css');
 assert.doesNotMatch(index,/<script[^>]*src=["'][^"']*komi-profile-extras(?:-catalog)?\.js\?/);
 assert.ok(index.includes('komi-profile-extras-loader.js?')&&index.indexOf('komi-profile-extras-loader.js?')<index.indexOf('app-main.js?'));
 assert.match(app,/KomiProfileExtras\?\.mountProfile/);assert.match(app,/data-kpe-editor/);assert.match(app,/data-kpe-medals/);
 assert.match(read('anicoin.js'),/KomiProfileExtras\?\.mountShop/);
 assert.match(js,/viewer\(\)===uid/);assert.match(js,/hostname==='komianime.online'/);assert.match(js,/textContent=text/);assert.doesNotMatch(js,/\.innerHTML\s*=/);
 assert.match(css,/prefers-reduced-motion:reduce/);assert.match(css,/pointer:fine/);assert.match(css,/#profile\[data-profile-owner=true\]\[data-profile-preview=false\]/);
});

test('optional loader is inert on home, deduplicates requests and ignores stale profile mounts',async()=>{
 const requests=[],calls=[],win={},doc={createElement:()=>({remove(){}}),head:{append(s){requests.push(s.src);queueMicrotask(()=>{if(s.src.includes('-catalog.js'))win.KomiExtrasCatalog={};else win.KomiProfileExtras={configure:o=>calls.push(['configure',o.getViewer()]),mountProfile:(n,o)=>calls.push(['profile',o.viewer]),mountShop:()=>calls.push(['shop']),decorateFriends:()=>calls.push(['friends'])};s.onload();});}}};
 vm.runInNewContext(read('komi-profile-extras-loader.js'),{window:win,document:doc});
 let uid='a';const proxy=win.KomiProfileExtras;proxy.configure({getViewer:()=>uid});
 await proxy.decorateFriends({querySelector:()=>null});assert.equal(requests.length,0);
 const first=proxy.mountProfile({isConnected:true},{viewer:'a'});uid='b';
 const second=proxy.mountProfile({isConnected:true},{viewer:'b'});await Promise.all([first,second]);
 assert.equal(requests.length,2);assert.deepEqual(calls,[['configure','b'],['profile','b']]);
});

test('catalog normalization yields between batches without losing, duplicating or exposing episode data',async()=>{
 const app=read('app-main.js');const start=app.indexOf('function komiCatalogYield()'),end=app.indexOf('async function komiLoadCatalogPages',start);
 assert.ok(start>=0&&end>start);
 let yields=0;const fn=vm.runInNewContext(app.slice(start,end)+'\nkomiNormalizeCatalogRows',{window:{scheduler:{yield:async()=>{yields++;}}},setTimeout});
 const rows=Array.from({length:288},(_,i)=>({shikimori_id:i+1,data:{title:'Title '+i,genres:['Drama'],episodeCount:12,episodes:[{source:'private'}]},updated_at:'v1'}));
 const out=[];await fn(rows,out);
 assert.equal(out.length,rows.length);assert.equal(yields,3);assert.equal(new Set(out.map(x=>x.id)).size,rows.length);
 assert.ok(out.every(x=>x.episodes.length===0&&x.komiCardUpdatedAt==='v1'));
 const html=read('index.html');assert.match(html,/komi-living-profile\.css\?v=[^"]+" media="print" data-komi-deferred-style="living"/);
});
