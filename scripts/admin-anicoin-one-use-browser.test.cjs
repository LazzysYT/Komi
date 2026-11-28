'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
let chromium;try{({chromium}=require('playwright'));}catch{}
const root=path.resolve(__dirname,'..'),origin='https://komi.test';
test('admin creates and copies an AniCoin gift once, lists only hints and confirms revoke', {skip:!chromium,timeout:25000},async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.KOMI_CHROMIUM||undefined});
 try{
  for(const width of [320,1440]){
   const page=await browser.newPage({viewport:{width,height:840}});
   page.setDefaultTimeout(5000);
   const errors=[];page.on('pageerror',error=>errors.push(error.message));
   await page.route('**/*',route=>{
    const u=new URL(route.request().url());
    if(u.origin!==origin)return route.abort();
    if(u.pathname==='/')return route.fulfill({contentType:'text/html',body:'<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="background:#09090b"><main id="workspace"></main><script src="/komi-referral-admin.js"></script>'});
    if(/^\/komi-referral-admin\.(js|css)$/.test(u.pathname))return route.fulfill({path:path.join(root,u.pathname.slice(1))});
    return route.abort();
   });
   await page.goto(origin);
   await page.evaluate(async()=>{
    window.calls=[];window.copied=[];window.statusOfGift='active';
    const code='KOMI-AC-01234567-89ABCDEF-00112233-44556677';
    Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>copied.push(text)}});
    await komiReferralAdminUI(document.querySelector('main'),{rpc:async(name,args)=>{
     calls.push({name,args});
     if(name==='admin_referral_report')return {data:{codes:[],entries:[],orders:[]}};
     if(name==='admin_discount_promo_report')return {data:[]};
     if(name==='komi_admin_anicoin_code_list')return {data:window.hasGift?[{id:'gift',hint:'…6677',amount:42,status:statusOfGift,created_at:'2026-11-28T00:00:00Z'}]:[]};
     if(name==='komi_admin_anicoin_code_create'){window.hasGift=true;return {data:{id:'gift',code,amount:42,status:'active'}};}
     if(name==='komi_admin_anicoin_code_revoke'){window.statusOfGift='revoked';return {data:{status:'revoked'}};}
     throw Error('Unexpected request '+name);
    }});
   });
   const panel=page.locator('#ra-one-use');
   assert.equal(await page.evaluate(()=>calls.some(r=>r.name.includes('anicoin_code'))),false);
   await panel.locator('summary').click();
   await panel.getByText('Одноразовых кодов пока нет.').waitFor();
   await panel.getByLabel('Сколько AniCoin начислить').fill('42');
   await panel.getByRole('button',{name:'Создать код'}).click();
   await panel.getByLabel('Новый код').waitFor();
   assert.match(await panel.getByLabel('Новый код').inputValue(),/^KOMI-AC-(?:[0-9A-F]{8}-){3}[0-9A-F]{8}$/);
   await panel.getByRole('button',{name:'Скопировать',exact:true}).click();
   await panel.getByText('Код скопирован.').waitFor();
   assert.equal(await page.evaluate(()=>copied.length),1);
   assert.equal(await page.evaluate(()=>calls.filter(x=>x.name==='komi_admin_anicoin_code_create'&&x.args.p_amount===42).length),1);
   assert.match(await panel.locator('#ra-one-use-list').innerText(),/…6677 · 42 AniCoin/);
   assert.doesNotMatch(await panel.locator('#ra-one-use-list').innerText(),/01234567/);
   await panel.locator('summary').click();
   await panel.locator('summary').click();
   assert.equal(await panel.getByLabel('Новый код').isVisible(),false);
   assert.equal(await panel.getByLabel('Новый код').inputValue(),'');
   await panel.getByRole('button',{name:'Отозвать',exact:true}).click();
   assert.equal(await page.evaluate(()=>calls.some(x=>x.name==='komi_admin_anicoin_code_revoke')),false);
   await panel.getByRole('button',{name:'Подтвердить отзыв'}).click();
   await panel.getByText(/Отозван ·/).waitFor();
   assert.equal(await page.evaluate(()=>calls.filter(x=>x.name==='komi_admin_anicoin_code_revoke'&&x.args.p_id==='gift').length),1);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   assert.deepEqual(errors,[]);
   await page.close();
  }
 }finally{await browser.close();}
});
