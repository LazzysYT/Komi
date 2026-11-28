// Bounded reader shared by the webhook and its offline tests. No request data is logged.
/** @param {Request} request @param {number} [maxBytes] @param {number} [timeoutMs] */
export async function readWebhookJson(request, maxBytes=32768, timeoutMs=8000) {
  const declared=request.headers.get('content-length');
  if(declared!==null && /^\d+$/.test(declared) && Number(declared)>maxBytes) {
    if(request.body) void request.body.cancel().catch(()=>{});
    return {ok:false,status:413,error:'Too large'};
  }
  if(!request.body) return {ok:false,status:400,error:'Malformed JSON'};
  const reader=request.body.getReader();
  const bytes=new Uint8Array(maxBytes);
  let total=0, timer, complete=false;
  const deadline=Symbol('deadline');
  const timeout=new Promise(resolve=>{timer=setTimeout(()=>resolve(deadline),timeoutMs);});
  try {
    for(;;) {
      const chunk=await Promise.race([reader.read(),timeout]);
      if(chunk===deadline) return {ok:false,status:408,error:'Request timeout'};
      if(chunk.done){complete=true;break;}
      if(chunk.value.byteLength>maxBytes-total)
        return {ok:false,status:413,error:'Too large'};
      bytes.set(chunk.value,total);
      total+=chunk.value.byteLength;
    }
    const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes.subarray(0,total));
    return {ok:true,value:JSON.parse(text)};
  } catch {
    return {ok:false,status:400,error:'Malformed JSON'};
  } finally {
    clearTimeout(timer);
    if(!complete) void reader.cancel().catch(()=>{});
    try{reader.releaseLock();}catch{}
  }
}
