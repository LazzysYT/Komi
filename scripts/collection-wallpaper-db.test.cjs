// Disposable PostgreSQL only. KOMI_TEST_PGLITE overrides the local package path.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {test}=require('node:test');
let PGlite;
try{({PGlite}=require(process.env.KOMI_TEST_PGLITE||'@electric-sql/pglite'));}
catch(error){if(process.env.KOMI_TEST_PGLITE||error.code!=='MODULE_NOT_FOUND')throw error;}
const localTest=(name,run)=>test(name,{skip:!PGlite&&'Set KOMI_TEST_PGLITE for disposable PostgreSQL execution'},run);
const here=path.resolve(__dirname,'..');
const base=process.env.KOMI_COLLECTION_TEST_BASE||(fs.existsSync(path.join(here,'supabase/migrations/20261105_komi_secure_foundation.sql'))?
 here:path.resolve(here,'../komi-collector-finish'));
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const a=id(1001),b=id(1002),gu=id(1003),deleted=id(1004);
const mig='20261127104500_komi_collection_wallpaper.sql';
const worlds=['ghoul','jujutsu','frieren','alchemist'];
const noWallpaper={series_id:null};
const state=(series_id,unlocked)=>({series_id,unlocked});
async function fixture(){
 const db=new PGlite();
 await db.exec(`
   create role anon; create role authenticated; create role service_role;
   create schema auth;
   create table auth.users(id uuid primary key,is_anonymous boolean default false,
     deleted_at timestamptz,email_confirmed_at timestamptz,phone_confirmed_at timestamptz);
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
   '20261105_komi_secure_foundation.sql','20261105_komi_google_username_compatibility.sql',
   '20261105_komi_restrict_table_privileges.sql','202611090003_anicoin_shop.sql',
   '20261119195000_private_presence_and_profiles.sql','20261126193000_komi_collection_cases.sql',
   '20261126195000_komi_collection_paid_cases.sql','20261126195100_komi_collection_paid_only.sql',
   '20261127080152_komi_collection_series.sql','20261127083840_komi_collection_showcase.sql'
 ]) await db.exec(fs.readFileSync(path.join(base,'supabase/migrations',name),'utf8'));
 await db.exec(fs.readFileSync(path.join(here,'supabase/migrations',mig),'utf8'));
 await db.query('insert into auth.users(id,is_anonymous,deleted_at) values($1,false,null),($2,false,null),($3,true,null),($4,false,now())',[a,b,gu,deleted]);
 await db.query("insert into public.komi_profiles(user_id,username) values($1,'Collector'),($2,'collector')",[a,b]);
 await db.query('insert into public.komi_anicoin_wallets(user_id,balance) values($1,177),($2,59)',[a,b]);
 // Seed using the candidate site's real catalog, not the migration's constants.
 const sandbox={window:{}};
 vm.runInNewContext(fs.readFileSync(path.join(base,'komi-collection.js'),'utf8'),sandbox);
 const roster=Object.fromEntries(Object.entries(sandbox.window.KomiCollection.seriesList).map(([key,value])=>[key,Array.from(value.roster,x=>x.id)]));
 assert.deepEqual(Object.keys(roster),worlds);
 assert.deepEqual(Object.values(roster).map(x=>x.length),[18,10,10,10]);
 const legacyCheck=(await db.query(`select pg_get_constraintdef(oid) as d from pg_constraint
  where conrelid = 'komi_collection_private.unlocks'::regclass and contype='c'
  and pg_get_constraintdef(oid) like 'CHECK%character_id%'`)).rows[0].d;
 assert.deepEqual([...legacyCheck.matchAll(/'([a-z]+)'/g)].map(x=>x[1]).sort(),roster.ghoul.slice().sort());
 for (const world of worlds.slice(1)){
  const dbRoster=(await db.query("select character_id from komi_collection_private.series_roster where series_id=$1 order by character_id",[world])).rows.map(x=>x.character_id);
  assert.deepEqual(dbRoster,roster[world].slice().sort());
 }
 const add=async(user,world,character,unique)=>{
  if(world==='ghoul'){
   await db.query("insert into komi_collection_private.unlocks(user_id,character_id,opened_on) values($1,$2,'2026-10-01'::date + $3::int)",[user,character,unique]);
  }else{
   await db.query("insert into komi_collection_private.series_unlocks(user_id,series_id,character_id,paid_request_id) values($1,$2,$3,$4)",[user,world,character,id(unique)]);
  }
 };
 for (const [worldIndex,world] of worlds.entries()) for (const [n,character] of roster[world].entries())
  if(n!==roster[world].length-1)await add(a,world,character,worldIndex*100+n+1);
 const finish=async(world)=>{const idx=roster[world].length-1;await add(a,world,roster[world][idx],worlds.indexOf(world)*100+idx+1);};
 return {db,roster,finish};
}
async function as(db,role,sub='',jwt={}){
 assert.ok(['anon','authenticated','service_role'].includes(role));await db.exec('reset role');
 await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",[sub,JSON.stringify(jwt)]);
 await db.exec('set role '+role);
}
const call=async(db,name,args=[])=>(await db.query('select public.komi_collection_wallpaper_'+name+'('+args.map((_,i)=>'$'+(i+1)).join(',')+') as v',args)).rows[0].v;
const read=(db)=>call(db,'read');
const handle=(db,username)=>call(db,'read_handle',[username]);
const set=(db,series)=>call(db,'set',[series]);

localTest('every real roster must be complete; four themes switch, distinguish case-sensitive handles, and clear without changing legacy profile/wallet/card data',async(t)=>{
 const {db,finish}=await fixture();t.after(()=>db.close());await as(db,'authenticated',a);
 assert.deepEqual(await read(db),state(null,[]));
 for(const world of [...worlds,'all','', 'ghoul '])await assert.rejects(set(db,world),{code:'22023'});
 assert.deepEqual(await handle(db,'Collector'),noWallpaper);
 await db.exec('reset role');
 const profile=(await db.query('select * from public.komi_profiles order by user_id')).rows;
 const wallets=(await db.query('select * from public.komi_anicoin_wallets order by user_id')).rows;
 const selection=[];
 for(const world of worlds){
  await db.exec('reset role');await finish(world);
  await as(db,'authenticated',a);selection.push(world);
  assert.deepEqual(await set(db,world),state(world,selection));
  assert.deepEqual(await read(db),state(world,selection));
  await as(db,'authenticated',b);
  assert.deepEqual(await handle(db,'Collector'),{series_id:world});
  assert.deepEqual(await handle(db,'collector'),noWallpaper);
  assert.deepEqual(await handle(db,'COLLECTOR'),noWallpaper);
  assert.deepEqual(await read(db),state(null,[]));
  await assert.rejects(set(db,world),{code:'22023'});
  assert.deepEqual(await handle(db,'Collector'),{series_id:world});
 }
 await as(db,'authenticated',a);
 assert.deepEqual(await set(db,null),state(null,worlds));
 assert.deepEqual(await set(db,null),state(null,worlds));
 await as(db,'authenticated',b);
 assert.deepEqual(await handle(db,'Collector'),noWallpaper);
 await db.exec('reset role');
 assert.deepEqual((await db.query('select * from public.komi_anicoin_wallets order by user_id')).rows,wallets);
 assert.deepEqual((await db.query('select * from public.komi_profiles order by user_id')).rows,profile);
 assert.deepEqual((await db.query('select (select count(*)::int from komi_collection_private.unlocks) as ghoul,(select count(*)::int from komi_collection_private.series_unlocks) as expansion')).rows,[{ghoul:18,expansion:30}]);
});

localTest('owner preference is independent of profile visibility; hidden and additional restrictive profile RLS block visitor reads and direct selection',async(t)=>{
 const {db,finish}=await fixture();t.after(()=>db.close());await finish('ghoul');
 await as(db,'authenticated',a);
 await set(db,'ghoul');
 await db.query("select public.komi_privacy('update',null,true)");
 assert.deepEqual(await read(db),state('ghoul',['ghoul']));
 assert.deepEqual(await handle(db,'Collector'),noWallpaper);
 await as(db,'authenticated',b);
 assert.deepEqual(await handle(db,'Collector'),noWallpaper);
 assert.deepEqual((await db.query("select series_id from komi_collection_private.profile_wallpaper")).rows,[]);
 await as(db,'authenticated',a);
 await db.query("select public.komi_privacy('update',null,false)");
 await as(db,'authenticated',b);
 assert.deepEqual(await handle(db,'Collector'),{series_id:'ghoul'});
 await db.exec('reset role');
 await db.exec(`create policy test_visibility on public.komi_profiles as restrictive
  for select to authenticated using (user_id = (select auth.uid()))`);
 await as(db,'authenticated',b);
 assert.deepEqual(await handle(db,'Collector'),noWallpaper);
 assert.deepEqual((await db.query("select series_id from komi_collection_private.profile_wallpaper")).rows,[]);
});

localTest('rights scoped to verified, signed-in owners; revoked card and evolving current roster hide outdated wallpaper',async(t)=>{
 const {db,finish}=await fixture();t.after(()=>db.close());await finish('ghoul');await finish('frieren');
 await as(db,'authenticated',a);await set(db,'ghoul');
 await assert.rejects(db.query("update komi_collection_private.profile_wallpaper set series_id='frieren'"),{code:'42501'});
 await assert.rejects(db.query("select * from komi_collection_private.series_unlocks"),{code:'42501'});
 await assert.rejects(db.query("select komi_collection_private.wallpaper_completed($1,'ghoul')",[b]),{code:'42501'});
 await db.exec('reset role');
 await db.query("delete from komi_collection_private.unlocks where user_id=$1 and character_id='kaneki'",[a]);
 await as(db,'authenticated',a);
 assert.deepEqual(await read(db),state(null,['frieren']));
 await assert.rejects(set(db,'ghoul'),{code:'22023'});
 await as(db,'authenticated',b);
 assert.deepEqual(await handle(db,'Collector'),noWallpaper);
 await as(db,'authenticated',a);await set(db,'frieren');
 await db.exec('reset role');
 await db.query("insert into komi_collection_private.series_roster values('frieren','sense')");
 await as(db,'authenticated',a);
 assert.deepEqual(await read(db),state(null,[]));
 await as(db,'authenticated',b);
 assert.deepEqual(await handle(db,'Collector'),noWallpaper);
 await db.exec('reset role');
 await db.query("delete from komi_collection_private.series_roster where series_id='frieren' and character_id='sense'");
 for(const [account,jwt] of [[gu,{is_anonymous:true}],[gu,{}],[deleted,{}],[id(4999),{}],['',{}],[b,{is_anonymous:true}]]){
  await as(db,'authenticated',account,jwt);
  assert.deepEqual(await handle(db,'Collector'),noWallpaper);
  await assert.rejects(read(db),{code:'42501'});
  await assert.rejects(set(db,null),{code:'42501'});
 }
 for(const role of ['anon','service_role']){
  await as(db,role,a);
  await assert.rejects(handle(db,'Collector'),{code:'42501'});
  await assert.rejects(read(db),{code:'42501'});
  await assert.rejects(set(db,'frieren'),{code:'42501'});
 }
});
