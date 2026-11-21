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
 const w=window.open(CHECKOUT,'_blank','noopener,noreferrer');
 if(!w)window.location.assign(CHECKOUT);
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
 const amount=node('strong','Уточняется при оплате');
 summary.append(price,amount);
 const info=node('p','На обычную продляемую подписку сейчас нельзя применить произвольную денежную скидку. Бонусные коды и рефералы учитываются только при создании счёта через KomiAnime.','komi-checkout-note');
 const actions=node('div',null,'komi-checkout-buttons');
 const apply=node('button','Проверить коды','komi-checkout-secondary');apply.type='button';
 const pay=node('button','Перейти к оплате','komi-checkout-primary');pay.type='button';
 const msg=node('p','','komi-checkout-message');msg.setAttribute('role','status');
 const noCodes=node('a','Оформить напрямую в Lava.top (без кодов)','komi-checkout-direct');
 noCodes.href=CHECKOUT;noCodes.target='_blank';noCodes.rel='noopener noreferrer';
 actions.append(apply,pay);
 const footer=node('p','После оплаты доступ активирует подтверждённый webhook Lava.top, не экран возврата.','komi-checkout-footnote');
 box.append(top,subtitle,fields,summary,info,actions,msg,noCodes,footer);modal.append(box);
 document.body.append(modal);
 modal.addEventListener('click',e=>{if(e.target===modal)modal.hidden=true;});
 function codes(){return {promo:clean(promo.input.value),ref:clean(referral.input.value)};}
 let checked=null;
 async function check(){
   const c=codes();checked=null;
   promo.feedback.textContent='';referral.feedback.textContent='';msg.textContent='';
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
     (Number(data.discount_percent)>0?'✓ Скидка '+data.discount_percent+'% · доступна только для поддерживаемых разовых тарифов':'✓ +'+data.bonus_anicoin+' AniCoin после оплаты'):
     (data.promo_error||'Промокод не найден');
   if(c.ref)referral.feedback.textContent=data.ref_valid?'✓ Партнёр: '+data.owner_name:
     (data.ref_error||'Реферальный код недействителен');
   if(c.promo&&!data.promo_valid||c.ref&&!data.ref_valid)return false;
   if(c.promo&&Number(data.discount_percent)>0){
      msg.textContent='Этот Premium-тариф продлевается автоматически. Денежные скидки для него пока недоступны.';
      return false;
   }
   if(c.ref)try{localStorage.setItem('komi_ref_code',c.ref);}catch{}
   return true;
 }
 apply.onclick=async()=>{if(busy)return;busy=true;apply.disabled=true;try{await check();}finally{busy=false;apply.disabled=false;}};
 for(const field of [promo,referral]){
   field.input.addEventListener('input',()=>{checked=null;field.feedback.textContent='';});
   field.input.addEventListener('blur',()=>{if(field.input.value)apply.click();});
 }
 pay.onclick=async()=>{
   if(busy)return;
   busy=true;pay.disabled=true;pay.textContent='Проверяем…';
   try{
     const c=codes();
     if(!c.promo&&!c.ref){external();modal.hidden=true;return;}
     if(!checked&&!(await check()))return;
     if(!checked)return;
     if(c.promo&&!checked.promo_valid||c.ref&&!checked.ref_valid)return;
     if(c.promo&&Number(checked.discount_percent)>0)return;
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
     window.location.assign(uri.href);
   }catch(e){msg.textContent=e?.message||'Не удалось создать счёт';}
   finally{busy=false;pay.disabled=false;pay.textContent='Перейти к оплате';}
 };
 promo.input.focus();
}
document.addEventListener('click',event=>{
 const link=event.target.closest?.('a[href]');if(!link)return;
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
