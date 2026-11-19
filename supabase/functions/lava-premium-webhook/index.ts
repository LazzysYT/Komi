// Komi Premium - Lava.top webhook, authenticated via X-Api-Key.
// Key is configured ONLY in Supabase Edge Function Secrets. No key => HTTP 503.
const offerId='f1b11818-74d5-4e94-a013-15d89a545cdd';
const productId='b37a75ab-e500-4431-b61e-5c2a7e3edd8a';
const recognized=new Set([
 'payment.success','payment.failed','subscription.recurring.payment.success',
 'subscription.recurring.payment.failed','subscription.cancelled',
 'refund.success','chargeback.initiated'
]);
const object=(v:unknown):Record<string,unknown> =>
 v&&typeof v==='object'&&!Array.isArray(v) ? v as Record<string,unknown>:{};
const str=(v:unknown):string=>typeof v==='string'?v.trim():'';
function equal(a:string,b:string):boolean {
 const enc=new TextEncoder(),x=enc.encode(a),y=enc.encode(b);
 let difference=x.length^y.length;
 for(let i=0;i<Math.max(x.length,y.length);i++)difference|=(x[i]||0)^(y[i]||0);
 return difference===0;
}
function asTime(x:unknown):string|null {
 if(typeof x!=='string'||!x.trim())return null;
 const t=new Date(x);
 return Number.isFinite(t.getTime())?t.toISOString():null;
}
function key(){
 const legacy=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if(legacy)return legacy;
 try{
  const current=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}');
  if(typeof current.default==='string')return current.default;
  if(typeof current.default?.key==='string')return current.default.key;
 }catch{ /* not configured */ }
 return '';
}
Deno.serve(async(req:Request)=>{
 if(req.method!=='POST')return new Response('Method Not Allowed',{status:405});
 const secret=Deno.env.get('LAVA_PREMIUM_WEBHOOK_KEY')||'';
 const adminKey=key(),dbUrl=Deno.env.get('SUPABASE_URL')||'';
 if(secret.length<32||!adminKey||!dbUrl)
  return Response.json({error:'Integration not configured'},{status:503});
 if(!equal(req.headers.get('X-Api-Key')||'',secret))
  return Response.json({error:'Unauthorized'},{status:401});
 if(!(req.headers.get('content-type')||'').includes('application/json'))
  return Response.json({error:'JSON required'},{status:415});
 if(Number(req.headers.get('content-length')||0)>32768)
  return Response.json({error:'Too large'},{status:413});
 let b:Record<string,unknown>;
 try{
  const raw=await req.text();
  if(raw.length>32768)return Response.json({error:'Too large'},{status:413});
  b=object(JSON.parse(raw));
 }catch{return Response.json({error:'Malformed JSON'},{status:400});}
 const type=str(b.eventType||b.event_type);
 if(!recognized.has(type))return Response.json({ok:true,ignored:true});
 const data=object(b.data),buyer=object(b.buyer),product=object(data.product);
 const email=str(
  b.buyerEmail||b.email||b.customerEmail||buyer.email||buyer.emailAddress||
  data.customer_email||data.buyer_email
 );
 const offer=str(b.offerId||b.offer_id||data.offer_id);
 const productRef=str(b.productId||b.product_id||data.product_id||product.product_id||product.id);
 if((offer&&offer!==offerId&&offer!==productId)||
    (productRef&&productRef!==productId&&productRef!==offerId))
   return Response.json({ok:true,ignored:true});
 if(type==='payment.success' && offer!==offerId && productRef!==productId)
   return Response.json({ok:true,ignored:true});
 const contract=str(
   b.parentContractId||b.subscriptionId||b.contractId||
   data.parent_contract_id||data.subscription_id||data.contract_id
 );
 const invoice=str(b.invoiceId||b.contractId||data.invoice_id||data.contract_id);
 const eventId=str(b.eventId||b.event_id||data.event_id);
 if(!contract || (type.includes('payment.success') && !invoice && !eventId))
  return Response.json({error:'Missing contract or invoice ID'},{status:422});
 const created=asTime(b.createdAt||b.eventCreatedAt||b.created_at||data.created_at)
   ||new Date().toISOString();
 const expiry=asTime(b.willExpireAt||b.expiresAt||data.will_expire_at);
 const eventKey=type+':'+(eventId||invoice||contract);
 const params={
   p_event_key:eventKey,p_event_type:type,p_contract_id:contract,
   p_buyer_email:email||null,
   p_offer_id:offer===offerId?offerId:(productRef===productId?offerId:null),
   p_event_at:created,p_expiry:expiry
 };
 // Supabase new secret keys are supplied only on apikey; legacy JWT service
 // keys may also be used in Authorization header.
 const headers:Record<string,string>={
   'content-type':'application/json','apikey':adminKey
 };
 if(!adminKey.startsWith('sb_secret_'))headers.authorization='Bearer '+adminKey;
 try{
  const res=await fetch(dbUrl+'/rest/v1/rpc/komi_apply_lava_premium_event',{
    method:'POST',headers,body:JSON.stringify(params)
  });
  if(!res.ok){console.error('Premium RPC unavailable',res.status);return Response.json({error:'Retry'},{status:503});}
  const result:unknown=await res.json();
  if(typeof result!=='string')return Response.json({error:'Invalid result'},{status:503});
  if(['invalid_event','missing_offer','email_conflict','unknown_contract',
      'missing_email','unmatched_verified_email'].includes(result))
   return Response.json({error:result},{status:422});
  return Response.json({ok:true,result});
 }catch(e){console.error('Premium webhook failed',String(e).slice(0,100));
  return Response.json({error:'Unavailable'},{status:503});
 }
});
