const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const sql=fs.readFileSync(path.join(__dirname,'../supabase/migrations/20261119214500_server_verified_premium_xp.sql'),'utf8');
const app=fs.readFileSync(path.join(__dirname,'../app-main.js'),'utf8');
test('server authenticates player and calculates XP only from real database rows',()=>{
 assert.match(sql,/auth\.uid\(\)/);
 assert.match(sql,/u\.is_anonymous is not true/);
 assert.match(sql,/join public\.anime_catalog c on c\.shikimori_id=l\.anime_id/);
 assert.match(sql,/public\.komi_friendships f/);
 assert.match(sql,/public\.komi_premium_badges p/);
 assert.match(sql,/public\.komi_premium_rewards r/);
 assert.match(sql,/komi_private\.daily_quest_claims q/);
 assert.match(sql,/revoke all on function public\.komi_verified_xp\(\) from public,anon,authenticated/);
 assert.match(sql,/grant execute on function public\.komi_verified_xp\(\) to authenticated/);
});
test('Premium XP multiplier is server-controlled, excludes gift and previously awarded quests',()=>{
 assert.match(sql,/base_xp\*3\/2/);
 assert.match(sql,/\+welcome_xp\+quest_xp/);
 assert.match(sql,/b?\.active_until>now\(\)/);
 assert.doesNotMatch(sql,/update public\.|insert into public\.|delete from public\./i);
});
test('owner profile only reads verified XP, with cross-account cache isolation',()=>{
 assert.match(app,/\.rpc\('komi_verified_xp'\)/);
 assert.match(app,/komiServerXpState\.owner===currentUser\?\.authUserId/);
 assert.match(app,/const xp=verified\?\.xp \?\?/);
 assert.match(app,/currentUser\?\.authUserId!==owner/);
});
