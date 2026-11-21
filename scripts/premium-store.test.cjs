const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..');
const original=fs.readFileSync(path.join(root,'supabase/migrations/20261119211500_premium_anicoin_cosmetics.sql'),'utf8');
const migration=fs.readFileSync(path.join(root,'supabase/migrations/20261122050000_anicoin_shop_2_cosmetics.sql'),'utf8');
const socialMigration=fs.readFileSync(path.join(root,'supabase/migrations/20261122060000_anicoin_social_gifts_highlights_reactions_boosters.sql'),'utf8');
const catalog=fs.readFileSync(path.join(root,'komi-shop-catalog.js'),'utf8');
const profile=fs.readFileSync(path.join(root,'komi-premium-store.js'),'utf8');
const coin=fs.readFileSync(path.join(root,'anicoin.js'),'utf8');
const studio=fs.readFileSync(path.join(root,'premium-studio.js'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const standalone=fs.readFileSync(path.join(root,'premium.html'),'utf8');
const premium=fs.readFileSync(path.join(root,'komi-premium.js'),'utf8');
const context={window:{}};
vm.runInNewContext(catalog,context);
const products=context.window.KomiShopCatalog.items;
test('54 permanent items and reaction packs share fixed server prices',()=>{
 assert.equal(products.length,54);
 assert.equal(new Set(products.map(x=>x.id)).size,54);
 assert.deepEqual([...new Set(products.map(x=>x.type))].sort(),['banner','card','frame','icon','overlay','reaction','showcase','title']);
 for(const item of products){
   assert.ok(Number.isInteger(item.cost)&&item.cost>0);
   assert.match(socialMigration,new RegExp("when '"+item.id+"' then "+item.cost+"\\b"));
   assert.match(socialMigration,new RegExp("'"+item.id+"'"));
 }
 assert.match(original,/primary key\(user_id,item_id\)/);
 assert.match(socialMigration,/wallet\.balance<cost/);
 assert.match(socialMigration,/balance=balance-cost/);
 assert.match(socialMigration,/for update/);
 assert.match(socialMigration,/exists\(select 1 from komi_private\.premium_store_purchases p/);
 assert.doesNotMatch(migration,/update\s+public\.komi_premium_rewards|komi_premium_contracts|lava|webhook/i);
});
test('server authenticates buyers, prevents raw client writes, and exposes cosmetic equip via RLS',()=>{
 assert.match(migration,/auth\.uid\(\)/);
 assert.match(migration,/u\.is_anonymous is not true/);
 assert.match(migration,/alter table public\.komi_premium_cosmetic_equips add column if not exists icon_id text/);
 assert.match(migration,/grant select\(user_id,frame_id,title_id,banner_id,overlay_id,showcase_id,card_id,icon_id\)/);
 assert.match(migration,/p_action in \('buy','buy_equip'\)/);
 assert.match(migration,/revoke all on function public\.komi_premium_store\(text,text\) from public,anon,authenticated/);
 assert.match(migration,/grant execute on function public\.komi_premium_store\(text,text\) to authenticated/);
 assert.match(migration,/Purchase required before equipping/);
 assert.match(migration,/where user_id=actor and icon_id=p_item/);
});
test('shared cosmetics are integrated into both shops and public profile',()=>{
 for(const script of [catalog,profile,coin,studio])assert.doesNotThrow(()=>new vm.Script(script));
 assert.match(html,/src="\.\/komi-shop-catalog\.js\?/);
 assert.match(html,/src="\.\/komi-premium-store\.js\?/);
 assert.match(html,/src="\.\/anicoin\.js\?/);
 assert.match(standalone,/src="\/komi-shop-catalog\.js\?/);
 assert.match(standalone,/id="store-filters"/);
 assert.match(profile,/root\.KomiShopCatalog/);
 assert.match(profile,/client\.rpc\('komi_premium_store'/);
 assert.match(coin,/rpc\('komi_premium_store'/);
 assert.match(studio,/rpc\('komi_premium_store'/);
 assert.match(premium,/KomiPremiumStore\?\.mount/);
 assert.match(studio,/banner_id/);
 assert.match(profile,/banner_id/);
});

test('guest shop first paint and real preview have no auth dependency',()=>{
 const initial=fs.readFileSync(path.join(root,'shop-first-paint.js'),'utf8');
 assert.match(html,/class="komi-static-shop"/);
 assert.match(html,/class="komi-shop-static-card"/);
 assert.match(html,/src="\/shop-first-paint\.js\?/);
 assert.match(initial,/location\.hash==='\#shop'/);
 assert.match(coin,/data-shop-preview/);
 assert.match(coin,/komiShopPreviewDialog/);
 assert.match(coin,/data-komi-shop-avatar/);
 assert.match(coin,/buy_equip/);
 assert.match(studio,/buy_equip/);
 assert.match(profile,/overlay_id/);
 assert.match(profile,/icon_id/);
 assert.match(profile,/showcase_id/);
 assert.match(studio,/card_id/);
 assert.doesNotMatch(initial,/supabase|auth\.getUser/);
});

test('social shop enforces ownership, friend relationships, pack access and verified quest boosters',()=>{
  for(const action of ['komi_shop_gifts','komi_shop_highlight','komi_shop_booster','komi_shop_reaction']){
    assert.match(socialMigration,new RegExp('create or replace function public\\.'+action+'\\('));
    assert.match(socialMigration,new RegExp('revoke all on function public\\.'+action));
  }
  assert.match(socialMigration,/f\.user_a=actor and f\.user_b=p_recipient/);
  assert.match(socialMigration,/f\.user_b=actor and f\.user_a=p_recipient/);
  assert.match(socialMigration,/v_wallet\.balance<v_price/);
  assert.match(socialMigration,/values\(p_recipient,p_item,0,'gift'\)/);
  assert.match(socialMigration,/when v_booster then v_base_xp\*2/);
  assert.match(socialMigration,/v_base_xp\*3\/2/);
  assert.match(socialMigration,/comment_id=p_comment_id and expires_at>now\(\)/);
  assert.match(socialMigration,/c\.id=p_comment_id and c\.user_id=actor/);
  assert.match(socialMigration,/party_invite_is_valid/);
  assert.match(socialMigration,/where p\.user_id=actor and p\.item_id=v_pack/);
  assert.match(socialMigration,/shop_consumable_orders/);
  assert.doesNotMatch(socialMigration,/random\s*\(|lottery|roulette|lootbox/i);
});

test('all social UI modules parse and show the correct checkout contract',()=>{
  const gift=fs.readFileSync(path.join(root,'komi-shop-social.js'),'utf8');
  const comments=fs.readFileSync(path.join(root,'komi-comments.js'),'utf8');
  const watch=fs.readFileSync(path.join(root,'watch-party.js'),'utf8');
  for(const source of [gift,comments,watch])assert.doesNotThrow(()=>new vm.Script(source));
  assert.match(html,/src="\.\/komi-shop-social\.js\?/);
  assert.match(html,/src="\.\/komi-comments\.js\?/);
  assert.match(watch,/komi_shop_reaction/);
  assert.match(comments,/komi_shop_highlight/);
  assert.match(gift,/komi_shop_gifts/);
  assert.match(gift,/komi_shop_booster/);
  assert.match(coin,/product\.type==='reaction'/);
  assert.match(studio,/product\.type==='reaction'/);
  assert.match(profile,/product\.type==='reaction'/);
  assert.equal(products.filter(x=>x.type==='reaction').length,3);
  assert.ok(products.filter(x=>x.type==='reaction').every(x=>x.reactions.length===3));
});
