const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {validMarker,mergeWatched,readWatched}=require('../player-ux.js');
test('cloud markers reject impossible episode coordinates',()=>{
  for(const value of ['1:0','1:12','14:998','1000:9999'])
    assert.equal(validMarker(value),true,value);
  for(const value of ['0:2','1001:0','1:10000','1:1;delete','oops','-1:2'])
    assert.equal(validMarker(value),false,value);
});
test('account-scoped cache merges cloud and local episodes without removing history',()=>{
  const original=global.localStorage;
  const values=new Map();
  global.localStorage={
    getItem:key=>values.get(key)??null,
    setItem:(key,value)=>values.set(key,value)
  };
  try{
    mergeWatched('ownerA','52991',['1:0','1:1']);
    mergeWatched('ownerA','52991',['1:1','2:4','99:10000']);
    assert.deepEqual(readWatched('ownerA','52991'),['1:0','1:1','2:4']);
    assert.deepEqual(readWatched('ownerB','52991'),[]);
    assert.deepEqual(readWatched('ownerA','123'),[]);
  }finally{
    if(original===undefined)delete global.localStorage;else global.localStorage=original;
  }
});
test('protected migration only grants SELECT and INSERT to authenticated users',()=>{
  const sql=fs.readFileSync(path.join(__dirname,'../supabase/migrations/20261112135133_private_watched_episode_markers.sql'),'utf8');
  const app=fs.readFileSync(path.join(__dirname,'../app-main.js'),'utf8');
  assert.match(sql,/enable row level security/i);
  assert.match(sql,/revoke all on public\.komi_watched_episodes from public, anon, authenticated/i);
  assert.match(sql,/grant select, insert on public\.komi_watched_episodes to authenticated/i);
  assert.match(sql,/using \(user_id = \(select auth\.uid\(\)\)\)/i);
  assert.match(sql,/with check \(user_id = \(select auth\.uid\(\)\)\)/i);
  assert.doesNotMatch(sql,/grant .*update|grant .*delete/i);
  assert.match(app,/client:watchedOwner \? _supabase : null/);
  assert.match(app,/ownerIsCurrent:/);
});
