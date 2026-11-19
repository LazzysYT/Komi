const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const sql = fs.readFileSync(path.join(__dirname,'../supabase/migrations/20261119190000_episode_follow_notifications.sql'),'utf8');
const app = fs.readFileSync(path.join(__dirname,'../app-main.js'),'utf8');
test('following is voluntary, unique per user and anime, with owner-only RLS',()=>{
  assert.match(sql,/primary key\(user_id,anime_id\)/i);
  assert.match(sql,/enable row level security/i);
  assert.match(sql,/for select to authenticated using\(user_id=\(select auth.uid\(\)\)\)/i);
  assert.match(sql,/for insert to authenticated with check\(user_id=\(select auth.uid\(\)\)\)/i);
  assert.match(sql,/for delete to authenticated using\(user_id=\(select auth.uid\(\)\)\)/i);
  assert.match(sql,/revoke all on public\.komi_episode_follows from public,anon,authenticated/i);
});
test('system notifications are emitted only for catalog episode growth, not on import',()=>{
  assert.match(sql,/after update of data on public\.anime_catalog/i);
  assert.match(sql,/old_count < 1 or new_count <= old_count or new_count > old_count\+3/i);
  assert.match(sql,/insert into public\.komi_notifications\(recipient_id,actor_id,kind,message\)/i);
  assert.doesNotMatch(sql,/komi_anicoin|wallet|premium_rewards|delete from public\.komi_notifications/i);
});
test('client writes own follow record, never creates notifications or currency',()=>{
  assert.match(app,/async function komiMountFollowButton\(anime\)/);
  assert.match(app,/currentUser\?\.authUserId === owner/);
  assert.match(app,/\.from\('komi_episode_follows'\)\.insert\(\{user_id:owner,anime_id:animeId\}\)/);
  assert.doesNotMatch(app.slice(app.indexOf('async function komiMountFollowButton'),app.indexOf('function saveProgress',app.indexOf('async function komiMountFollowButton'))),/\.from\('komi_notifications'\)|\.rpc\('komi_anicoin'\)/);
});
