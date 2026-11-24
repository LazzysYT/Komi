const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..');
const original=fs.readFileSync(path.join(root,'supabase/migrations/20261119211500_premium_anicoin_cosmetics.sql'),'utf8');
const migration=fs.readFileSync(path.join(root,'supabase/migrations/20261122050000_anicoin_shop_2_cosmetics.sql'),'utf8');
const socialMigration=fs.readFileSync(path.join(root,'supabase/migrations/20261122060000_anicoin_social_gifts_highlights_reactions_boosters.sql'),'utf8');
const visualMigration=fs.readFileSync(path.join(root,'supabase/migrations/20261122070000_anicoin_visual_collections.sql'),'utf8');
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
test('85 fixed-price cosmetic items stay consistent between client catalog and protected server',()=>{
 assert.equal(products.length,85);
 assert.equal(new Set(products.map(x=>x.id)).size,85);
 assert.deepEqual([...new Set(products.map(x=>x.type))].sort(),['banner','card','frame','icon','mascot','name','overlay','plate','reaction','shape','showcase','title','xp']);
 for(const item of products){
   assert.ok(Number.isInteger(item.cost)&&item.cost>0);
   assert.match(visualMigration,new RegExp("\\('"+item.id+"',"+item.cost+",true\\)"));
   assert.match(visualMigration,new RegExp("'"+item.id+"'"));
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
 assert.match(html,/class="komi-static-shop komi-shop-v3 komi-shop-v4 komi-shop-v5"/);
 assert.match(html,/class="sv5-static-card"/);
  assert.match(html,/class="sv5-weekly"/);
 assert.match(html,/src="\/shop-first-paint\.js\?/);
 assert.match(initial,/location\.hash\.toLowerCase\(\)==='#shop'/);
 assert.match(initial,/location\.pathname==='\/shop'/);
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

test('visual collections preserve ownership, equip slots, free sets and accessible previews',()=>{
 const css=fs.readFileSync(path.join(root,'komi-shop-visual.css'),'utf8');
 const comments=fs.readFileSync(path.join(root,'komi-comments.js'),'utf8');
 const main=fs.readFileSync(path.join(root,'app-main.js'),'utf8');
 assert.equal(context.window.KomiShopCatalog.sets.length,3);
 for(const set of context.window.KomiShopCatalog.sets){
  assert.equal(set.items.length,3);
  assert.ok(set.items.every(id=>products.some(p=>p.id===id)));
 }
 const testSet=context.window.KomiShopCatalog.sets[0];
 assert.equal(context.window.KomiShopCatalog.activeSets({frame_id:testSet.items[0],shape_id:testSet.items[1],title_id:testSet.items[2]}).length,1);
 assert.equal(context.window.KomiShopCatalog.activeSets({frame_id:testSet.items[0]}).length,0);
 for(const type of ['shape','plate','mascot','xp','name']){
  assert.match(visualMigration,new RegExp("add column if not exists "+type+"_id text"));
  assert.match(visualMigration,new RegExp("kind='"+type+"'"));
  assert.match(profile,new RegExp(type+"_id"));
  assert.match(studio,new RegExp("activeItem\\('"+type+"'\\)"));
 }
 assert.match(visualMigration,/select p\.cost into cost from komi_private\.shop_item_prices p/);
 assert.match(visualMigration,/auth\.uid\(\)/);
 assert.match(visualMigration,/u\.is_anonymous is not true/);
 assert.match(visualMigration,/for update/);
 assert.match(visualMigration,/Purchase required before equipping/);
 assert.match(visualMigration,/grant execute on function public\.komi_premium_store\(text,text\) to authenticated/);
 assert.match(html,/komi\.production\.css\?v=/);
 assert.match(standalone,/komi-shop-visual\.css\?v=/);
 assert.match(coin,/komi-shop-rarity/);
 assert.match(coin,/komi-shop-set-card/);
 assert.match(studio,/preview-shop-xp/);
 assert.match(profile,/KomiShopCatalog\?\.activeSets/);
 assert.match(comments,/komi_premium_cosmetic_equips/);
 assert.match(comments,/plate_id,name_id/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 assert.match(css,/komi-store-frame-sumi/);
 assert.match(css,/komi-store-shape-octagon/);
 assert.match(css,/komi-store-xp-silver/);
 assert.match(main,/profile-xp-capsule/);
 assert.doesNotMatch(visualMigration,/random\s*\(|lootbox|roulette|casino/i);
 assert.ok(products.every(p=>['common','rare','epic','legendary'].includes(p.rarity)));
});
