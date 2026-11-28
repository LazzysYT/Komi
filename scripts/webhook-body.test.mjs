import test from 'node:test';
import assert from 'node:assert/strict';
import {readWebhookJson} from '../supabase/functions/lava-premium-webhook/read-body.mjs';
const url='https://example.invalid/webhook';
const request=(body,headers={})=>new Request(url,{method:'POST',headers,body,...(body instanceof ReadableStream?{duplex:'half'}:{})});
const encode=s=>new TextEncoder().encode(s);
test('valid provider JSON and UTF-8 survive unchanged',async()=>{
  const payload={eventType:'payment.success',data:{title:'Тест'}};
  assert.deepEqual(await readWebhookJson(request(JSON.stringify(payload))),{ok:true,value:payload});
});
test('declared oversize rejected before reading',async()=>{
  const result=await readWebhookJson(request('{}',{'content-length':'32769'}));
  assert.equal(result.status,413);
});
test('chunked oversize rejected without content-length',async()=>{
  let canceled=false;
  const body=new ReadableStream({start(c){c.enqueue(encode('x'.repeat(20)));c.enqueue(encode('y'.repeat(20)));},cancel(){canceled=true;}});
  const result=await readWebhookJson(request(body),32);
  assert.equal(result.status,413);
  assert.equal(canceled,true);
});
test('exact byte boundary accepted; multibyte overrun rejected',async()=>{
  const text=JSON.stringify({s:'я'.repeat(16)});
  const bytes=encode(text).byteLength;
  assert.equal((await readWebhookJson(request(text),bytes)).ok,true);
  assert.equal((await readWebhookJson(request(text),bytes-1)).status,413);
});
test('malformed JSON and invalid UTF-8 rejected',async()=>{
  assert.equal((await readWebhookJson(request('{'))).status,400);
  assert.equal((await readWebhookJson(request(Uint8Array.of(0xff)))).status,400);
});
test('stalled request times out and reader is canceled',async()=>{
  let canceled=false;
  const body=new ReadableStream({cancel(){canceled=true;}});
  const result=await readWebhookJson(request(body),32,20);
  assert.equal(result.status,408);
  assert.equal(canceled,true);
});
