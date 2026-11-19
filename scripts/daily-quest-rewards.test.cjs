const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const sql=fs.readFileSync(path.join(__dirname,'../supabase/migrations/20261119193000_daily_quest_rewards.sql'),'utf8');
const app=fs.readFileSync(path.join(__dirname,'../app-main.js'),'utf8');
test('quest credit is server-validated, once per UTC day, and atomic',()=>{
  assert.match(sql,/primary key\(user_id,quest_day,quest_id\)/);
  assert.match(sql,/security definer set search_path = ''/);
  assert.match(sql,/auth\.uid\(\)/);
  assert.match(sql,/on conflict\(user_id,quest_day,quest_id\) do nothing/);
  assert.match(sql,/v_awarded := found/);
  assert.match(sql,/if v_awarded and v_coins>0 then/);
  assert.match(sql,/reason\)\s*values\(v_user,v_coins,'quest_daily'\)/);
  assert.match(sql,/revoke all on komi_private\.daily_quest_claims from public,anon,authenticated/);
  assert.match(sql,/grant execute on function public\.komi_daily_quests\(text,text\) to authenticated/);
});
test('all quests rely on actual server activity and Premium multiplier is server-side',()=>{
  assert.match(sql,/komi_private\.daily_activity_checkins/);
  assert.match(sql,/public\.komi_anicoin_ledger l[\s\S]+l\.reason='watch'/);
  assert.match(sql,/public\.komi_comments c/);
  assert.match(sql,/public\.komi_premium_badges b/);
  assert.match(sql,/v_base_xp\*3\/2/);
  assert.doesNotMatch(sql,/update\s+public\.komi_premium_rewards|insert\s+into\s+public\.komi_premium_rewards/i);
});
test('profile displays only authenticated server XP totals, not client-authored reward grant',()=>{
  assert.match(app,/\.rpc\('komi_daily_quests'/);
  assert.match(app,/komiQuestRewardState\.owner === currentUser\?\.authUserId/);
  assert.match(app,/quest_xp_total/);
  assert.match(app,/data-quest-reward-id/);
});
