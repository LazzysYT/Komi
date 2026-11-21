const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const checkout='https://app.lava.top/products/b37a75ab-e500-4431-b61e-5c2a7e3edd8a/f1b11818-74d5-4e94-a013-15d89a545cdd?currency=USD';

test('Premium checkout has a working native clickable checkout link, not a broken iframe',()=>{
 const page=read('premium.html');
 assert.ok(page.includes(checkout));
 assert.match(page,/premium-checkout[^>]*href="https:\/\/app\.lava\.top\/products\/[^" ]+\?currency=USD"/);
 assert.doesNotMatch(page,/\/f1b11818-74d5-4e94-a013-15d89a545cdd\"/);
 assert.match(page,/<a class="button" id="premium-checkout" href="https:\/\/app\.lava\.top\/products\//);
 assert.match(page,/target="_blank" rel="noopener noreferrer"/);
 assert.match(page,/Оформить Premium/);
 assert.doesNotMatch(page,/<iframe/i);
 assert.doesNotMatch(page,/widget\.lava\.top/);
});

test('Komi Premium discloses recurring terms and verified access without false guarantees',()=>{
 const page=read('premium.html');
 assert.match(page,/Ежемесячная подписка с автоматическим продлением/);
 assert.match(page,/Автоматическая активация находится в бета-тестировании/);
 assert.match(page,/при задержке проверь статус покупки/);
 assert.match(page,/2000 XP/);
 assert.match(page,/500 AniCoin/);
 assert.doesNotMatch(page,/автоматически активируется|реклама отключена|без рекламы навсегда/i);
 assert.ok((page.match(/Lava\.top/g)||[]).length<=1,'Payment processor is not repeated');
});

test('Shop links directly to checkout and also to Premium details',()=>{
 const shop=read('anicoin.js');
 const index=read('index.html');
 assert.ok(shop.includes(checkout));
 assert.match(shop,/Стоимость будет показана в USD/);
 assert.match(shop,/после подтверждённой активации аккаунта/);
 assert.match(shop,/href="\/premium\.html"/);
 assert.match(shop,/Оформить Premium/);
 assert.ok((index.match(/href="\/premium\.html"/g)||[]).length>=3);
 assert.doesNotMatch(shop,/widget\.lava\.top|komi-lava-checkout/);
 assert.doesNotMatch(shop,/service_role|isAdmin\s*=\s*true|raw_user_meta_data/);
});
