/* Two independent codes for Komi Premium. No prices or rewards are trusted from the browser. */
(function(){
'use strict';
const CHECKOUT='https://app.lava.top/products/b37a75ab-e500-4431-b61e-5c2a7e3edd8a/f1b11818-74d5-4e94-a013-15d89a545cdd?currency=USD';
const DB='https://xebglnnpoutmdcgukbxf.supabase.co';
const PLANS=Object.freeze({
 monthly:{price:'$3.99',period:'мес',name:'1 месяц',duration:'ежемесячное продление'},
 yearly:{price:'$24.85',period:'год',name:'1 год',duration:'ежегодное продление'}
});
let selectedPlan='monthly';
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
function openCheckout(requestedPlan){
 if(modal){
   modal.hidden=false;
   if(requestedPlan==='monthly'||requestedPlan==='yearly')
     modal.querySelector('[data-komi-plan="'+requestedPlan+'"]')?.click();
   modal.querySelector('#komi-promo-input')?.focus();
   return;
 }
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
 const subtitle=node('p','Выбери период Premium. Списание повторяется с указанной периодичностью, если подписка не отменена.','komi-checkout-caption');
 const plans=node('div',null,'komi-checkout-plans');
 plans.setAttribute('role','group');
 plans.setAttribute('aria-label','Период подписки');
 const planButtons={};
 for(const [id,plan] of Object.entries(PLANS)){
   const choice=node('button',null,'komi-checkout-plan');
   choice.type='button';choice.dataset.komiPlan=id;
   choice.append(node('span',plan.name),node('strong',plan.price),node('small','/'+plan.period));
   plans.append(choice);
   planButtons[id]=choice;
 }
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
 const amount=node('strong','');
 const choosePlan=id=>{
   if(!PLANS[id])return;
   selectedPlan=id;
   const p=PLANS[id];
   amount.textContent=p.price+' / '+p.period;
   continueFull.textContent='Продолжить без скидки · '+p.price+' / '+p.period;
   lavaPromoWarning.textContent='Скидку подтверждает только Lava.top. Для покупок со скидкой в USD действует минимальная стоимость. На странице Lava.top выбери '+p.name.toLowerCase()+' и проверь окончательную сумму перед оплатой. Прямой переход не передаёт реферальный код KomiAnime.';
   for(const [key,button] of Object.entries(planButtons)){
     button.setAttribute('aria-pressed',String(key===id));
   }
 };
 for(const [id,button] of Object.entries(planButtons))button.onclick=()=>choosePlan(id);
 summary.append(price,amount);
 const info=node('p','На странице Lava.top обязательно выбери тот же период (1 месяц или 1 год). Промокод вводится в Lava.top, где показывается фактическая сумма. Прямой платёж через Lava.top не передаёт реферальный код KomiAnime.','komi-checkout-note');
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
 const lavaPromoWarning=node('p','','komi-checkout-lava-warning');
 lavaPromo.append(lavaPromoText,lavaPromoCode,copyLavaPromo,lavaPromoOpen,lavaPromoWarning);
 const continueFull=node('button','Продолжить без скидки','komi-checkout-continue');
 continueFull.type='button';continueFull.hidden=true;
 const noCodes=node('a','Оформить напрямую в Lava.top (без кодов)','komi-checkout-direct');
 const invoiceLink=node('a','Открыть подготовленный счёт Lava.top','komi-checkout-invoice');
 invoiceLink.hidden=true;invoiceLink.rel='noopener noreferrer';
 noCodes.href=CHECKOUT;noCodes.target='_blank';noCodes.rel='noopener noreferrer';
 actions.append(apply,pay);
 const footer=node('p','После оплаты доступ активирует подтверждённый webhook Lava.top, не экран возврата.','komi-checkout-footnote');
 box.append(top,subtitle,plans,fields,summary,info,actions,msg,lavaPromo,continueFull,invoiceLink,noCodes,footer);modal.append(box);
 choosePlan(requestedPlan==='yearly'?'yearly':'monthly');
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
     (Number(data.discount_percent)>0?'✓ Код найден · скидка '+data.discount_percent+'% проверяется на Lava.top':'✓ Код найден · бонусы доступны только для поддерживаемых счетов KomiAnime'):
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
   promo.feedback.textContent='Скидка не применяется на KomiAnime; итоговую сумму покажет Lava.top';
   checked=null;continueFull.hidden=true;
   // Avoid needing the invoice API when neither code is to be applied.
   // Referral attribution still goes through the authenticated server flow.
   if(!codes().ref){external();modal.hidden=true;return;}
   pay.click();
 };
 pay.onclick=()=>{
   if(busy)return;
   const c=codes();
   if(c.promo&&!valid(c.promo)){promo.feedback.textContent='Некорректный код';return;}
   if(c.ref&&!valid(c.ref)){referral.feedback.textContent='Некорректный код';return;}
   if(c.ref)try{localStorage.setItem('komi_ref_code',c.ref);}catch{}
   // Both billing periods are configured under the SAME Lava.top subscription
   // offer. The buyer must choose the matching period at the provider.
   // Do NOT issue an old $2.01 API invoice or pretend to apply a coupon here.
   if(c.promo){
      try{navigator.clipboard?.writeText?.(c.promo).catch(()=>{});}catch{}
   }
   external();
   modal.hidden=true;
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
