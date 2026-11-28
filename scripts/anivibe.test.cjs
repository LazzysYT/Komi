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
    return Response.json({ok:true,account:{private:'must-not-return'}});
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
    return Response.json({secret:'do-not-expose'});
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

test('ad-free can never be confirmed from partner metadata alone',()=>{
  const {summarizeAvailability}=handler.internals;
  assert.deepEqual(summarizeAvailability(404,null),{
    available:false,episodeCount:0,russianAudioEpisodes:0,
    russianAudio:'unconfirmed',adFreeConfirmed:false
  });
  assert.deepEqual(summarizeAvailability(200,{data:{message:'ok'}}),{
    available:null,episodeCount:null,russianAudioEpisodes:0,
    russianAudio:'unconfirmed',adFreeConfirmed:false
  });
});
test('only explicit Russian audio language evidence is counted; subtitles do not qualify',()=>{
  const {summarizeAvailability}=handler.internals;
  const summary=summarizeAvailability(200,{data:{episodes:[
    {episode:1,audio:[{language:'ru-RU',type:'dub'}]},
    {episode:2,subtitles:[{language:'ru'}],audio:[{language:'ja'}]},
    {episode:3,dubs:[{language:'russian'}]},
    {episode:4,dubs:[{studio:'AniDUB'}]},
    {episode:5,voiceovers:[{language:'english'}]}
  ]}});
  assert.equal(summary.available,true);
  assert.equal(summary.episodeCount,5);
  assert.equal(summary.russianAudioEpisodes,2);
  assert.equal(summary.russianAudio,'metadata_evidence');
  assert.equal(summary.adFreeConfirmed,false);
});
test('API checkAvailability only reads episode metadata; never fetches embed tokens',async()=>{
  const {checkAvailability}=handler.internals;
  const fetched=[];
  const result=await checkAvailability(52991,'unit-test-key',async(url,options)=>{
    fetched.push({url,method:options.method});
    return Response.json({data:{episodes:[{number:1}]}});
  });
  assert.deepEqual(fetched,[{url:'https://anivibe.pro/api/v1/anime/52991/episodes',method:'GET'}]);
  assert.equal(result.episodeCount,1);
  assert.equal(result.russianAudio,'unconfirmed');
});
test('GET availability rejects arbitrary IDs; production embed remains off',async()=>{
  const headers={};
  const res={setHeader(k,v){headers[k]=v},end(payload){this.body=JSON.parse(payload)}};
  await handler({method:'GET',query:{availability:'1e3'},headers:{}},res);
  assert.equal(res.statusCode,404);
  assert.equal(res.body.error,'not_found');
});

test('enabled probe does not invoke partner API and returns disabled by default',async()=>{
    const key=process.env.ANIVIBE_API_KEY,flag=process.env.ANIVIBE_PARTNER_EMBED_ENABLED;
    process.env.ANIVIBE_API_KEY='unit-test-key';
    delete process.env.ANIVIBE_PARTNER_EMBED_ENABLED;
    try{
        const res={setHeader(){},end(payload){this.body=JSON.parse(payload)}};
        await handler({method:'GET',query:{enabled:'1'},headers:{}},res);
        assert.equal(res.statusCode,200);
        assert.deepEqual(res.body,{service:'anivibe',embedEnabled:false});
    }finally{
        if(key===undefined)delete process.env.ANIVIBE_API_KEY;
        else process.env.ANIVIBE_API_KEY=key;
        if(flag===undefined)delete process.env.ANIVIBE_PARTNER_EMBED_ENABLED;
        else process.env.ANIVIBE_PARTNER_EMBED_ENABLED=flag;
    }
});

test('partner response is bounded even without Content-Length',async()=>{
 let canceled=false;
 const body=new ReadableStream({start(c){c.enqueue(new Uint8Array(128*1024));c.enqueue(Uint8Array.of(1));},cancel(){canceled=true;}});
 await assert.rejects(callPartner('/api/v1/partner/me','unit-test-key',async()=>new Response(body)),/too large/);
 assert.equal(canceled,true);
});
test('partner health checks coalesce simultaneous upstream requests',async()=>{
 const oldFetch=global.fetch,key=ENV.ANIVIBE_API_KEY;
 const calls=[];let release;
 ENV.ANIVIBE_API_KEY='unit-test-key';
 global.fetch=async url=>{
  calls.push(String(url));
  if(calls.length===1)await new Promise(r=>{release=r;});
  return Response.json({ok:true});
 };
 const makeRes=()=>({setHeader(){},end(payload){this.body=JSON.parse(payload)}});
 try{
  const req={method:'GET',query:{check:'1'},headers:{}};
  const results=Array.from({length:8},makeRes);
  const pending=results.map(res=>handler(req,res));
  assert.equal(calls.length,1);
  release();
  await Promise.all(pending);
  assert.equal(calls.length,2);
  assert.ok(results.every(res=>res.statusCode===200&&res.body.connection==='connected'));
 }finally{global.fetch=oldFetch;if(key===undefined)delete ENV.ANIVIBE_API_KEY;else ENV.ANIVIBE_API_KEY=key;}
});
