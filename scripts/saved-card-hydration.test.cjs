const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const test=require('node:test');
const assert=require('node:assert/strict');

const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const cacheStart=html.indexOf('const komiSavedAnimeCards = new Map();');
const cacheEnd=html.indexOf('        let komiCollectionLoadEpoch',cacheStart);
const helperStart=html.indexOf('async function komiHydrateSavedAnimeCards(');
const helperEnd=html.indexOf('        async function loadAuthenticatedAnimeData()',helperStart);
assert.ok(cacheStart>=0&&cacheEnd>cacheStart&&helperStart>=0&&helperEnd>helperStart);
const source=html.slice(cacheStart,cacheEnd)+html.slice(helperStart,helperEnd);
function fixture({rows=[],status={'98':'Просмотрено'},favorites={},error=null,deferred=null}={}){
 const requests=[],renders=[];
 const context=vm.createContext({
  currentUser:{username:'alice',authUserId:'u1'},
  userAnimeStatuses:{alice:status},userFavorites:{alice:favorites},
  animeList:[{id:'1',title:'Already in catalog'}],
  render(){renders.push('render')},
  _supabase:{
   from(table){
    requests.push(['from',table]);
    const chain={
     select(columns){requests.push(['select',columns]);return chain;},
     in(key,ids){
      requests.push(['in',key,ids]);
      return deferred || Promise.resolve(error?{data:null,error:{message:error}}:{data:rows,error:null});
     }
    };
    return chain;
   }
  },Error,Set,Map,Number
 });
 vm.runInContext(source,context);
 return {context,requests,renders,run:()=>vm.runInContext("komiHydrateSavedAnimeCards('u1')",context),
  cards:()=>vm.runInContext("komiSavedAnimeCards",context)};
}
test('saved anime card appears before the rest of the catalog is loaded',async()=>{
 const x=fixture({rows:[{shikimori_id:98,updated_at:'2026-11-11T00:00:00Z',
   data:{title:'Saved anime',poster:'https://example.com/poster.webp',genres:['Drama'],episodeCount:3}}]});
 await x.run();
 assert.equal(x.cards().size,1);
 const card=x.cards().get('98');
 assert.equal(card.title,'Saved anime');
 assert.equal(card.id,'98');
 assert.equal(card.shikimoriId,98);
 assert.equal(card.episodeCount,3);
 assert.deepEqual(Array.from(card.episodes),[]);
 assert.ok(x.renders.length>0);
 assert.ok(x.requests.some(r=>r[0]==='in'&&r[1]==='shikimori_id'&&r[2][0]===98));
 assert.equal(x.context.userAnimeStatuses.alice['98'],'Просмотрено');
});
test('card hydration never reads someone else private lists or untrusted ID values',async()=>{
 const x=fixture({status:{'abc': 'Просмотрено','-1':'Смотрю','1':'Просмотрено',
   '9007199254740999':'В планах'},favorites:{'3<script>':'Любимые'}});
 await x.run();
 assert.equal(x.requests.length,0);
 assert.equal(x.cards().size,0);
});
test('stale response from a previous account cannot put its cards into a new session',async()=>{
 let release;
 const deferred=new Promise(resolve=>{release=resolve});
 const x=fixture({deferred});
 const pending=x.run();
 x.context.currentUser={username:'bob',authUserId:'u2'};
 release({data:[{shikimori_id:98,data:{title:'Previous owner'}}],error:null});
 await pending;
 assert.equal(x.cards().size,0);
 assert.equal(x.renders.length,0);
});
test('errors do not delete status data or fabricate saved cards',async()=>{
 const x=fixture({error:'Catalog unavailable'});
 await assert.rejects(x.run(),/Catalog unavailable/,()=>true);
 assert.equal(x.cards().size,0);
 assert.equal(x.context.userAnimeStatuses.alice['98'],'Просмотрено');
});
test('profile cache is restricted to the matching verified user ID',()=>{
 const snippet=html.slice(html.indexOf('function renderProfileView('),
   html.indexOf('        let avatarDraft = null;'));
 assert.match(snippet,/isMe && currentUser\?\.authUserId === komiSavedCardsOwner/);
 assert.match(snippet,/profileAnimeById\.set\(id,anime\)/);
});
