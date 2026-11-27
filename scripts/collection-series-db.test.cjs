// Local PostgreSQL WASM verification; never contacts Supabase or uses live credentials.
// Run: KOMI_TEST_PGLITE=/path/to/pglite/dist/index.cjs node --test scripts/collection-series-db.test.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {test} = require('node:test');
const here = path.resolve(__dirname, '..');
const base = process.env.KOMI_COLLECTION_TEST_BASE || (fs.existsSync(path.join(here, 'supabase/migrations/20261126193000_komi_collection_cases.sql')) ?
  here : path.resolve(here, '../komi-ghoul-album'));
let PGlite;
try { ({PGlite} = require(process.env.KOMI_TEST_PGLITE || '@electric-sql/pglite')); }
catch (error) { if (process.env.KOMI_TEST_PGLITE || error.code !== 'MODULE_NOT_FOUND') throw error; }
const localTest=(name,run)=>test(name,{skip:!PGlite&&'Set KOMI_TEST_PGLITE or install the local PostgreSQL WASM dependency'},run);
const migration = (root, f) => fs.readFileSync(path.join(root, 'supabase/migrations', f), 'utf8');
const id = n => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');
const ownerA = id(1001), ownerB = id(1002), anonA = id(1003), ownerNoWallet = id(1004);
async function fixture() {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth;
    create table auth.users(id uuid primary key,is_anonymous boolean default false);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid
    $$;
    create function auth.jwt() returns jsonb language sql stable as $$
      select coalesce(nullif(current_setting('request.jwt.claims', true),''),'{}')::jsonb
    $$;
    grant usage on schema auth to anon, authenticated;
    grant execute on function auth.uid(),auth.jwt() to anon,authenticated;
  `);
  for (const m of [
    '202611090003_anicoin_shop.sql',
    '20261126193000_komi_collection_cases.sql',
    '20261126195000_komi_collection_paid_cases.sql',
    '20261126195100_komi_collection_paid_only.sql'
  ]) await db.exec(migration(base, m));
  await db.query('insert into auth.users(id,is_anonymous) values($1,false),($2,false),($3,true),($4,false)',
    [ownerA,ownerB,anonA,ownerNoWallet]);
  await db.query('insert into public.komi_anicoin_wallets(user_id,balance,watch_seconds) values($1,1051,42),($2,51,0),($3,100,0)',
    [ownerA,ownerB,anonA]);
  await db.query("insert into komi_collection_private.unlocks(user_id,character_id,opened_on) values($1,'kaneki','2026-11-25')",[ownerA]);
  const old = await db.query(`select pg_get_functiondef('public.komi_collection_buy(uuid)'::regprocedure) as buy,
    pg_get_functiondef('public.komi_collection_action(text)'::regprocedure) as read`);
  await db.exec(migration(here, '20261127080152_komi_collection_series.sql'));
  const oldAfter = await db.query(`select pg_get_functiondef('public.komi_collection_buy(uuid)'::regprocedure) as buy,
    pg_get_functiondef('public.komi_collection_action(text)'::regprocedure) as read`);
  assert.deepEqual(oldAfter.rows, old.rows);
  return db;
}
async function as(db, role, user = '', jwt = {}) {
  assert.ok(['anon','authenticated','service_role'].includes(role));
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub',$1,false), set_config('request.jwt.claims',$2,false)",[user,JSON.stringify(jwt)]);
  await db.exec('set role ' + role);
}
const read = async(db,series) => (await db.query('select public.komi_collection_series_read($1) as v',[series])).rows[0].v;
const buy = async(db,series,request) => (await db.query('select public.komi_collection_series_buy($1,$2) as v',[series,request])).rows[0].v;
const all = {
  jujutsu:['itadori','fushiguro','kugisaki','gojo','sukuna','maki','toge','panda','nanami','yuta'],
  frieren:['frieren','fern','stark','himmel','heiter','eisen','flamme','serie','denken','ubel'],
  alchemist:['edward','alphonse','winry','roy','riza','alex','maes','scar','olivier','lanfan']
};
const sameMembers = (l,r) => assert.deepEqual([...l].sort(),[...r].sort());

localTest('three series share wallet, draw only missing cards, keep legacy Tokyo Ghoul independent, and retry the same result', async t => {
  const db = await fixture();
  t.after(()=>db.close());
  await as(db,'authenticated',ownerA);
  assert.deepEqual(await read(db,'jujutsu'),{
    owned:[], can_open:false, next_at:null, result:null, balance:1051, price:50, purchase_status:null
  });
  let original;
  for(const [j,series] of ['jujutsu','frieren'].entries()){
    for(let i=0;i<10;i++){
      const out=await buy(db,series,id(j*20+i+1));
      if(j===0&&i===0) original=out.result;
      assert.equal(out.purchase_status,'ok');
      assert.equal(out.result && all[series].includes(out.result),true);
      assert.equal(out.owned.length,i+1);
      assert.equal(out.balance,1051-(j*10+i+1)*50);
    }
    sameMembers((await read(db,series)).owned,all[series]);
    assert.equal((await buy(db,series,id(j*20+19))).purchase_status,'complete');
  }
  await assert.rejects(buy(db,'alchemist',id(1)),{code:'22023'});
  const retry = await buy(db,'jujutsu',id(1));
  assert.equal(retry.result,original);
  assert.equal(retry.balance,51);
  assert.equal(retry.purchase_status,'ok');
  const alchemy = await buy(db,'alchemist',id(40));
  assert.equal(alchemy.purchase_status,'ok');
  assert.equal(alchemy.owned.length,1);
  assert.ok(all.alchemist.includes(alchemy.result));
  assert.equal(alchemy.balance,1);
  const poor = await buy(db,'alchemist',id(41));
  assert.equal(poor.purchase_status,'insufficient');
  assert.equal(poor.result,null);
  assert.equal(poor.balance,1);
  assert.deepEqual(poor.owned,alchemy.owned);
  const legacy = (await db.query("select public.komi_collection_action('read') as v")).rows[0].v;
  assert.deepEqual(legacy.owned,['kaneki']);
  assert.equal(legacy.balance,1);
  await db.exec('reset role');
  const w=(await db.query('select watch_seconds,balance from public.komi_anicoin_wallets where user_id=$1',[ownerA])).rows[0];
  assert.equal(w.watch_seconds,42);
  assert.equal(w.balance,1);
});

localTest('private wallet/roster/ownership writes are not exposed; caller and series own every read and spend', async t=>{
  const db=await fixture();
  t.after(()=>db.close());
  await as(db,'anon');
  await assert.rejects(read(db,'jujutsu'),{code:'42501'});
  await assert.rejects(buy(db,'jujutsu',id(1)),{code:'42501'});
  await as(db,'authenticated',anonA,{is_anonymous:true});
  await assert.rejects(read(db,'frieren'),{code:'42501'});
  await assert.rejects(buy(db,'frieren',id(1)),{code:'42501'});
  // Server-side account state also blocks anonymously created accounts.
  await as(db,'authenticated',anonA);
  await assert.rejects(read(db,'alchemist'),{code:'42501'});
  await as(db,'authenticated',id(9999));
  await assert.rejects(read(db,'alchemist'),{code:'42501'});
  await as(db,'authenticated',ownerA);
  await assert.rejects(read(db,'missing'),{code:'22023'});
  await assert.rejects(read(db,null),{code:'22023'});
  await assert.rejects(buy(db,'alchemist',null),{code:'22023'});
  const ownedA = await buy(db,'jujutsu',id(1));
  assert.equal(ownedA.balance,1001);
  const acl = (await db.query(`select
    has_table_privilege(current_user, 'komi_collection_private.series_roster', 'SELECT') as roster_read,
    has_table_privilege(current_user, 'komi_collection_private.series_unlocks', 'SELECT') as unlock_read,
    has_table_privilege(current_user, 'komi_collection_private.series_unlocks', 'INSERT') as unlock_write,
    has_table_privilege(current_user, 'public.komi_anicoin_wallets', 'UPDATE') as wallet_write`)).rows[0];
  assert.deepEqual(acl,{roster_read:false,unlock_read:false,unlock_write:false,wallet_write:false});
  await as(db,'authenticated',ownerB);
  assert.deepEqual((await read(db,'jujutsu')).owned,[]);
  assert.equal((await read(db,'jujutsu')).balance,51);
  const ownedB=await buy(db,'jujutsu',id(1));
  assert.equal(ownedB.purchase_status,'ok');
  assert.equal(ownedB.owned.length,1);
  assert.equal(ownedB.balance,1);
  await as(db,'authenticated',ownerNoWallet);
  assert.equal((await buy(db,'frieren',id(1))).purchase_status,'insufficient');
  await db.exec('reset role');
  const empty = (await db.query('select count(*)::int as n from public.komi_anicoin_wallets where user_id=$1',[ownerNoWallet])).rows[0];
  assert.equal(empty.n,0);
  const privateTables = (await db.query(`select count(*)::int as n
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='komi_collection_private' and c.relname in ('series_roster','series_unlocks') and c.relrowsecurity`)).rows[0];
  assert.equal(privateTables.n,2);
});

localTest('failed reward insert rolls the wallet debit back atomically', async t=>{
  const db=await fixture();
  t.after(()=>db.close());
  await db.exec(`
    create function komi_collection_private.reject_fixture() returns trigger language plpgsql as $$
    begin
      raise exception 'test-only forced reward rejection' using errcode='23514';
    end;
    $$;
    create trigger reject_fixture before insert on komi_collection_private.series_unlocks
      for each row execute function komi_collection_private.reject_fixture();
  `);
  await as(db,'authenticated',ownerA);
  await assert.rejects(buy(db,'frieren',id(1)),{code:'23514'});
  const snapshot=await read(db,'frieren');
  assert.equal(snapshot.balance,1051);
  assert.deepEqual(snapshot.owned,[]);
  await db.exec('reset role');
  await db.exec('drop trigger reject_fixture on komi_collection_private.series_unlocks');
  await as(db,'authenticated',ownerA);
  assert.equal((await buy(db,'frieren',id(1))).balance,1001);
});
