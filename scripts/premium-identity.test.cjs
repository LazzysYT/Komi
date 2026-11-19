const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const sql=fs.readFileSync(path.join(__dirname,'../supabase/migrations/20261119202000_premium_profile_identity.sql'),'utf8');
const js=fs.readFileSync(path.join(__dirname,'../komi-premium-decor.js'),'utf8');
const premium=fs.readFileSync(path.join(__dirname,'../komi-premium.js'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
test('Cosmetic options remain server-limited to verified active Premium owner',()=>{
 assert.match(sql,/nick_theme between 0 and 5/);
 assert.match(sql,/status_emoji in/);
 assert.match(sql,/music_theme between 0 and 2/);
 assert.match(sql,/user_id=\(select auth.uid\(\)\)/);
 assert.match(sql,/b\.active_until>now\(\)/);
 assert.match(sql,/enable row level security/);
 assert.doesNotMatch(sql,/komi_premium_rewards|payment|webhook|wallets|anicoin/i);
});
test('Premium source loads with membership bridge, with only whitelisted gradient values',()=>{
 assert.doesNotThrow(()=>new vm.Script(js));
 assert.ok(html.indexOf('komi-premium-decor.js')>html.indexOf('komi-premium-themes.js'));
 assert.ok(html.indexOf('komi-premium-decor.js')<html.indexOf('app-main.js'));
 assert.match(premium,/KomiPremiumDecor\?\.setClient/);
 assert.match(premium,/KomiPremiumDecor\?\.mount/);
 assert.match(js,/isActiveId\?\.\(id\)/);
 assert.match(js,/allowedEmoji\.includes/);
});
test('Music is generated from original tones and opt-in only; no autoplay or external song',()=>{
 assert.match(js,/button\.addEventListener\('click'/);
 assert.match(js,/const Ctx=root\.AudioContext/);
 assert.match(js,/stopAudio\(\)/);
 assert.doesNotMatch(js,/new Audio\(|<audio|mp3|soundcloud|spotify|youtube/i);
});
