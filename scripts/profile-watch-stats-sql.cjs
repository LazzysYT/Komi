'use strict';
// Run against an isolated embedded PostgreSQL; never uses a production connection.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {PGlite}=require(process.env.KOMI_PGLITE||'@electric-sql/pglite');
const sql=fs.readFileSync(path.join(__dirname,'../supabase/migrations/20261125195229_profile_watch_time.sql'),'utf8');
(async()=>{
 const db=new PGlite();
 try{
  await db.exec(`create role anon;
  create role authenticated;
  create schema auth;
  create table auth.users(id uuid primary key);
  create function auth.uid() returns uuid language sql stable as
  $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
  grant usage on schema auth to anon, authenticated;
  insert into auth.users values('00000000-0000-4000-8000-000000000001'),('00000000-0000-4000-8000-000000000002');`);
  await db.exec(sql);
  const a='00000000-0000-4000-8000-000000000001', b='00000000-0000-4000-8000-000000000002';
  const s='00000000-0000-4000-8000-000000000011', other='00000000-0000-4000-8000-000000000012';
  const set=async uid=>db.exec(`set role authenticated; set request.jwt.claim.sub='${uid}';`);
  const save=(uid,id,sec)=>db.query('select public.komi_save_watch_session($1,$2,$3) as saved',[uid,id,sec]);
  const total=async uid=>(await db.query('select public.komi_read_profile_watch_seconds($1) as sec',[uid])).rows[0].sec;
  await set(a);
  assert.equal(Number(await total(a)),0);
  for(const elapsed of [60,60,20,61])await save(a,s,elapsed);
  assert.equal(Number(await total(a)),61);
  await save(a,other,59);
  assert.equal(Number(await total(a)),120);
  await assert.rejects(()=>save(b,s,22),/Watch owner unavailable/);
  await assert.rejects(()=>save(a,s,-1),/Invalid watch time/);
  await set(b);
  assert.equal(await total(a),null);
  assert.equal(Number(await total(b)),0);
  assert.equal((await db.query('select user_id from public.komi_profile_watch_sessions')).rows.length,0);
  await save(b,s,1);
  assert.equal(Number(await total(b)),1);
  await db.exec('reset role; set role anon;');
  await assert.rejects(()=>total(a),/permission denied/);
  console.log('PASS real PostgreSQL: first minute, across sessions, retries, stale values, cross-user and anonymous access');
 }finally{await db.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
