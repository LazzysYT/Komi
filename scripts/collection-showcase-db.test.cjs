// In-process PostgreSQL WASM; no external database or credentials. Run with KOMI_TEST_PGLITE or install @electric-sql/pglite.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {test}=require('node:test');
let PGlite;
try{({PGlite}=require(process.env.KOMI_TEST_PGLITE||'@electric-sql/pglite'));}
catch(error){if(process.env.KOMI_TEST_PGLITE||error.code!=='MODULE_NOT_FOUND')throw error;}
const localTest=(name,run)=>test(name,{skip:!PGlite&&'Set KOMI_TEST_PGLITE for disposable PostgreSQL execution'},run);
const here=path.resolve(__dirname,'..');
const base=process.env.KOMI_COLLECTION_TEST_BASE||(fs.existsSync(path.join(here,'supabase/migrations/20261105_komi_secure_foundation.sql'))?
 here:path.resolve(here,'../komi-collection-cel'));
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const a=id(1001),b=id(1002),anon=id(1003),deleted=id(1004);
const tokyo=(character_id='kaneki')=>({series_id:'ghoul',character_id});
const frieren={series_id:'frieren',character_id:'fern'};
const alchemist={series_id:'alchemist',character_id:'riza'};
const unselected={series_id:'jujutsu',character_id:'gojo'};
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
   '20261127080152_komi_collection_series.sql'
 ]) await db.exec(fs.readFileSync(path.join(base,'supabase/migrations',name),'utf8'));
 await db.exec(fs.readFileSync(path.join(here,'supabase/migrations/20261127083840_komi_collection_showcase.sql'),'utf8'));
 await db.query('insert into auth.users(id,is_anonymous,deleted_at) values($1,false,null),($2,false,null),($3,true,null),($4,false,now())',[a,b,anon,deleted]);
 await db.query("insert into public.komi_profiles(user_id,username) values($1,'Collector'),($2,'collector')",[a,b]);
 await db.query('insert into public.komi_anicoin_wallets(user_id,balance) values($1,177),($2,59)',[a,b]);
 await db.query("insert into komi_collection_private.unlocks(user_id,character_id,opened_on) values($1,'kaneki','2026-11-25'),($2,'touka','2026-11-25')",[a,b]);
 await db.query('insert into komi_collection_private.series_unlocks(user_id,series_id,character_id,paid_request_id) values($1,$2,$3,$4),($1,$5,$6,$7),($1,$8,$9,$10)',
   [a,frieren.series_id,frieren.character_id,id(1),alchemist.series_id,alchemist.character_id,id(2),unselected.series_id,unselected.character_id,id(3)]);
 return db;
}
async function as(db,role,sub='',jwt={}){
 assert.ok(['anon','authenticated','service_role'].includes(role));await db.exec('reset role');
 await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",[sub,JSON.stringify(jwt)]);
 await db.exec('set role '+role);
}
const rpc=async(db,name,arg)=>(await db.query('select public.komi_collection_showcase_'+name+'($1) as v',[arg])).rows[0].v;
const read=(db,actor)=>rpc(db,'read',actor);
const handle=(db,username)=>rpc(db,'read_handle',username);
const set=(db,cards)=>rpc(db,'set',cards===undefined?null:JSON.stringify(cards));

localTest('ordered opt-in returns only explicitly selected pairs to signed-in visitors; empty clears without wallet change',async(t)=>{
 const db=await fixture();t.after(()=>db.close());await as(db,'authenticated',a);
 assert.deepEqual(await read(db,a),[]);assert.deepEqual(await handle(db,'Collector'),[]);
 const selected=[alchemist,tokyo(),frieren];
 assert.deepEqual(await set(db,selected),selected);
 assert.deepEqual(await read(db,a),selected);
 await as(db,'authenticated',b);
 assert.deepEqual(await handle(db,'Collector'),selected);
 assert.deepEqual(await handle(db,'collector'),[]);
 assert.deepEqual(await handle(db,'COLLECTOR'),[]);
 assert.deepEqual(await handle(db,'unknown'),[]);
 assert.deepEqual(await read(db,a),[]);
 await as(db,'anon');
 await assert.rejects(handle(db,'Collector'),{code:'42501'});
 await as(db,'authenticated',a);
 assert.deepEqual(await set(db,[]),[]);
 assert.deepEqual(await read(db,a),[]);
 await as(db,'authenticated',b);
 assert.deepEqual(await handle(db,'Collector'),[]);
 await db.exec('reset role');
 const wallets=await db.query('select balance from public.komi_anicoin_wallets order by user_id');
 assert.deepEqual(wallets.rows,[{balance:177},{balance:59}]);
 const holdings=await db.query('select count(*)::int as n from komi_collection_private.series_unlocks');
 assert.equal(holdings.rows[0].n,3);
});

localTest('profile hiding and stricter existing profile RLS take priority over showcase consent',async(t)=>{
 const db=await fixture();t.after(()=>db.close());await as(db,'authenticated',a);
 await set(db,[tokyo()]);
 await db.query("select public.komi_privacy('update',null,true)");
 assert.deepEqual(await read(db,a),[tokyo()]);
 assert.deepEqual(await handle(db,'Collector'),[]);
 await as(db,'authenticated',b);
 assert.deepEqual(await handle(db,'Collector'),[]);
 await as(db,'authenticated',a);
 await db.query("select public.komi_privacy('update',null,false)");
 await as(db,'authenticated',b);
 assert.deepEqual(await handle(db,'Collector'),[tokyo()]);
 await db.exec('reset role');
 // Local simulation of an existing block/friend restriction added to profile visibility.
 await db.exec(`create policy test_profile_visibility on public.komi_profiles as restrictive
  for select to authenticated using (user_id = (select auth.uid()))`);
 await as(db,'authenticated',b);
 assert.deepEqual(await handle(db,'Collector'),[]);
 await as(db,'authenticated',a);
 assert.deepEqual(await read(db,a),[tokyo()]);
});

localTest('invalid/unowned entries never overwrite selection and only owner has mutation rights',async(t)=>{
 const db=await fixture();t.after(()=>db.close());await as(db,'authenticated',a);
 await set(db,[tokyo(),frieren]);
 for(const bad of [undefined,null,{},[{}],[tokyo(),frieren,alchemist,unselected],[tokyo(),tokyo()],
  [tokyo('touka')],[{series_id:'misc',character_id:'kaneki'}],
  [{...tokyo(),user_id:b}],[{series_id:'ghoul',character_id:1}],[tokyo(),{...frieren,character_id:'riza'}]]){
  await assert.rejects(set(db,bad),{code:'22023'});
 }
 assert.deepEqual(await read(db,a),[tokyo(),frieren]);
 const acl=(await db.query(`select
   has_table_privilege(current_user,'komi_collection_private.profile_showcase','INSERT') as insert_ok,
   has_table_privilege(current_user,'komi_collection_private.profile_showcase','UPDATE') as update_ok,
   has_table_privilege(current_user,'komi_collection_private.profile_showcase','DELETE') as delete_ok,
   has_table_privilege(current_user,'komi_collection_private.series_unlocks','SELECT') as ledger_read
 `)).rows[0];
 assert.deepEqual(acl,{insert_ok:false,update_ok:false,delete_ok:false,ledger_read:false});
 await as(db,'authenticated',b);await assert.rejects(set(db,[tokyo()]),{code:'22023'});
 assert.deepEqual(await set(db,[tokyo('touka')]),[tokyo('touka')]);
 assert.deepEqual(await handle(db,'Collector'),[tokyo(),frieren]);
 for(const [user,jwt] of [[anon,{is_anonymous:true}],[anon,{}],[deleted,{}],[id(1111),{}],['',{}]]){
  await as(db,'authenticated',user,jwt);
  assert.deepEqual(await handle(db,'Collector'),[]);
  await assert.rejects(set(db,[]),{code:'42501'});
 }
});

localTest('revoking an owned card removes its opted-in publication without disturbing other slots',async(t)=>{
 const db=await fixture();t.after(()=>db.close());await as(db,'authenticated',a);
 await set(db,[alchemist,tokyo(),frieren]);
 await db.exec('reset role');
 await db.query("delete from komi_collection_private.unlocks where user_id=$1 and character_id='kaneki'",[a]);
 await db.query("delete from komi_collection_private.series_unlocks where user_id=$1 and series_id='frieren' and character_id='fern'",[a]);
 await as(db,'authenticated',b);
 assert.deepEqual(await handle(db,'Collector'),[alchemist]);
 await as(db,'authenticated',a);
 assert.deepEqual(await read(db,a),[alchemist]);
});
