// Run with KOMI_TEST_PGLITE=/path/to/pglite/dist/index.cjs. Never touches a hosted project.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {test}=require('node:test');
let PGlite;
try{({PGlite}=require(process.env.KOMI_TEST_PGLITE||'@electric-sql/pglite'));}
catch(error){if(process.env.KOMI_TEST_PGLITE||error.code!=='MODULE_NOT_FOUND')throw error;}
const localTest=(name,run)=>test(name,{skip:!PGlite&&'Set KOMI_TEST_PGLITE for disposable PostgreSQL execution'},run);
const here=path.resolve(__dirname,'..');
const base=process.env.KOMI_COLLECTION_TEST_BASE||(fs.existsSync(path.join(here,'supabase/migrations/20261127104500_komi_collection_wallpaper.sql'))?
 here:path.resolve(here,'../komi-shop-fitting-refresh'));
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const alice=id(1001),bob=id(1002),anonActor=id(1003),deletedActor=id(1004),poor=id(1005);
const oldGhoul='kaneki,touka,juuzou,uta,tsukiyama,hide,rize,arima,eto,ayato,hinami,amon,nishiki,yomo,yoshimura,akira,furuta,takizawa'.split(',');
const oldJjk='itadori,fushiguro,kugisaki,gojo,sukuna,maki,toge,panda,nanami,yuta'.split(',');
const newPool={
 ghoul:'mado,irimi',
 jujutsu:'shoko,geto,toji,choso,mahito,todo,meimei,utahime,miwa,kusakabe',
 frieren:'lawine,kanne,land,methode,wirbel,ehre,scharf,laufen,richter,lernen',
 alchemist:'ling,mei,greed,lust,envy,gluttony,wrath,pride,hohenheim,izumi',
 demon:'tanjiro,nezuko,zenitsu,inosuke,giyu,shinobu,rengoku,tengen,mitsuri,muichiro,gyomei,sanemi,obanai,kanao,genya,muzan,akaza,doma,kokushibo,daki',
 aot:'eren,mikasa,armin,levi,erwin,hange,jean,connie,sasha,reiner,bertholdt,annie,historia,ymir,zeke,pieck,porco,gabi,falco,moblit'
};
async function fixture(){
 const db=new PGlite();
 await db.exec(`
   create role anon; create role authenticated; create role service_role;
   create schema auth;
   create table auth.users(id uuid primary key,is_anonymous boolean default false,deleted_at timestamptz,
     email_confirmed_at timestamptz,phone_confirmed_at timestamptz);
   create function auth.uid() returns uuid language sql stable as $$
     select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
   create function auth.jwt() returns jsonb language sql stable as $$
     select coalesce(nullif(current_setting('request.jwt.claims', true),''),'{}')::jsonb $$;
   grant usage on schema auth to anon, authenticated;
   grant execute on function auth.uid(),auth.jwt() to anon,authenticated;
   create schema komi_private;
   create table komi_private.site_presence(session_id uuid primary key,user_id uuid,last_seen timestamptz);
 `);
 for(const name of [
 '20261105_komi_secure_foundation.sql','202611090003_anicoin_shop.sql',
 '20261119195000_private_presence_and_profiles.sql','20261126193000_komi_collection_cases.sql',
 '20261126195000_komi_collection_paid_cases.sql','20261126195100_komi_collection_paid_only.sql',
 '20261127080152_komi_collection_series.sql','20261127083840_komi_collection_showcase.sql',
 '20261127084539_komi_collection_journal.sql','20261127104500_komi_collection_wallpaper.sql'
 ]) await db.exec(fs.readFileSync(path.join(base,'supabase/migrations',name),'utf8'));
 await db.query('insert into auth.users(id,is_anonymous,deleted_at) values($1,false,null),($2,false,null),($3,true,null),($4,false,now()),($5,false,null)',
  [alice,bob,anonActor,deletedActor,poor]);
 await db.query('insert into public.komi_anicoin_wallets(user_id,balance) values($1,2500),($2,1000),($3,49)',[alice,bob,poor]);
 await db.query("insert into public.komi_profiles(user_id,username) values($1,'Collector'),($2,'Visitor')",[alice,bob]);
 for(const [i,c] of oldGhoul.entries())
  await db.query("insert into komi_collection_private.unlocks(user_id,character_id,opened_on,paid_request_id,paid_cost) values($1,$2,'2026-11-25',$3,$4)",
   [alice,c,i?id(300+i):null,i?50:0]);
 for(const [i,c] of oldJjk.entries())
  await db.query("insert into komi_collection_private.series_unlocks(user_id,series_id,character_id,paid_request_id) values($1,'jujutsu',$2,$3)",[alice,c,id(400+i)]);
 await db.query("insert into komi_collection_private.profile_wallpaper(user_id,series_id) values($1,'ghoul')",[alice]);
 await db.query("insert into komi_collection_private.profile_showcase(user_id,position,series_id,character_id) values($1,1,'ghoul','kaneki')",[alice]);
 await db.exec(fs.readFileSync(path.join(here,'supabase/migrations/20261127110000_komi_collection_series_expansion.sql'),'utf8'));
 return db;
}
async function as(db,role,sub='',jwt={}){
 assert.ok(['anon','authenticated','service_role'].includes(role));await db.exec('reset role');
 await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",[sub,JSON.stringify(jwt)]);
 await db.exec('set role '+role);
}
const rpc=async(db,fn,...args)=>(await db.query('select public.komi_collection_'+fn+'('+args.map((_,i)=>'$'+(i+1))+') as v',args)).rows[0].v;
const buyOld=(db,s,r)=>s==='ghoul'?rpc(db,'buy',r):rpc(db,'series_buy',s,r);
const buyV2=(db,s,r)=>s==='ghoul'?rpc(db,'ghoul_buy_v2',r):rpc(db,'series_buy_v2',s,r);
const read=(db,s)=>s==='ghoul'?rpc(db,'action','read'):rpc(db,'series_read',s);

localTest('paid packs reveal only rarity before a pick; the first valid slot settles once',async t=>{
 const db=await fixture();t.after(()=>db.close());
 for(const name of ['20261127143000_komi_collection_second_wave.sql','20261127144500_komi_collection_third_wave.sql','20261127144501_komi_collection_pick_pack.sql']){
  await db.exec(fs.readFileSync(path.join(here,'supabase/migrations',name),'utf8'));
 }
 const vm=require('node:vm'),scope={window:{}};
 vm.runInNewContext(fs.readFileSync(path.join(here,'komi-collection.js'),'utf8'),scope);
 const expected=Object.entries(scope.window.KomiCollection.seriesList).flatMap(([series_id,group])=>
  group.roster.map(({id,rarity})=>[series_id,id,rarity].join(':'))).sort();
 const grades=(await db.query('select series_id,character_id,rarity from komi_collection_private.pack_rarity')).rows;
 assert.deepEqual(grades.map(x=>[x.series_id,x.character_id,x.rarity].join(':')).sort(),expected);
 const open=(series='bleach',offer=null)=>rpc(db,'pack_open',series,offer);
 const claim=(offer,slot)=>rpc(db,'pack_claim',offer,slot);
 await as(db,'anon');
 await assert.rejects(open(),{code:'42501'});
 await assert.rejects(rpc(db,'card_number','ghoul','kaneki'),{code:'42501'});
 await as(db,'authenticated',anonActor);
 await assert.rejects(open(),{code:'42501'});
 await as(db,'authenticated',deletedActor);
 await assert.rejects(open(),{code:'42501'});
 await as(db,'authenticated',poor);
 assert.equal((await open()).pack_status,'insufficient');
 await as(db,'authenticated',bob);
 assert.equal(await rpc(db,'card_number','ghoul','kaneki'),null);
 const offer=await open();
 assert.equal(offer.balance,1000);
 assert.equal(offer.pack_status,'ready');
 assert.deepEqual(offer.owned,[]);
 assert.equal(offer.choices.length,5);
 assert.ok(offer.choices.every((choice,i)=>choice.slot===i+1&&choice.available&&!Object.hasOwn(choice,'id')));
 assert.deepEqual(await open(),offer);
 await assert.rejects(claim(offer.offer_id,0),{code:'22023'});
 await assert.rejects(claim(offer.offer_id,null),{code:'22023'});
 await as(db,'authenticated',alice);
 await assert.rejects(claim(offer.offer_id,2),{code:'22023'});
 await assert.rejects(open('bleach',offer.offer_id),{code:'22023'});
 await as(db,'authenticated',bob);
 await assert.rejects(open('naruto',offer.offer_id),{code:'22023'});
 const won=await claim(offer.offer_id,4);
 assert.equal(won.pack_status,'claimed');
 assert.equal(won.selected_slot,4);
 assert.equal(won.result,won.choices[3].id);
 assert.equal(new Set(won.choices.map(x=>x.id)).size,5);
 assert.ok(won.choices.every(x=>!x.available));
 assert.deepEqual(won.owned,[won.result]);
 assert.equal(won.balance,950);
 assert.deepEqual(await rpc(db,'card_number','bleach',won.result),{serial:1,issued:1});
 assert.deepEqual(await claim(offer.offer_id,1),won);
 assert.deepEqual(await open('bleach',offer.offer_id),won);
 const newOffer=await open();
 assert.notEqual(newOffer.offer_id,offer.offer_id);
 assert.equal((await read(db,'bleach')).balance,950);
 for(const series of ['onepiece','chainsaw','hunter']){
  const draw=await open(series);
  assert.equal(draw.choices.length,5);
  const card=await claim(draw.offer_id,3);
  assert.equal(card.result,card.choices[2].id);
  assert.ok(scope.window.KomiCollection.seriesList[series].roster.some(item=>item.id===card.result));
 }
 const acl=(await db.query("select has_table_privilege(current_user,'komi_collection_private.pack_offers','select,insert,update') as ok")).rows[0];
 assert.equal(acl.ok,false);
});

localTest('short packs stay completable and a rejected reward rolls back the charge and pending offer',async t=>{
 const db=await fixture();t.after(()=>db.close());
 for(const name of ['20261127143000_komi_collection_second_wave.sql','20261127144500_komi_collection_third_wave.sql','20261127144501_komi_collection_pick_pack.sql']){
  await db.exec(fs.readFileSync(path.join(here,'supabase/migrations',name),'utf8'));
 }
 await db.query(`insert into komi_collection_private.unlocks(user_id,character_id,opened_on,paid_request_id,paid_cost)
   select $1,r.character_id,'2026-11-25',gen_random_uuid(),50
   from komi_collection_private.ghoul_roster r where r.character_id <> 'tatara'
   on conflict (user_id,character_id) do nothing`,[alice]);
 await db.exec(`create function komi_collection_private.reject_tatara_fixture() returns trigger language plpgsql as $$
  begin raise exception 'forced rollback' using errcode='23514'; end; $$;
  create trigger reject_tatara_fixture before insert on komi_collection_private.unlocks for each row
  when (new.character_id='tatara') execute function komi_collection_private.reject_tatara_fixture();`);
 await as(db,'authenticated',alice);
 assert.deepEqual(await rpc(db,'card_number','ghoul','kaneki'),{serial:1,issued:1});
 const offer=await rpc(db,'pack_open','ghoul',null);
 assert.equal(offer.choices.length,1);
 await assert.rejects(rpc(db,'pack_claim',offer.offer_id,2),{code:'22023'});
 await assert.rejects(rpc(db,'pack_claim',offer.offer_id,1),{code:'23514'});
 assert.deepEqual(await rpc(db,'pack_open','ghoul',offer.offer_id),offer);
 await db.exec('reset role; drop trigger reject_tatara_fixture on komi_collection_private.unlocks;');
 await as(db,'authenticated',alice);
 const receipt=await rpc(db,'pack_claim',offer.offer_id,1);
 assert.equal(receipt.result,'tatara');
 assert.equal(receipt.owned.length,24);
 assert.equal(receipt.balance,2450);
 assert.deepEqual(await rpc(db,'card_number','ghoul','tatara'),{serial:1,issued:1});
 assert.equal((await rpc(db,'pack_open','ghoul',null)).pack_status,'complete');
 await as(db,'authenticated',bob);
 const old=await rpc(db,'ghoul_buy_v3',id(901));
 assert.deepEqual(await rpc(db,'card_number','ghoul',old.result),{serial:2,issued:2});
 await as(db,'authenticated',alice);
 assert.deepEqual(await rpc(db,'card_number','ghoul',old.result),{serial:1,issued:2});
});

localTest('migration creates exactly six 20-card pools; grandfather wallpaper remains and no balances or holdings change',async t=>{
 const db=await fixture();t.after(()=>db.close());
 const g=(await db.query("select array_agg(character_id order by character_id) as ids from komi_collection_private.ghoul_roster")).rows[0].ids;
 assert.deepEqual(g,[...oldGhoul,...newPool.ghoul.split(',')].sort());
 const roster=(await db.query("select series_id,array_agg(character_id order by character_id) as ids from komi_collection_private.series_roster group by series_id")).rows;
 assert.equal(roster.length,5);
 for(const {series_id,ids} of roster){
  assert.equal(ids.length,20);
  for(const c of newPool[series_id].split(','))assert.ok(ids.includes(c));
 }
 await as(db,'authenticated',alice);
 assert.equal((await read(db,'ghoul')).owned.length,18);
 assert.equal((await read(db,'jujutsu')).owned.length,10);
 assert.equal((await read(db,'demon')).balance,2500);
 assert.deepEqual(await rpc(db,'wallpaper_read'),{series_id:'ghoul',unlocked:['ghoul','jujutsu']});
 await as(db,'authenticated',bob);
 assert.deepEqual(await rpc(db,'wallpaper_read_handle','Collector'),{series_id:'ghoul'});
 assert.deepEqual(await rpc(db,'showcase_read_handle','Collector'),[{series_id:'ghoul',character_id:'kaneki'}]);
});

localTest('old endpoint skips all new cards, v2 pays exactly once across wrappers, rejects cross-series reuse and works after legacy closeout',async t=>{
 const db=await fixture();t.after(()=>db.close());await as(db,'authenticated',alice);
 assert.equal((await buyOld(db,'ghoul',id(1))).purchase_status,'complete');
 assert.equal((await buyOld(db,'jujutsu',id(2))).purchase_status,'complete');
 assert.equal((await buyOld(db,'ghoul',id(301))).result,'touka');
 assert.equal((await buyV2(db,'ghoul',id(301))).result,'touka');
 const first=await buyV2(db,'ghoul',id(10));
 assert.ok(newPool.ghoul.split(',').includes(first.result));
 assert.equal(first.price,50);assert.equal(first.balance,2450);assert.equal(first.owned.length,19);
 assert.equal((await buyOld(db,'ghoul',id(10))).result,first.result);
 assert.equal((await buyOld(db,'ghoul',id(10))).balance,2450);
 await assert.rejects(buyV2(db,'demon',id(10)),{code:'22023'});
 const second=await buyV2(db,'ghoul',id(11));
 assert.notEqual(second.result,first.result);
 assert.equal(second.owned.length,20);assert.equal(second.balance,2400);
 assert.equal((await buyV2(db,'ghoul',id(12))).purchase_status,'complete');
 const third=await buyV2(db,'jujutsu',id(13));
 assert.ok(newPool.jujutsu.split(',').includes(third.result));
 assert.equal((await buyOld(db,'jujutsu',id(13))).result,third.result);
 assert.equal((await buyOld(db,'jujutsu',id(13))).balance,2350);
 await assert.rejects(buyV2(db,'ghoul',id(13)),{code:'22023'});
 await as(db,'authenticated',bob);
 for(let i=1;i<=10;i++){
  const got=await buyOld(db,'jujutsu',id(i));
  assert.ok(oldJjk.includes(got.result));assert.equal(got.owned.length,i);
 }
 assert.equal((await buyOld(db,'jujutsu',id(19))).purchase_status,'complete');
 assert.deepEqual(await rpc(db,'wallpaper_read'),{series_id:null,unlocked:[]});
 const fresh=await buyV2(db,'jujutsu',id(20));
 assert.ok(newPool.jujutsu.split(',').includes(fresh.result));assert.equal(fresh.balance,450);
});

localTest('new series purchases, owner journal and verified showcase/wallpaper follow existing permissions',async t=>{
 const db=await fixture();t.after(()=>db.close());
 await as(db,'authenticated',alice);
 await assert.rejects(buyOld(db,'demon',id(60)),{code:'22023'});
 await assert.rejects(rpc(db,'wallpaper_set','demon'),{code:'22023'});
 for(const [j,s] of ['demon','aot'].entries()) {
  for(let i=1;i<=20;i++){
   const got=await buyV2(db,s,id(60+j*30+i));
   assert.equal(got.price,50);assert.ok(newPool[s].split(',').includes(got.result));
   assert.equal(got.owned.length,i);assert.equal(got.balance,2500-(j*20+i)*50);
  }
  assert.equal((await buyV2(db,s,id(81+j*30))).purchase_status,'complete');
  assert.equal((await rpc(db,'journal_read',s)).length,20);
  assert.deepEqual((await read(db,s)).owned.slice().sort(),newPool[s].split(',').sort());
 }
 const chosen=[{series_id:'demon',character_id:'tanjiro'},{series_id:'aot',character_id:'mikasa'}];
 assert.deepEqual(await rpc(db,'showcase_set',JSON.stringify(chosen)),chosen);
 assert.deepEqual(await rpc(db,'wallpaper_set','aot'),{series_id:'aot',unlocked:['ghoul','jujutsu','demon','aot']});
 await as(db,'authenticated',bob);
 assert.deepEqual(await rpc(db,'showcase_read_handle','Collector'),chosen);
 assert.deepEqual(await rpc(db,'wallpaper_read_handle','Collector'),{series_id:'aot'});
 assert.deepEqual(await rpc(db,'journal_read','aot'),[]);
 assert.deepEqual((await read(db,'aot')).owned,[]);
 await as(db,'authenticated',alice);
 await db.query("select public.komi_privacy('update',null,true)");
 await as(db,'authenticated',bob);
 assert.deepEqual(await rpc(db,'showcase_read_handle','Collector'),[]);
 assert.deepEqual(await rpc(db,'wallpaper_read_handle','Collector'),{series_id:null});
 await as(db,'authenticated',poor);
 assert.equal((await buyV2(db,'demon',id(1))).purchase_status,'insufficient');
 assert.deepEqual(await rpc(db,'journal_read','demon'),[]);
 for(const [role,actor] of [['anon',alice],['service_role',alice],['authenticated',anonActor],['authenticated',deletedActor]]){
  await as(db,role,actor);await assert.rejects(buyV2(db,'demon',id(1)),{code:'42501'});
 }
});

localTest('late reward failure rolls back the wallet and ownership with no consumed receipt',async t=>{
 const db=await fixture();t.after(()=>db.close());
 await db.exec(`
 create function komi_collection_private.test_reject() returns trigger language plpgsql as $$
 begin
   raise exception 'forced test failure' using errcode='23514';
 end
 $$;
 create trigger test_reject before insert on komi_collection_private.series_unlocks
 for each row execute function komi_collection_private.test_reject()
 `);
 await as(db,'authenticated',bob);
 await assert.rejects(buyV2(db,'aot',id(1)),{code:'23514'});
 assert.equal((await read(db,'aot')).balance,1000);
 assert.deepEqual(await rpc(db,'journal_read','aot'),[]);
 await db.exec('reset role');
 await db.exec('drop trigger test_reject on komi_collection_private.series_unlocks');
 await as(db,'authenticated',bob);
 assert.equal((await buyV2(db,'aot',id(1))).balance,950);
});

localTest('wave two preserves owned cards and old completion, isolates cached v2 draws, and issues each new pack reward once',async t=>{
 const db=await fixture();t.after(()=>db.close());
 const migrate=fs.readFileSync(path.join(here,'supabase/migrations/20261127143000_komi_collection_second_wave.sql'),'utf8');
 await db.exec('reset role');
 const prior=(await db.query("select character_id from komi_collection_private.series_roster where series_id='demon'")).rows.map(r=>r.character_id);
 for(const [i,c] of prior.entries())await db.query(
  "insert into komi_collection_private.series_unlocks(user_id,series_id,character_id,paid_request_id) values($1,'demon',$2,$3)",
  [alice,c,id(801+i)]);
 await as(db,'authenticated',alice);
 assert.equal((await rpc(db,'wallpaper_set','demon')).series_id,'demon');
 assert.equal((await read(db,'demon')).balance,2500);
 await db.exec('reset role');await db.exec(migrate);
 const rows=(await db.query("select series_id,count(*)::int as n from komi_collection_private.series_roster group by series_id")).rows;
 assert.equal(rows.length,7);
 assert.ok(rows.every(r=>r.n=== (['naruto','bleach'].includes(r.series_id)?20:24)));
 assert.equal((await db.query("select count(*)::int as n from komi_collection_private.ghoul_roster")).rows[0].n,24);
 await as(db,'authenticated',alice);
 assert.equal((await read(db,'demon')).owned.length,20);
 assert.equal((await rpc(db,'wallpaper_read')).series_id,'demon');
 assert.equal((await buyV2(db,'demon',id(850))).purchase_status,'complete');
 assert.equal((await read(db,'demon')).balance,2500);
 const d=await rpc(db,'series_buy_v3','demon',id(851));
 assert.ok(!prior.includes(d.result));assert.equal(d.owned.length,21);assert.equal(d.balance,2450);
 assert.equal((await rpc(db,'journal_read','demon')).length,21);
 assert.equal((await rpc(db,'wallpaper_read')).series_id,'demon');
 for(const [i,s] of ['naruto','bleach'].entries()){
  assert.equal((await buyV2(db,s,id(862+i))).purchase_status,'complete');
  const got=await rpc(db,'series_buy_v3',s,id(870+i));
  assert.equal(got.owned.length,1);assert.equal(got.balance,2400-i*50);
  assert.deepEqual(await rpc(db,'series_buy_v3',s,id(870+i)),got);
  await assert.rejects(rpc(db,'ghoul_buy_v3',id(870+i)),{code:'22023'});
  const shown=[{series_id:s,character_id:got.result}];
  assert.deepEqual(await rpc(db,'showcase_set',JSON.stringify(shown)),shown);
 }
 await as(db,'authenticated',poor);
 assert.equal((await rpc(db,'series_buy_v3','naruto',id(1))).purchase_status,'insufficient');
 await as(db,'anon');
 await assert.rejects(rpc(db,'series_buy_v3','bleach',id(1)),{code:'42501'});
});

localTest('third wave adds three equal pools without changing any existing serial pool or balance', async t=>{
 const db=await fixture();t.after(()=>db.close());
 const apply=async n=>db.exec(fs.readFileSync(path.join(here,'supabase/migrations/'+n),'utf8'));
 await apply('20261127143000_komi_collection_second_wave.sql');
 const before=(await db.query("select series_id,array_agg(character_id order by character_id) ids from komi_collection_private.series_roster group by 1 order by 1")).rows;
 await apply('20261127144500_komi_collection_third_wave.sql');
 const after=(await db.query("select series_id,array_agg(character_id order by character_id) ids from komi_collection_private.series_roster group by 1 order by 1")).rows;
 assert.equal(after.length,10);
 assert.deepEqual(after.filter(r=>before.some(b=>b.series_id===r.series_id)),before);
 const keys=['onepiece','chainsaw','hunter'];
 for(const key of keys)assert.equal(after.find(r=>r.series_id===key).ids.length,20);
 await as(db,'authenticated',alice);
 assert.equal((await read(db,'naruto')).balance,2500);
 for(const [i,key] of keys.entries()){
   const tx=id(940+i);
   const award=await rpc(db,'series_buy_v3',key,tx);
   assert.equal(award.balance,2500-50*(i+1));
   assert.equal(award.owned.length,1);
   assert.equal(award.owned[0],award.result);
   assert.deepEqual(await rpc(db,'series_buy_v3',key,tx),award);
   assert.equal((await rpc(db,'journal_read',key)).length,1);
 }
 await as(db,'anon');
 await assert.rejects(rpc(db,'series_buy_v3','hunter',id(950)),{code:'42501'});
});
