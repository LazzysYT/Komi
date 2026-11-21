// Server-only Lava.top invoice issuance. Fixed recurring price: no arbitrary discounts.
// Environment: LAVA_API_KEY, KOMI_PREMIUM_MONTHLY_USD, standard Supabase secrets.
const DB=Deno.env.get('SUPABASE_URL')||'';
const configState={
  lavaKeyPresent:Boolean(Deno.env.get('LAVA_API_KEY')?.trim()),
  priceConfiguredCorrectly:Deno.env.get('KOMI_PREMIUM_MONTHLY_USD')==='2.01',
  checkoutEnabled:Deno.env.get('KOMI_CHECKOUT_ENABLED')!=='false'
};
// Log presence checks only; never reveal credential content.
console.info('KOMI_CHECKOUT_CONFIG_STATE',JSON.stringify(configState));

const PUBLISHABLE='sb_publishable_SzKz649coUbxHWXjQfdSXQ_GGzzbHrs';
const OFFER='f1b11818-74d5-4e94-a013-15d89a545cdd';
const allowed='https://komianime.online';
const code=(value:unknown)=>typeof value==='string'?value.trim().toUpperCase():'';
const valid=(value:string)=>!value||/^[A-Z0-9_-]{3,40}$/.test(value);
const obj=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
const asText=(v:unknown)=>typeof v==='string'?v.trim():'';
function secretKey(){
 const legacy=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if(legacy)return legacy;
 try{
  const keys=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}');
  return typeof keys.default==='string'?keys.default:
   typeof keys.default?.key==='string'?keys.default.key:'';
 }catch{return '';}
}
function headers(key:string){
 const h:Record<string,string>={'content-type':'application/json',apikey:key};
 if(!key.startsWith('sb_secret_'))h.authorization='Bearer '+key;
 return h;
}
function response(payload:unknown,status=200){
 return Response.json(payload,{status,headers:{
  'access-control-allow-origin':allowed,
  'access-control-allow-methods':'POST,OPTIONS',
  'access-control-allow-headers':'authorization,apikey,content-type,x-client-info',
  'cache-control':'no-store'
 }});
}
async function db(path:string,key:string,init:RequestInit={}):Promise<unknown>{
 const res=await fetch(DB+'/rest/v1/'+path,{...init,headers:{...headers(key),...init.headers}});
 const result=await res.text();
 if(!res.ok)throw Error('DB '+res.status);
 try{return result?JSON.parse(result):null;}catch{return null;}
}
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return response({ok:true});
 if(req.method!=='POST')return response({error:'Method not allowed'},405);
 const origin=req.headers.get('origin');
 if(origin&&origin!==allowed)return response({error:'Origin not allowed'},403);
 if(!req.headers.get('content-type')?.startsWith('application/json'))
  return response({error:'JSON required'},415);
 const bearer=req.headers.get('authorization')||'';
 if(!bearer.startsWith('Bearer '))return response({error:'Требуется вход'},401);
 const key=secretKey(),lava=Deno.env.get('LAVA_API_KEY')||'';
 const priceString=Deno.env.get('KOMI_PREMIUM_MONTHLY_USD')||'';
 if(Deno.env.get('KOMI_CHECKOUT_ENABLED')==='false'||!key||!lava||!/^\d+(\.\d{1,2})?$/.test(priceString))
  return response({error:'Оплата с кодами ещё не подключена. Без кодов доступен стандартный способ.'},503);
 const price=Number(priceString);
 if(priceString!=='2.01'||!DB)return response({error:'Сумма подписки не совпадает с тарифом Lava.top (2.01 USD)'},503);
 let body:Record<string,unknown>;
 try{
  const raw=await req.text();
  if(raw.length>2048)return response({error:'Request too large'},413);
  body=obj(JSON.parse(raw));
 }catch{return response({error:'Неверный запрос'},400);}
 const promo=code(body.promo_code),ref=code(body.referral_code);
 if(!valid(promo)||!valid(ref)||(!promo&&!ref))return response({error:'Некорректный код'},422);
 const userResponse=await fetch(DB+'/auth/v1/user',{headers:{
   apikey:PUBLISHABLE,authorization:bearer
 }});
 if(!userResponse.ok)return response({error:'Авторизация истекла'},401);
 const user=obj(await userResponse.json());
 const id=asText(user.id),email=asText(user.email).toLowerCase();
 if(!/^[a-f0-9-]{36}$/i.test(id)||!email.includes('@')||!user.email_confirmed_at)
  return response({error:'Нужен аккаунт с подтверждённой почтой'},403);
 let paymentId='';
 try{
  const verification=obj(await db('rpc/validate_checkout_codes',PUBLISHABLE,{
    method:'POST',headers:{authorization:bearer},
    body:JSON.stringify({p_promo_code:promo||null,p_referral_code:ref||null})
  }));
  if((promo&&!verification.promo_valid)||(ref&&!verification.ref_valid))
   return response({error:'Промокод или реферальный код недействителен'},422);
  if(promo&&Number(verification.discount_percent||0)>0)
   return response({error:'Процентная скидка недоступна для продлеваемой подписки Premium'},422);
  const [promos,refs]=await Promise.all([
   promo?db('promo_codes?select=bonus_anicoin,max_uses,uses_count,min_amount&code=eq.'+encodeURIComponent(promo),key):[],
   ref?db('referral_codes?select=owner_user_id,reward_percent&code=eq.'+encodeURIComponent(ref),key):[]
  ]);
  const p=(promos as Record<string,unknown>[])[0];
  const r=(refs as Record<string,unknown>[])[0];
  if(promo&&(!p||Number(p.min_amount)>price||
    (p.max_uses!==null&&Number(p.uses_count)>=Number(p.max_uses))))
   return response({error:'Промокод недействителен для этого тарифа'},422);
  if(ref&&(!r||r.owner_user_id===id))
   return response({error:'Реферальный код не подходит'},422);
  // A currently billed monthly subscriber should not start a duplicate recurring contract.
  const active=await db('komi_premium_contracts?select=contract_id&user_id=eq.'+encodeURIComponent(id)+
    '&paid_until=gt.'+encodeURIComponent(new Date().toISOString())+'&revoked_at=is.null&limit=1',key);
  if((active as unknown[]).length)return response({error:'Уже есть активная подписка Premium. Повторная покупка не нужна.'},409);
  const recent=await db('payments?select=id&user_id=eq.'+encodeURIComponent(id)+
    '&created_at=gte.'+encodeURIComponent(new Date(Date.now()-3600000).toISOString())+'&limit=10',key);
  if((recent as unknown[]).length>=10)return response({error:'Слишком много попыток за час'},429);
  const reward=ref?Math.round(Math.round(price*100)*Number(r.reward_percent)/100)/100:0;
  const pending=await db('payments',key,{method:'POST',
    headers:{Prefer:'return=representation'},
    body:JSON.stringify({user_id:id,buyer_email:email,tariff_id:'premium_monthly',currency:'USD',
      base_amount:price,final_amount:price,discount_amount:0,
      referral_code:ref||null,promo_code:promo||null,referrer_reward:reward,
      bonus_anicoin:promo?Number(p.bonus_anicoin):0})
  }) as Record<string,unknown>[];
  paymentId=asText(pending?.[0]?.id);
  if(!paymentId)throw Error('No pending record');
  const lavaResponse=await fetch('https://gate.lava.top/api/v3/invoice',{
   method:'POST',headers:{Accept:'application/json','Content-Type':'application/json','X-Api-Key':lava},
   body:JSON.stringify({email,offerId:OFFER,currency:'USD',
     successful_return_url:'https://komianime.online/premium.html?checkout=success',
     failure_return_url:'https://komianime.online/premium.html?checkout=failed',
     cancel_return_url:'https://komianime.online/premium.html?checkout=cancelled'})
  });
  if(!lavaResponse.ok){console.error('Lava returned',lavaResponse.status);
    throw Error('Lava invoice creation failed');}
  const invoice=obj(await lavaResponse.json());
  const data=obj(invoice.data);
  const invoiceId=asText(invoice.invoiceId||invoice.id||invoice.contractId||
      data.invoiceId||data.id||data.contractId);
  const url=asText(invoice.paymentUrl||data.paymentUrl||invoice.payment_url||
      data.payment_url||invoice.url||data.url);
  let parsed:URL;
  try{parsed=new URL(url);}catch{throw Error('Invalid Lava URL');}
  if(!invoiceId||parsed.protocol!=='https:'||!(parsed.hostname==='lava.top'||parsed.hostname.endsWith('.lava.top')))
    throw Error('Invalid Lava invoice response');
  await db('payments?id=eq.'+encodeURIComponent(paymentId),key,{
    method:'PATCH',headers:{Prefer:'return=minimal'},
    body:JSON.stringify({provider_invoice_id:invoiceId})
  });
  return response({payment_url:parsed.href});
 }catch(e){
  if(paymentId){
   try{await db('payments?id=eq.'+encodeURIComponent(paymentId),key,{method:'PATCH',
       headers:{Prefer:'return=minimal'},body:JSON.stringify({status:'failed'})});}
   catch(cleanupError){console.error('Checkout reservation cleanup failed',String(cleanupError).slice(0,100));}
  }
  console.error('Komi checkout failed',String(e).slice(0,150));
  return response({error:'Не удалось подготовить счёт с кодами'},503);
 }
});
