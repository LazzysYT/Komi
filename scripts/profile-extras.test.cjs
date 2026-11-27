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
 assert.ok(index.indexOf('komi-profile-extras-catalog.js?')<index.indexOf('komi-profile-extras.js?'));
 assert.ok(index.indexOf('komi-profile-extras.js?')<index.indexOf('app-main.js?'));
 assert.match(app,/KomiProfileExtras\?\.mountProfile/);assert.match(app,/data-kpe-editor/);assert.match(app,/data-kpe-medals/);
 assert.match(read('anicoin.js'),/KomiProfileExtras\?\.mountShop/);
 assert.match(js,/viewer\(\)===uid/);assert.match(js,/hostname==='komianime.online'/);assert.match(js,/textContent=text/);assert.doesNotMatch(js,/\.innerHTML\s*=/);
 assert.match(css,/prefers-reduced-motion:reduce/);assert.match(css,/pointer:fine/);assert.match(css,/#profile\[data-profile-owner=true\]\[data-profile-preview=false\]/);
});
