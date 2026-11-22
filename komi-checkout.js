/* Two independent codes for Komi Premium. No prices or rewards are trusted from the browser. */
(function(){
'use strict';
const CHECKOUT='https://app.lava.top/products/b37a75ab-e500-4431-b61e-5c2a7e3edd8a/f1b11818-74d5-4e94-a013-15d89a545cdd?currency=USD';
const DB='https://xebglnnpoutmdcgukbxf.supabase.co';
const PUBLIC_KEY='sb_publishable_SzKz649coUbxHWXjQfdSXQ_GGzzbHrs';
const clean=v=>String(v||'').trim().toUpperCase().slice(0,40);
const valid=v=>/^[A-Z0-9_-]{3,40}$/.test(v);
try{
  const incoming=new URLSearchParams(location.search).get('ref');
  if(incoming&&valid(clean(incoming)))localStorage.setItem('komi_ref_code',clean(incoming));
}catch{}
let modal=null,client=null,busy=false;
function node(tag,text,cls){
 const el=document.createElement(tag);if(text!=null)el.textContent=text;
 if(cls)el.className=cls;return el;
}
function clientForCheckout(){
 if(client)return client;
 if(!window.supabase?.createClient)return null;
 client=window.supabase.createClient(DB,PUBLIC_KEY,{
   auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
 });
 return client;
}
function external(){
 // Same-tab navigation is reliably initiated by the purchase click and cannot
 // be blocked as an async popup or intercepted by the Lava-link listener.
 window.location.assign(CHECKOUT);
}
function openCheckout(){
 if(modal){modal.hidden=false;modal.querySelector('#komi-promo-input')?.focus();return;}
 modal=node('div',null,'komi-checkout-overlay');
 modal.setAttribute('role','presentation');
 const box=node('section',null,'komi-checkout-dialog');
 box.setAttribute('role','dialog');box.setAttribute('aria-modal','true');
 box.setAttribute('aria-labelledby','komi-checkout-heading');
 const top=node('div',null,'komi-checkout-top');
 const left=node('div');left.append(node('small','KOMI PREMIUM / ОФОРМЛЕНИЕ'));
 left.append(node('h2','Покупка Premium','komi-checkout-heading'));
 left.lastChild.id='komi-checkout-heading';
 const close=node('button','×','komi-checkout-close');close.type='button';
 close.setAttribute('aria-label','Закрыть');close.onclick=()=>{modal.hidden=true;};
 top.append(left,close);
 const subtitle=node('p','Промокод даёт выгоду покупателю, реферальный код указывает автора. Можно использовать оба.','komi-checkout-caption');
 const fields=node('div',null,'komi-checkout-fields');
 const makeField=(label,placeholder,id)=>{
   const wrap=node('label',null,'komi-checkout-field');wrap.append(node('span',label));
   const input=node('input');input.id=id;input.type='text';input.autocomplete='off';
   input.maxLength=40;input.placeholder=placeholder;input.spellcheck=false;
   input.setAttribute('aria-label',label);input.style.textTransform='uppercase';
   const feedback=node('span','', 'komi-checkout-feedback');feedback.setAttribute('role','status');
   wrap.append(input,feedback);fields.append(wrap);return {input,feedback};
 };
 const promo=makeField('Промокод','Например: KOMI15','komi-promo-input');
 const referral=makeField('Реферальный код','Код автора (необязательно)','komi-ref-input');
 try{referral.input.value=clean(localStorage.getItem('komi_ref_code'))||'';}catch{}
 const summary=node('div',null,'komi-checkout-summary');
 const price=node('span','Стоимость тарифа','komi-checkout-muted');
 const amount=node('strong','$2.01 / мес');
 summary.append(price,amount);
 const info=node('p','Промокоды Lava.top вводятся и проверяются на странице оплаты Lava.top. Промокоды KomiAnime для бонусов и рефералов учитываются при создании счёта через KomiAnime. Итоговую сумму и действие скидки подтверждает платёжный сервис.','komi-checkout-note');
 const actions=node('div',null,'komi-checkout-buttons');
 const apply=node('button','Проверить коды','komi-checkout-secondary');apply.type='button';
 const pay=node('button','Перейти к оплате','komi-checkout-primary');pay.type='button';
 const msg=node('p','','komi-checkout-message');msg.setAttribute('role','status');
 const lavaPromo=node('div',null,'komi-checkout-lava-promo');
 lavaPromo.hidden=true;
 const lavaPromoText=node('p','','komi-checkout-lava-hint');
 const lavaPromoCode=node('strong','','komi-checkout-lava-code');
 const copyLavaPromo=node('button','Скопировать промокод','komi-checkout-lava-copy');
 copyLavaPromo.type='button';
 const lavaPromoOpen=node('a','Открыть Lava.top и проверить скидку','komi-checkout-lava-open');
 lavaPromoOpen.href=CHECKOUT;lavaPromoOpen.rel='noopener noreferrer';
 const lavaPromoWarning=node('p','Внимание: для скидок в USD Lava.top устанавливает минимальную цену $5. При тарифе $2.01/мес скидка 30% может не примениться. В режиме перехода напрямую реферальный код KomiAnime не передаётся; проверь итоговую сумму до оплаты.','komi-checkout-lava-warning');
 lavaPromo.append(lavaPromoText,lavaPromoCode,copyLavaPromo,lavaPromoOpen,lavaPromoWarning);
 const continueFull=node('button','Продолжить за $2.01/мес без скидки','komi-checkout-continue');
 continueFull.type='button';continueFull.hidden=true;
 const noCodes=node('a','Оформить напрямую в Lava.top (без кодов)','komi-checkout-direct');
 const invoiceLink=node('a','Открыть подготовленный счёт Lava.top','komi-checkout-invoice');
 invoiceLink.hidden=true;invoiceLink.rel='noopener noreferrer';
 noCodes.href=CHECKOUT;noCodes.target='_blank';noCodes.rel='noopener noreferrer';
 actions.append(apply,pay);
 const footer=node('p','После оплаты доступ активирует подтверждённый webhook Lava.top, не экран возврата.','komi-checkout-footnote');
 box.append(top,subtitle,fields,summary,info,actions,msg,lavaPromo,continueFull,invoiceLink,noCodes,footer);modal.append(box);
 document.body.append(modal);
 modal.addEventListener('click',e=>{if(e.target===modal)modal.hidden=true;});
 function codes(){return {promo:clean(promo.input.value),ref:clean(referral.input.value)};}
 let checked=null;
 function unsupportedDiscount(percent){
   const promoCode=codes().promo;
   // Local Supabase validation is NOT proof of a provider-side discount.
   // Lava.top applies its own codes on the hosted checkout page.
   msg.textContent='Код '+promoCode+' найден в KomiAnime ('+percent+'%). Чтобы проверить скидку, открой Lava.top и введи код там. Реальную сумму покажет только Lava.top.';
   lavaPromoText.textContent='Промокод Lava.top — введи его на странице оплаты:';
   lavaPromoCode.textContent=promoCode;
   lavaPromo.hidden=false;
   continueFull.hidden=false;
 }
 copyLavaPromo.onclick=async()=>{
   const code=codes().promo;
   if(!valid(code))return;
   try{
     if(!navigator.clipboard?.writeText)throw Error('clipboard unavailable');
     await navigator.clipboard.writeText(code);
     copyLavaPromo.textContent='Скопировано ✓';
   }catch{
     promo.input.focus();promo.input.select();
     msg.textContent='Скопируй выделенный код и вставь его на странице Lava.top.';
   }
 };
 async function check(){
   const c=codes();checked=null;
   promo.feedback.textContent='';referral.feedback.textContent='';msg.textContent='';
   lavaPromo.hidden=true;copyLavaPromo.textContent='Скопировать промокод';
   continueFull.hidden=true;
   if(c.promo&&!valid(c.promo)){promo.feedback.textContent='Код: 3–40 латинских букв или цифр';return false;}
   if(c.ref&&!valid(c.ref)){referral.feedback.textContent='Код: 3–40 латинских букв или цифр';return false;}
   if(!c.promo&&!c.ref){checked={promo_valid:false,ref_valid:false};return true;}
   const db=clientForCheckout();
   if(!db){msg.textContent='Проверка временно недоступна.';return false;}
   const {data:{user}={},error:userError}=await db.auth.getUser();
   if(userError||!user){msg.textContent='Войди в свой аккаунт KomiAnime перед применением кодов.';return false;}
   const {data,error}=await db.rpc('validate_checkout_codes',{
      p_promo_code:c.promo||null,p_referral_code:c.ref||null
   });
   if(error){msg.textContent='Не удалось проверить коды: '+error.message;return false;}
   checked=data;
   if(c.promo)promo.feedback.textContent=data.promo_valid?
     (Number(data.discount_percent)>0?'✓ Код найден · скидка '+data.discount_percent+'% недоступна для этого тарифа':'✓ +'+data.bonus_anicoin+' AniCoin после оплаты'):
     (data.promo_error||'Промокод не найден');
   if(c.ref)referral.feedback.textContent=data.ref_valid?'✓ Партнёр: '+data.owner_name:
     (data.ref_error||'Реферальный код недействителен');
   if(c.promo&&!data.promo_valid||c.ref&&!data.ref_valid)return false;
   if(c.promo&&Number(data.discount_percent)>0){
      unsupportedDiscount(Number(data.discount_percent));
      return false;
   }
   if(c.ref)try{localStorage.setItem('komi_ref_code',c.ref);}catch{}
   return true;
 }
 apply.onclick=async()=>{if(busy)return;busy=true;apply.disabled=true;try{await check();}finally{busy=false;apply.disabled=false;}};
 for(const field of [promo,referral]){
   field.input.addEventListener('input',()=>{
     checked=null;field.feedback.textContent='';msg.textContent='';
     invoiceLink.hidden=true;invoiceLink.removeAttribute('href');
     lavaPromo.hidden=true;copyLavaPromo.textContent='Скопировать промокод';
     continueFull.hidden=true;
   });
 }
 // Validation on blur raced with the primary click and silently swallowed it.
 // A separate explicit confirmation is required before omitting a discount.
 continueFull.onclick=()=>{
   if(busy)return;
   promo.input.value='';
   promo.feedback.textContent='Скидка исключена: к оплате $2.01/мес';
   checked=null;continueFull.hidden=true;
   // Avoid needing the invoice API when neither code is to be applied.
   // Referral attribution still goes through the authenticated server flow.
   if(!codes().ref){external();modal.hidden=true;return;}
   pay.click();
 };
 pay.onclick=async()=>{
   if(busy)return;
   busy=true;pay.disabled=true;pay.textContent='Проверяем…';
   try{
     const c=codes();
     if(!c.promo&&!c.ref){external();modal.hidden=true;return;}
     if(!checked&&!(await check())){
       if(!lavaPromo.hidden){
         // First purchase click should not be swallowed by local promo validation.
         // No discount is claimed; the provider displays the payable price.
         external();modal.hidden=true;return;
       }
       if(!continueFull.hidden)continueFull.focus();
       return;
     }
     if(!checked)return;
     if(c.promo&&!checked.promo_valid||c.ref&&!checked.ref_valid)return;
     if(c.promo&&Number(checked.discount_percent)>0){
       unsupportedDiscount(Number(checked.discount_percent));
       external();modal.hidden=true;return;
     }
     const db=clientForCheckout();
     const {data:{session}={}}=await db.auth.getSession();
     if(!session?.access_token){msg.textContent='Войди в аккаунт для применения кодов.';return;}
     const res=await fetch(DB+'/functions/v1/komi-checkout',{
       method:'POST',
       headers:{'content-type':'application/json','apikey':PUBLIC_KEY,'Authorization':'Bearer '+session.access_token},
       body:JSON.stringify({promo_code:c.promo||null,referral_code:c.ref||null})
     });
     const data=await res.json().catch(()=>({}));
     if(!res.ok){msg.textContent=data.error||'Счёт с кодами пока недоступен. Коды не применены.';return;}
     const uri=new URL(String(data.payment_url||''));
     if(uri.protocol!=='https:'||!(uri.hostname==='lava.top'||uri.hostname.endsWith('.lava.top')))
       throw Error('Платёжный адрес не подтверждён');
     invoiceLink.href=uri.href;invoiceLink.hidden=false;
     msg.textContent='Счёт создан. Если автоматический переход не произошёл, нажми «Открыть подготовленный счёт Lava.top».';
     window.location.assign(uri.href);
   }catch(e){msg.textContent=e?.message||'Не удалось создать счёт';}
   finally{busy=false;pay.disabled=false;pay.textContent='Перейти к оплате';}
 };
 promo.input.focus();
}
document.addEventListener('click',event=>{
 const link=event.target.closest?.('a[href]');if(!link)return;
 // The explicit no-code fallback must not reopen this dialog.
 if(link.matches('.komi-checkout-direct, .komi-checkout-lava-open'))return;
 try{
   const url=new URL(link.href,location.href);
   if(url.hostname!=='app.lava.top'||!url.pathname.startsWith('/products/b37a75ab-e500-4431-b61e-5c2a7e3edd8a/'))return;
 }catch{return;}
 if(event.defaultPrevented||event.button>0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
 event.preventDefault();openCheckout();
},true);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&modal&&!modal.hidden)modal.hidden=true;});
window.KomiCheckout={open:openCheckout};
})();
