'use strict';
// Enforce byte limits while streaming upstream JSON, before allocating its
// entire decoded representation. Uses the caller's fetch deadline.
async function discardBody(response){
  try{if(response.body)void response.body.cancel().catch(()=>{});}catch{}
}
async function readBoundedJson(response,maxBytes){
  if(!Number.isSafeInteger(maxBytes)||maxBytes<1)throw Error('Invalid response limit');
  const declared=response.headers.get('content-length');
  if(declared!==null&&/^\d+$/.test(declared)&&Number(declared)>maxBytes){
    await discardBody(response);
    throw Error('Upstream response too large');
  }
  if(!response.body)throw Error('Invalid upstream JSON');
  const reader=response.body.getReader(),chunks=[];
  let size=0,complete=false;
  try{
    for(;;){
      const part=await reader.read();
      if(part.done){complete=true;break;}
      if(part.value.byteLength>maxBytes-size)throw Error('Upstream response too large');
      size+=part.value.byteLength;
      chunks.push(Buffer.from(part.value));
    }
    try{
      return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks,size)));
    }catch{throw Error('Invalid upstream JSON');}
  }finally{
    if(!complete)try{void reader.cancel().catch(()=>{});}catch{}
    reader.releaseLock();
  }
}
module.exports={readBoundedJson,discardBody};
