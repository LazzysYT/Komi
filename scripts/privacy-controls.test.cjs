const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const sql=fs.readFileSync(path.join(__dirname,'../supabase/migrations/20261119195000_private_presence_and_profiles.sql'),'utf8');
const app=fs.readFileSync(path.join(__dirname,'../app-main.js'),'utf8');
test('privacy settings are owner-scoped and server-protected',()=>{
  assert.match(sql,/komi_private\.user_privacy/);
  assert.match(sql,/enable row level security/);
  assert.match(sql,/revoke all on komi_private\.user_privacy from public,anon,authenticated/);
  assert.match(sql,/actor uuid:=auth\.uid\(\)/);
  assert.match(sql,/if p_action='update' then/);
  assert.match(sql,/grant execute on function public\.komi_privacy\(text,boolean,boolean\) to authenticated/);
});
test('hide profile keeps owner access and prevents other users reading via profile RLS',()=>{
  assert.match(sql,/drop policy if exists "komi profiles read"/);
  assert.match(sql,/user_id=\(select auth\.uid\(\)\) or \(select public\.komi_is_profile_visible\(user_id\)\)/);
  assert.match(sql,/where p\.user_id=p_user and p\.hide_profile/);
});
test('server presence removes invisible account from active count and heartbeat',()=>{
  assert.match(sql,/delete from komi_private\.site_presence where session_id=actor and user_id=actor/);
  assert.match(sql,/where x\.user_id=p\.user_id and x\.invisible/);
  assert.match(sql,/interval '6 seconds'/);
});
test('client sends only authenticated owner privacy options, no local entitlement',()=>{
  assert.match(app,/\.rpc\('komi_privacy'/);
  assert.match(app,/if\(!\['invisible','hide_profile'\]\.includes/);
  assert.match(app,/currentUser\?\.authUserId!==uid/);
  assert.match(app,/data-komi-privacy-panel/);
});
