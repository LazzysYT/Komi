// Runs against a disposable local PostgreSQL WASM instance, never a live DB.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {test}=require('node:test');
let PGlite;
try{({PGlite}=require(process.env.KOMI_TEST_PGLITE||'@electric-sql/pglite'));}
catch(error){if(process.env.KOMI_TEST_PGLITE||error.code!=='MODULE_NOT_FOUND')throw error;}
const localTest=(name,run)=>test(name,{skip:!PGlite&&'Set KOMI_TEST_PGLITE for disposable PostgreSQL execution'},run);
const here=path.resolve(__dirname,'..');
const base=process.env.KOMI_COLLECTION_TEST_BASE||(fs.existsSync(path.join(here,'supabase/migrations/20261126193000_komi_collection_cases.sql'))?
 here:path.resolve(here,'../komi-collection-cel'));
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const a=id(1001),b=id(1002),anonymous=id(1003),deleted=id(1004);
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
 for(const name of ['20261105_komi_secure_foundation.sql','202611090003_anicoin_shop.sql',
  '20261119195000_private_presence_and_profiles.sql','20261126193000_komi_collection_cases.sql',
  '20261126195000_komi_collection_paid_cases.sql','20261126195100_komi_collection_paid_only.sql',
  '20261127080152_komi_collection_series.sql']) {
  await db.exec(fs.readFileSync(path.join(base,'supabase/migrations',name),'utf8'));
 }
 await db.exec(fs.readFileSync(path.join(here,'supabase/migrations/20261127084539_komi_collection_journal.sql'),'utf8'));
 await db.query('insert into auth.users(id,is_anonymous,deleted_at) values($1,false,null),($2,false,null),($3,true,null),($4,false,now())',[a,b,anonymous,deleted]);
 await db.query('insert into public.komi_anicoin_wallets(user_id,balance) values($1,177),($2,59)',[a,b]);
 await db.query(`insert into komi_collection_private.unlocks(user_id,character_id,opened_on,created_at,paid_request_id,paid_cost)
 values($1,'kaneki','2026-11-25','2026-11-25T11:26:45.000001+00',null,0),
 ($1,'touka','2026-11-26','2026-11-26T13:27:50+00',$3,50),
 ($2,'hide','2026-11-26','2026-11-26T15:30:15+00',$4,50)`,[a,b,id(1),id(2)]);
 await db.query(`insert into komi_collection_private.series_unlocks(user_id,series_id,character_id,created_at,paid_request_id)
 values($1,'jujutsu','gojo','2026-11-26T15:00:00+00',$3),
 ($1,'frieren','fern','2026-11-26T16:00:00+00',$4),
 ($1,'alchemist','riza','2026-11-26T17:00:00+00',$5),
 ($2,'frieren','stark','2026-11-26T20:00:00+00',$3)`,[a,b,id(1),id(2),id(3)]);
 return db;
}
async function as(db,role,sub='',jwt={}){
 assert.ok(['anon','authenticated','service_role'].includes(role));await db.exec('reset role');
 await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",[sub,JSON.stringify(jwt)]);
 await db.exec('set role '+role);
}
const read=async(db,series)=>(await db.query('select public.komi_collection_journal_read($1) as v',[series])).rows[0].v;

localTest('private journal reads exact confirmed timestamps across all four series, without classifying cost',async t=>{
 const db=await fixture();t.after(()=>db.close());
 await db.exec("set timezone='America/Los_Angeles'");
 await as(db,'authenticated',a);
 assert.deepEqual(await read(db,'ghoul'),[
   {character_id:'touka',opened_at:'2026-11-26T13:27:50+00:00'},
   {character_id:'kaneki',opened_at:'2026-11-25T11:26:45.000001+00:00'}
 ]);
 for(const [series,character_id,hour] of [['jujutsu','gojo','15'],['frieren','fern','16'],['alchemist','riza','17']])
   assert.deepEqual(await read(db,series),[{character_id,opened_at:'2026-11-26T'+hour+':00:00+00:00'}]);
 await db.query("select public.komi_privacy('update',null,true)");
 assert.equal((await read(db,'ghoul')).length,2);
 await as(db,'authenticated',b);
 assert.deepEqual(await read(db,'ghoul'),[{character_id:'hide',opened_at:'2026-11-26T15:30:15+00:00'}]);
 assert.deepEqual(await read(db,'jujutsu'),[]);
 assert.deepEqual(await read(db,'frieren'),[{character_id:'stark',opened_at:'2026-11-26T20:00:00+00:00'}]);
 await db.exec('reset role');
 const wallets=(await db.query('select balance from public.komi_anicoin_wallets order by user_id')).rows;
 assert.deepEqual(wallets,[{balance:177},{balance:59}]);
 const counts=(await db.query(`select
  (select count(*)::int from komi_collection_private.unlocks) as legacy,
  (select count(*)::int from komi_collection_private.series_unlocks) as expansion`)).rows[0];
 assert.deepEqual(counts,{legacy:3,expansion:4});
});

localTest('anon, deleted or anonymous users, service role, and unsupported series fail closed', async t=>{
 const db=await fixture();t.after(()=>db.close());
 for(const role of ['anon','service_role']){
  await as(db,role,a);await assert.rejects(read(db,'ghoul'),{code:'42501'});
 }
 for(const [actor,jwt] of [['',{}],[deleted,{}],[anonymous,{}],[anonymous,{is_anonymous:true}],[a,{is_anonymous:true}],[id(1111),{}]]){
  await as(db,'authenticated',actor,jwt);await assert.rejects(read(db,'ghoul'),{code:'42501'});
 }
 await as(db,'authenticated',a);
 for(const series of [null,'','unknown','GHOUL'])await assert.rejects(read(db,series),{code:'22023'});
 const acl=(await db.query(`select 
  has_table_privilege(current_user,'komi_collection_private.unlocks','SELECT') as legacy,
  has_table_privilege(current_user,'komi_collection_private.series_unlocks','SELECT') as series,
  has_table_privilege(current_user,'public.komi_anicoin_wallets','SELECT') as wallet`)).rows[0];
 assert.deepEqual(acl,{legacy:false,series:false,wallet:false});
});

localTest('deterministic journal ordering and maximum of 20 items for a future expanded roster', async t=>{
 const db=await fixture();t.after(()=>db.close());
 // Seed more than 20 test-only confirmed unlocks, including a timestamp tie.
 for(let i=1;i<=22;i++){
  const code='test'+String(i).padStart(2,'0');
  await db.query("insert into komi_collection_private.series_roster(series_id,character_id) values('alchemist',$1)",[code]);
  await db.query(`insert into komi_collection_private.series_unlocks(user_id,series_id,character_id,paid_request_id,created_at)
    values($1,'alchemist',$2,$3,'2026-11-27 00:00:00+00'::timestamptz + $4::int * interval '1 second')`,
    [a,code,id(i+10),i===22?21:i]);
 }
 await as(db,'authenticated',a);
 const rows=await read(db,'alchemist');
 assert.equal(rows.length,20);
 assert.deepEqual(rows.slice(0,3).map(row=>row.character_id),['test21','test22','test20']);
 assert.equal(rows[19].character_id,'test03');
});
