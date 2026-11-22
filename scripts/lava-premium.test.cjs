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
 assert.match(page,/Два периода подписки с автоматическим продлением/);
 assert.match(page,/Автоматическая активация находится в бета-тестировании/);
 assert.match(page,/при задержке проверь статус покупки/);
 assert.match(page,/2000 XP/);
 assert.match(page,/500 AniCoin/);
 assert.doesNotMatch(page,/автоматически активируется|реклама отключена|без рекламы навсегда/i);
 assert.ok((page.match(/Lava\.top/g)||[]).length<=2,'Payment provider appears only in the consent summary');
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
 assert.match(js,/data\.discount_percent/);
 const premium=read('premium.html'),home=read('index.html');
 assert.match(premium,/komi-checkout\.js\?v=20261122e/);
 assert.match(home,/komi-checkout\.js\?v=20261122e/);
});

test('Monthly promo discount never silently continues or charges a different total',()=>{
 const js=read('komi-checkout.js'),css=read('komi-checkout.css');
 assert.match(js,/function unsupportedDiscount\(percent\)/);
 assert.match(js,/Промокод вводится в Lava.top/);
 assert.match(js,/unsupportedDiscount\(Number\(data\.discount_percent\)\)/);
 assert.match(js,/const PLANS=Object\.freeze\(/);
 assert.match(js,/promo\.input\.value=''/);
 assert.match(js,/if\(!codes\(\)\.ref\)\{external\(\);modal\.hidden=true;return;\}/);
 assert.match(js,/choosePlan\(requestedPlan==='yearly'\?'yearly':'monthly'\)/);
 assert.match(js,/selectedPlan=id/);
 assert.match(js,/window\.location\.assign\(CHECKOUT\)/);
 assert.match(css,/\.komi-checkout-invoice\[hidden\]/);
 assert.match(read('index.html'),/komi-checkout\.css\?v=20261122e/);
 assert.match(read('premium.html'),/komi-checkout\.css\?v=20261122e/);
});

test('Lava promo uses hosted provider checkout; local discount never fakes payment amount',()=>{
 const js=read('komi-checkout.js'),css=read('komi-checkout.css');
 assert.match(js,/const lavaPromo=node\('div'/);
 assert.match(js,/lavaPromoOpen\.href=CHECKOUT/);
 assert.match(js,/navigator\.clipboard\.writeText\(code\)/);
 assert.match(js,/Код .* найден в KomiAnime/);
 assert.match(js,/Реальную сумму покажет только Lava.top/);
 assert.match(js,/if\(c\.promo\)\{/);
 assert.match(js,/external\(\);modal\.hidden=true;return;/);
 assert.match(js,/link\.matches\('\.komi-checkout-direct, \.komi-checkout-lava-open'\)/);
 assert.match(js,/Прямой платёж через Lava.top не передаёт реферальный код KomiAnime/);
 assert.match(css,/\.komi-checkout-lava-promo\[hidden\]/);
 assert.doesNotMatch(js,/promoCode\s*:/);
 assert.doesNotMatch(js,/payment_amount\s*:/);
});

test('New Lava Premium pricing offers 1 month and 1 year, never creates legacy invoices',()=>{
 const js=read('komi-checkout.js');
 const studio=read('premium.html');
 const edge=read('supabase/functions/komi-checkout/index.ts');
 const rpc=read('supabase/migrations/20261122133000_lava_premium_yearly_expiry.sql');
 const webhook=read('supabase/functions/lava-premium-webhook/index.ts');
 assert.match(js,/monthly:\{price:'\$3\.99'/);
 assert.match(js,/yearly:\{price:'\$24\.85'/);
 assert.match(js,/data-komi-plan/);
 assert.match(js,/aria-pressed/);
 assert.match(js,/choosePlan\(requestedPlan==='yearly'\?'yearly':'monthly'\)/);
 assert.match(js,/На странице Lava.top обязательно выбери тот же период/);
 assert.doesNotMatch(js,/fetch\(DB\+'\/functions\/v1\/komi-checkout'/);
 assert.match(studio,/\$3\.99/);
 assert.match(studio,/\$24\.85/);
 assert.match(edge,/not mint invoices with mismatched local amount/);
 assert.match(edge,/return response\(\{error:'Для новых тарифов/);
 assert.match(rpc,/p_expiry <= p_event_at \+ interval '370 days'/);
 assert.match(rpc,/v_until := greatest\(v_until,p_expiry\)/);
 assert.match(rpc,/REVOKE ALL ON FUNCTION public\.komi_apply_lava_premium_event/);
 assert.match(webhook,/data\.willExpireAt/);
});
