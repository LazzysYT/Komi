'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {readBoundedJson}=require('../api/_bounded-json');
const importHandler=require('../api/import-shikimori');
test('valid JSON at an exact multibyte byte limit is preserved',async()=>{
 const s=JSON.stringify({name:'Аниме'});
 const bytes=Buffer.byteLength(s);
 assert.deepEqual(await readBoundedJson(new Response(s),bytes),{name:'Аниме'});
 await assert.rejects(readBoundedJson(new Response(s),bytes-1),/too large/);
});
test('declared oversize and chunked oversize cancel the upstream body',async()=>{
 for(const declared of [true,false]){
  let canceled=false;
  const body=new ReadableStream({start(c){c.enqueue(new Uint8Array(8));c.enqueue(new Uint8Array(8));},cancel(){canceled=true;}});
  await assert.rejects(readBoundedJson(new Response(body,{headers:declared?{'Content-Length':'16'}:{}}),8),/too large/);
  assert.equal(canceled,true);
 }
});
test('malformed JSON, missing body and invalid UTF-8 fail generically',async()=>{
 for(const r of [new Response('{'),new Response(null),new Response(Uint8Array.of(255))])
  await assert.rejects(readBoundedJson(r,64),/Invalid upstream JSON/);
});
function response(){
 return {statusCode:0,headers:{},setHeader(k,v){this.headers[k]=v;},status(v){this.statusCode=v;return this;},json(v){this.body=v;}};
}
test('public import accepts bounded valid list without disclosing extra upstream fields',async()=>{
 const old=global.fetch,calls=[];
 global.fetch=async url=>{calls.push(url);return Response.json(calls.length===1?{id:123}:[{target_id:45,status:'completed',score:9,private:'not returned'}]);};
 try{
  const res=response();
  await importHandler({method:'GET',query:{name:'test_user'}},res);
  assert.equal(res.statusCode,200);
  assert.equal(calls.length,2);
  assert.deepEqual(res.body,{rates:[{target_id:45,status:'completed',score:9,target_type:'Anime'}]});
 }finally{global.fetch=old;}
});
test('public import refuses incorrect methods and invalid names before network',async()=>{
 const old=global.fetch;
 global.fetch=async()=>{throw Error('network must not run');};
 try{
  const method=response(),name=response();
  await importHandler({method:'POST'},method);
  await importHandler({method:'GET',query:{name:'https://example.test'}},name);
  assert.equal(method.statusCode,405);assert.equal(method.headers.Allow,'GET');
  assert.equal(name.statusCode,400);
 }finally{global.fetch=old;}
});
test('public import does not expose upstream errors or data',async()=>{
 const old=global.fetch;global.fetch=async()=>{throw Error('private upstream detail');};
 try{
  const res=response();await importHandler({method:'GET',query:{name:'test_user'}},res);
  assert.equal(res.statusCode,502);assert.doesNotMatch(JSON.stringify(res.body),/private upstream detail/);
 }finally{global.fetch=old;}
});
