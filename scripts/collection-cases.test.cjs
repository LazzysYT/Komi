const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const context={window:{}};vm.runInNewContext(read('komi-collection-art.js'),context);vm.runInNewContext(read('komi-collection.js'),context);
const c=context.window.KomiCollection;
test('catalog unique, no duplicate characters and same IDs in DB',()=>{assert.equal(c.roster.length,27);assert.equal(new Set(c.roster.map(r=>r.id)).size,27);const sql=read('supabase/migrations/20261126193000_komi_collection_cases.sql');for(const ch of c.roster.slice(0,18))assert.ok(sql.includes("'"+ch.id+"'"));assert.match(sql,/unique \(user_id, opened_on\)/);assert.match(sql,/pg_advisory_xact_lock/);assert.match(sql,/enable row level security/);});
test('payload rejects corrupt data and unknown/duplicate IDs',()=>{assert.throws(()=>c.normalizePayload({}));const v=c.normalizePayload({owned:['kaneki','kaneki','fake'],can_open:true,result:'fake'});assert.equal(JSON.stringify(v.owned),'["kaneki"]');assert.equal(v.result,null);assert.equal(v.canOpen,undefined);assert.equal(c.normalizePayload({owned:c.roster.map(x=>x.id),can_open:true}).canOpen,undefined);});
test('route, assets and navigation wiring',()=>{const html=read('index.html');assert.match(html,/id="sideCollectionBtn"/);assert.match(html,/data-komi-mobile-extra="collection"/);assert.ok(html.indexOf('komi-collection.js')<html.indexOf('app-main.js'));assert.ok(JSON.parse(read('vercel.json')).rewrites.some(r=>r.source==='/collection'&&r.destination==='/index.html'));assert.match(read('app-main.js'),/KomiCollection\?\.render/);assert.match(read('komi-collection.css'),/kc-silhouette/);});

test('18 unique silhouette drawings, and locally stored approved artwork',()=>{const art=context.window.KomiCollectionArt;assert.equal(art.ids.length,18);assert.equal(new Set(c.roster.slice(0,18).map(x=>art.silhouette(x.id))).size,18);for(const item of c.roster.slice(0,18)){const s=art.silhouette(item.id);assert.match(s,/<svg/);assert.match(s,/<path/);assert.doesNotMatch(s,/https?:|<image/);}const b=fs.readFileSync(path.join(root,'assets/collection/tokyo-ghoul-case.webp'));assert.equal(b.subarray(0,4).toString(),'RIFF');assert.equal(b.subarray(8,12).toString(),'WEBP');assert.equal(b.length,7044);});

test('paid case is fixed, transactional, idempotent and does not use earned-coin ledger',()=>{const sql=read('supabase/migrations/20261126195000_komi_collection_paid_cases.sql');assert.match(sql,/set balance=balance-50/);assert.match(sql,/where user_id=v_user for update/);assert.match(sql,/collection_paid_request_uidx/);assert.match(sql,/where paid_request_id is null/);assert.match(sql,/paid_cost=50/);assert.match(sql,/security invoker/);assert.match(sql,/revoke all on function public\.komi_collection_buy/);assert.doesNotMatch(sql,/insert into public\.komi_anicoin_ledger/);const result=c.normalizePayload({owned:['kaneki'],can_open:true,balance:50,price:50});assert.equal(result.balance,50);assert.equal(result.price,50);});

test('paid-only release blocks old free action on the server and removes it from UI',()=>{const sql=read('supabase/migrations/20261126195100_komi_collection_paid_only.sql');assert.match(sql,/p_action is distinct from 'read'/);assert.match(sql,/'can_open',false/);assert.doesNotMatch(sql,/\b(?:insert|delete|update)\b/i);const js=read('komi-collection.js');assert.doesNotMatch(js,/бесплатн|раз в день|request\('open'\)/i);assert.match(js,/Купить за 50 AniCoin/);assert.doesNotMatch(read('komi-page-meta.js'),/ежедневный бесплатный кейс/);});

test('R5 rarity grades and reel winner, no client-side payout selection',()=>{const counts={common:6,rare:7,epic:4,legendary:3};for(const [r,n] of Object.entries(counts))assert.equal(c.roster.slice(0,20).filter(x=>x.rarity===r).length,n);const ids=new Set(c.roster.map(x=>x.id));for(const winner of c.roster){const items=c.makeReel(winner.id,[],()=>.42);assert.equal(items.length,29);assert.equal(items[23],winner.id);assert.ok(items.every(x=>ids.has(x)));}assert.match(read('komi-collection.js'),/showReel\(s,payload\)/);assert.match(read('komi-collection.css'),/prefers-reduced-motion/);const vector=read('assets/collection/tokyo-ghoul-case-r5.svg');assert.match(vector,/<svg[^>]*viewBox="0 0 1000 720"/);});


test('all 18 portraits and black cutouts are local WebP, responsive chest has two sizes',()=>{
 const dir=path.join(root,'assets/collection/ghoul-noir');
 for(const rel of ['case-640.webp','case-1200.webp',...c.roster.slice(0,18).flatMap(x=>[x.id+'.webp','locked/'+x.id+'.webp'])]){
  const data=fs.readFileSync(path.join(dir,rel));
  assert.equal(data.toString('ascii',0,4),'RIFF',rel);
  assert.equal(data.toString('ascii',8,12),'WEBP',rel);
  assert.ok(data.length>100&&data.length<(rel.startsWith('case-')?145000:rel.startsWith('locked/')?18000:48000),rel+' '+data.length);
 }
 const js=read('komi-collection.js');assert.doesNotMatch(js,/graphql\.anilist|loadImages/);
 assert.match(js,/opened\?'':'locked\//);
});

test('booster keeps small transparent assets and a matching vector fallback',()=>{
 const dir='assets/collection/ghoul-booster/';
 for (const [width,limit] of [[320,52000],[640,160000]]) {
  const data=fs.readFileSync(path.join(root,dir+'pack-'+width+'.webp'));
  assert.equal(data.toString('ascii',8,12),'WEBP');
  assert.ok(data.length<limit && data.length>100);
  assert.ok(data.includes(Buffer.from('ALPH')) || data.includes(Buffer.from('VP8L')));
 }
 const svg=read(dir+'pack-fallback.svg');
 assert.match(svg,/viewBox="0 0 640 1024"/);
 assert.match(svg,/TOKYO GHOUL/);
 assert.doesNotMatch(svg,/<image|<script/);
 const html=read('index.html');
 const revision=html.match(/<meta name="komi-collection-revision" content="([^"]+)"/)?.[1];
 assert.match(revision,/^\d{8}-collection-[\w-]+$/);
 for(const file of ['komi-collection.css','komi-collection.js','komi-collector-showcase.js']){
  const version=html.match(new RegExp(file.replace('.','\\.')+'\\?v=([^"]+)'))?.[1];
  assert.equal(version,revision,file+' must use the collection revision');
 }
 const appVersion=html.match(/app-main\.js\?v=([^"]+)/)?.[1];
 assert.ok(appVersion.endsWith('-'+revision.replace(/^\d{8}-/,'')));
});

test('new series rosters and presentation match the migration contract',()=>{
 const sql=read('supabase/migrations/20261127080152_komi_collection_series.sql')+read('supabase/migrations/20261127110000_komi_collection_series_expansion.sql')+read('supabase/migrations/20261127143000_komi_collection_second_wave.sql')+read('supabase/migrations/20261127144500_komi_collection_third_wave.sql')+read('supabase/migrations/20261128140830_komi_collection_world_art.sql')+read('supabase/migrations/20261128142835_komi_collection_three_worlds.sql');
 assert.deepEqual(Object.keys(c.seriesList),['ghoul','jujutsu','frieren','alchemist','demon','aot','naruto','bleach','onepiece','chainsaw','hunter','deathnote','heroacademia','sololeveling']);
 assert.equal(c.seriesList.ghoul.roster.length,27);
 const effects=new Set(Object.values(c.ghoulFx).map(x=>x[0]));
 assert.equal(effects.size,24);
 const expandedSizes={naruto:23,bleach:23,onepiece:23,chainsaw:23,hunter:24,deathnote:12,heroacademia:12,sololeveling:12};
 for(const [id,series] of Object.entries(c.seriesList)){
  if(id==='ghoul')continue;
  assert.equal(series.roster.length,expandedSizes[id]||27);
  for(const row of series.roster){
   assert.ok(sql.includes("('"+id+"','"+row.id+"')")||[2,3].some(version=>sql.includes("('"+id+"','"+row.id+"','"+row.rarity+"',"+version+")")),row.id);
   assert.ok(row.group&&row.intro&&row.fx&&row.reveal&&/^#[\da-f]{6}$/.test(row.tint));
   effects.add(row.reveal);
  }
 }
 assert.equal(effects.size>290,true);
 assert.equal(Object.values(c.seriesList).reduce((count,series)=>count+series.roster.length,0),314);
});

test('every collectible has a local cel illustration and a separate lock silhouette',()=>{
 const directory=path.join(root,'assets/collection');
 for(const [key,set] of Object.entries(c.seriesList)){
  const dir=path.join(directory,key==='ghoul'?'ghoul-cel':key);
  for(const {id} of set.roster)for(const rel of [id+'.webp','locked/'+id+'.webp']){
   const content=fs.readFileSync(path.join(dir,rel));
   assert.equal(content.toString('ascii',8,12),'WEBP',key+'/'+rel);
   assert.ok(content.length>100&&content.length<80000,key+'/'+rel+' '+content.length);
   assert.ok(content.includes(Buffer.from('ALPH'))||content.includes(Buffer.from('VP8L')),key+'/'+rel);
  }
 }
});
