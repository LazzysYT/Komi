const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const checkout='https://app.lava.top/products/b37a75ab-e500-4431-b61e-5c2a7e3edd8a/f1b11818-74d5-4e94-a013-15d89a545cdd';
test('Premium checkout routes to exact merchant subscription',()=>{
 const page=read('premium.html');
 assert.ok(page.includes(checkout));
 assert.match(page,/target="_blank" rel="noopener noreferrer"/);
 assert.match(page,/каждый месяц/);
 assert.match(page,/Автоматическая активация Premium внутри KomiAnime пока не подключена/);
 assert.doesNotMatch(page,/автоматически активируется|реклама отключена|без рекламы навсегда/i);
});
test('Premium visible from desktop, mobile and AniCoin shop without touching account permissions',()=>{
 const index=read('index.html');
 const shop=read('anicoin.js');
 assert.ok((index.match(/href="\/premium\.html"/g)||[]).length >= 3);
 assert.match(shop,/Komi Premium/);
 assert.match(shop,/href="\/premium\.html"/);
 assert.doesNotMatch(shop,/service_role|isAdmin\s*=\s*true|raw_user_meta_data/);
});

test('Lava checkout widget is embedded in both Premium page and shop',()=>{
 const page=read('premium.html');
 const shop=read('anicoin.js');
 const src='https://widget.lava.top/e5879a10-267e-4d27-bff1-e9c3b1562c2e';
 for(const file of [page,shop]){
   assert.ok(file.includes(src));
   assert.match(file,/<iframe[^>]+title="Lava\.top/);
   assert.match(file,/width="350" height="60"/);
   assert.match(file,/allow="payment"/);
 }
 assert.match(page,/Если виджет не открылся/);
 assert.match(page,/Автоматическая активация Premium внутри KomiAnime пока не подключена/);
 assert.doesNotMatch(page,/service_role|premium_active\s*=\s*true/);
});
