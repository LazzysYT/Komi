'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const handler=require('../api/anime');

function mockRes(){
  return {statusCode:200,headers:{},body:undefined,
    setHeader(name,value){this.headers[name.toLowerCase()]=value;},
    end(body){this.body=body;}
  };
}
const anime={
  title:'Провожающая в последний путь Фрирен',
  description:'История путешествия, волшебства и дружбы.',
  poster:'https://shikimori.io/uploads/poster/animes/52991/dc841cc9fce2aa1e9907a4b61c5d1d92.jpeg',
  year:2023,genres:['Драма','Фэнтези'],type:'Сериал',episodeCount:28
};
test('anime SSR returns unique canonical and social card without client-side routing',async()=>{
  const prev=global.fetch;
  let calls=0;
  global.fetch=async(url,opts)=>{
    calls++;
    assert.equal(new URL(url).searchParams.get('shikimori_id'),'eq.52991');
    assert.ok(opts.headers.apikey,'SSR should use its public catalog read API');
    return {ok:true,json:async()=>[{shikimori_id:52991,data:anime}]};
  };
  try{
    const res=mockRes();
    await handler({method:'GET',query:{id:'52991'}},res);
    assert.equal(calls,1);
    assert.equal(res.statusCode,200);
    assert.match(res.headers['content-type'],/text\/html/);
    const html=res.body;
    assert.match(html,/<link rel="canonical" href="https:\/\/komianime\.online\/anime\/52991">/);
    assert.doesNotMatch(html,/<link rel="canonical" href="https:\/\/komianime\.online\/"/);
    assert.match(html,/<meta property="og:title" content="Провожающая в последний путь Фрирен/);
    assert.match(html,/<meta property="og:site_name" content="Komi Anime">/);
    assert.match(html,/<meta property="og:description" content="История путешествия/);
    assert.match(html,/<meta property="og:url" content="https:\/\/komianime\.online\/anime\/52991">/);
    assert.match(html,/<meta property="og:image" content="https:\/\/komianime\.online\/api\/poster\?src=/);
    assert.match(html,/<meta property="og:image:alt" content="Постер аниме «Провожающая/);
    assert.match(html,/<meta name="twitter:card" content="summary_large_image">/);
    assert.match(html,/<meta name="twitter:title" content="Провожающая/);
    assert.match(html,/<meta name="twitter:image" content="https:\/\/komianime\.online\/api\/poster\?src=/);
    assert.match(html,/<script type="application\/ld\+json">/);
    assert.match(html,/<h1>Провожающая в последний путь Фрирен<\/h1>/);
    assert.ok(!html.includes('PERMISSION_DENIED'));
    const head=mockRes();
    await handler({method:'HEAD',query:{id:'52991'}},head);
    assert.equal(head.statusCode,200);
    assert.equal(head.body,'');
  }finally{global.fetch=prev;}
});
test('anime SSR rejects malformed IDs without querying the database',async()=>{
  const prev=global.fetch;
  global.fetch=async()=>{throw Error('Unexpected network call')};
  try{
    const res=mockRes();
    await handler({method:'GET',query:{id:'../../private'}},res);
    assert.equal(res.statusCode,404);
    const post=mockRes();
    await handler({method:'POST',query:{id:'52991'}},post);
    assert.equal(post.statusCode,405);
  }finally{global.fetch=prev;}
});
