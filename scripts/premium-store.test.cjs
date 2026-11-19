const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const sql=fs.readFileSync(path.join(__dirname,'../supabase/migrations/20261119211500_premium_anicoin_cosmetics.sql'),'utf8');
const js=fs.readFileSync(path.join(__dirname,'../komi-premium-store.js'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const premium=fs.readFileSync(path.join(__dirname,'../komi-premium.js'),'utf8');
test('Premium shop server validates active paid status and fixed prices',()=>{
 assert.match(sql,/b\.active_until>now\(\)/);
 assert.match(sql,/cost:=case p_item when 'frame_moon' then 30/);
 assert.match(sql,/when 'frame_aurora' then 45/);
 assert.match(sql,/when 'title_cinema' then 20/);
 assert.match(sql,/when 'title_starlight' then 25/);
 assert.match(sql,/wallet\.balance<cost/);
 assert.match(sql,/balance=balance-cost/);
 assert.match(sql,/for update/);
 assert.match(sql,/primary key\(user_id,item_id\)/);
 assert.match(sql,/exists\(select 1 from komi_private\.premium_store_purchases p/);
 assert.doesNotMatch(sql,/update\s+public\.komi_premium_rewards|komi_premium_contracts|lava|webhook/i);
});
test('public cosmetic equips can be seen only when Premium active, no browser writes',()=>{
 assert.match(sql,/enable row level security/);
 assert.match(sql,/revoke all on public\.komi_premium_cosmetic_equips from public,anon,authenticated/);
 assert.match(sql,/grant select\(user_id,frame_id,title_id\)/);
 assert.match(sql,/grant execute on function public\.komi_premium_store\(text,text\) to authenticated/);
 assert.match(sql,/revoke all on function public\.komi_premium_store\(text,text\) from public,anon,authenticated/);
});
test('store is integrated and inventory only rendered from server response',()=>{
 assert.doesNotThrow(()=>new vm.Script(js));
 assert.match(html,/src="\.\/komi-premium-store\.js"/);
 assert.match(premium,/KomiPremiumStore\?\.mount/);
 assert.match(js,/client\.rpc\('komi_premium_store'/);
 assert.match(js,/root\.KomiPremium\?\.isActiveId\?\.\(id\)/);
});
