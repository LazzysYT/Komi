'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const handler=require('../api/anivibe');
const {integer,partnerUrl,iframeUrl,callPartner,checkPartner,requestAllowed}=handler.internals;
const ENV = process.env;

test('AniVibe partner only accepts exact Shikimori IDs and valid episodes',()=>{
  assert.equal(integer('52991',100000000),52991);
  for(const invalid of [null,'','-1','0','1.0','2e3','999999999999','01']) assert.equal(integer(invalid,100000000),null);
  assert.equal(integer('1001',1000),null);
});
test('only AniVibe HTTPS frame destinations are allowed',()=>{
  assert.equal(partnerUrl('https://player.anivibe.pro/embed?id=1'),'https://player.anivibe.pro/embed?id=1');
  for(const url of ['http://anivibe.pro/embed','https://anivibe.pro.evil.test/embed',
    'https://evil.test/embed','https://127.0.0.1/a','javascript:alert(1)','https://user:pass@anivibe.pro/x'])
    assert.equal(partnerUrl(url),'');
  assert.equal(iframeUrl({data:{iframe_url:'https://anivibe.pro/embed?id=1'}}),'https://anivibe.pro/embed?id=1');
  assert.equal(iframeUrl({data:{iframe_url:'https://evil.test/steal'}}),'');
});
test('partner credentials remain server-only and requests never redirect',async()=>{
  let captured;
  const response=await callPartner('/api/v1/partner/me','unit-test-key',async(url,options)=>{
    captured={url,options};
    return {
      ok:true,status:200,headers:{get:()=>null},
      text:async()=>JSON.stringify({ok:true,account:{private:'must-not-return'}})
    };
  });
  assert.equal(response.status,200);
  assert.equal(captured.url,'https://anivibe.pro/api/v1/partner/me');
  assert.equal(captured.options.headers['X-Api-Key'],'unit-test-key');
  assert.equal(captured.options.redirect,'error');
  assert.equal(captured.options.method,'GET');
});
test('server health probe checks known safe anime only and never exposes partner identity',async()=>{
  const calls=[];
  const probe=await checkPartner('unit-test-key',async(url)=>{
    calls.push(url);
    return {ok:true,status:200,headers:{get:()=>null},text:async()=>JSON.stringify({secret:'do-not-expose'})};
  });
  assert.deepEqual(probe,{connection:'connected',sampleAnime:'found'});
  assert.deepEqual(calls,[
    'https://anivibe.pro/api/v1/partner/me',
    'https://anivibe.pro/api/v1/anime/52991'
  ]);
});
test('strict CORS-like origin/host check never allows arbitrary sites',()=>{
  assert.equal(requestAllowed({headers:{origin:'https://komianime.online',host:'komianime.online','sec-fetch-site':'same-origin'}}),true);
  assert.equal(requestAllowed({headers:{origin:'https://other.test',host:'komianime.online'}}),false);
  assert.equal(requestAllowed({headers:{origin:'https://komianime.online',host:'evil.test'}}),false);
  assert.equal(requestAllowed({headers:{origin:'https://komianime.online',host:'komianime.online','sec-fetch-site':'cross-site'}}),false);
});
test('POST embed is OFF by default even when key exists; no network or key leak',async()=>{
  const previous=ENV.ANIVIBE_API_KEY;
  const prevEnabled=ENV.ANIVIBE_PARTNER_EMBED_ENABLED;
  try {
    ENV.ANIVIBE_API_KEY='unit-test-key';
    delete ENV.ANIVIBE_PARTNER_EMBED_ENABLED;
    const headers={};
    const res={statusCode:0,setHeader(k,v){headers[k]=v},end(payload){this.body=JSON.parse(payload)}};
    await handler({method:'POST',headers:{origin:'https://komianime.online',host:'komianime.online'},body:{shikimoriId:52991,episode:1}},res);
    assert.equal(res.statusCode,403);
    assert.deepEqual(res.body,{error:'partner_embed_not_approved'});
    assert.doesNotMatch(JSON.stringify(res.body),/unit-test-key/);
    assert.equal(headers['Cache-Control'],'no-store');
  } finally {
    if(previous===undefined) delete ENV.ANIVIBE_API_KEY; else ENV.ANIVIBE_API_KEY=previous;
    if(prevEnabled===undefined) delete ENV.ANIVIBE_PARTNER_EMBED_ENABLED; else ENV.ANIVIBE_PARTNER_EMBED_ENABLED=prevEnabled;
  }
});
