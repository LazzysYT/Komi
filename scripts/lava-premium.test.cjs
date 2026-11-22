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

test('Checkout click is not lost to input blur; discount fallback requires explicit action',()=>{
 const js=read('komi-checkout.js');
 assert.doesNotMatch(js,/addEventListener\('blur'/);
 assert.match(js,/continueFull\.onclick/);
 assert.match(js,/promo\.input\.value=''/);
 assert.match(js,/komi-checkout-direct, \.komi-checkout-lava-open/);
 assert.match(js,/window\.location\.assign\(CHECKOUT\)/);
 assert.match(js,/checked\.discount_percent/);
 const premium=read('premium.html'),home=read('index.html');
 assert.match(premium,/komi-checkout\.js\?v=20261122c/);
 assert.match(home,/komi-checkout\.js\?v=20261122c/);
});

test('Monthly promo discount never silently continues or charges a different total',()=>{
 const js=read('komi-checkout.js'),css=read('komi-checkout.css');
 assert.match(js,/function unsupportedDiscount\(percent\)/);
 assert.match(js,/Промокоды Lava.top вводятся и проверяются на странице оплаты Lava.top/);
 assert.match(js,/unsupportedDiscount\(Number\(checked\.discount_percent\)\)/);
 assert.match(js,/continueFull\.focus\(\)/);
 assert.match(js,/promo\.input\.value=''/);
 assert.match(js,/if\(!codes\(\)\.ref\)\{external\(\);modal\.hidden=true;return;\}/);
 assert.match(js,/invoiceLink\.href=uri\.href/);
 assert.match(js,/invoiceLink\.hidden=false/);
 assert.match(js,/parsed\.hostname|uri\.hostname/);
 assert.match(css,/\.komi-checkout-invoice\[hidden\]/);
 assert.match(read('index.html'),/komi-checkout\.css\?v=20261122c/);
 assert.match(read('premium.html'),/komi-checkout\.css\?v=20261122c/);
});

test('Lava promo uses hosted provider checkout; local discount never fakes payment amount',()=>{
 const js=read('komi-checkout.js'),css=read('komi-checkout.css');
 assert.match(js,/const lavaPromo=node\('div'/);
 assert.match(js,/lavaPromoOpen\.href=CHECKOUT/);
 assert.match(js,/navigator\.clipboard\.writeText\(code\)/);
 assert.match(js,/Код .* найден в KomiAnime/);
 assert.match(js,/Реальную сумму покажет только Lava.top/);
 assert.match(js,/if\(!lavaPromo\.hidden\)\{/);
 assert.match(js,/external\(\);modal\.hidden=true;return;/);
 assert.match(js,/link\.matches\('\.komi-checkout-direct, \.komi-checkout-lava-open'\)/);
 assert.match(js,/реферальный код KomiAnime не передаётся/);
 assert.match(css,/\.komi-checkout-lava-promo\[hidden\]/);
 assert.doesNotMatch(js,/promoCode\s*:/);
 assert.doesNotMatch(js,/payment_amount\s*:/);
});
