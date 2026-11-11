const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const code=fs.readFileSync(path.join(__dirname,'../watch-party.js'),'utf8');
const start=code.indexOf('async function enterParty(room) {');
const stop=code.indexOf('    partyPanel(`',start);
assert.ok(start>=0&&stop>start);
const earlyJoin=code.slice(start,stop)+'}\n';

function scenario(ensure) {
 const alerts=[],closings=[];
 const ctx=vm.createContext({
   currentUser:{authUserId:'host-owner'},
   animeList:[{id:'anime-1',title:'Тест'}],
   ensureKomiAnimeDetails:ensure,
   clearTimeout(){},
   closeWatchModal(){},
   alert:message=>alerts.push(message),
   leaveWatchPartyRoom:async()=>{
     closings.push(ctx.partyRoom?.id);
     ctx.partyGeneration++;
     ctx.partyRoom=null;
   }
 });
 vm.runInContext('var partyRoom=null,partyGeneration=1,partyTimer=0,partyHeartbeat=0;',ctx);
 vm.runInContext(earlyJoin,ctx);
 const room={id:'test-room',host:'host-owner',anime_id:'anime-1'};
 return {ctx,room,alerts,closings};
}

test('failed episode details leave the broken party room instead of keeping ghost state',async()=>{
 const s=scenario(async()=>{throw Error('Sources unavailable')});
 s.ctx.__room=s.room;
 await vm.runInContext('enterParty(__room)',s.ctx);
 assert.deepEqual(s.closings,['test-room']);
 assert.equal(s.ctx.partyRoom,null);
 assert.equal(s.ctx.partyGeneration,2);
 assert.match(s.alerts[0],/Sources unavailable/);
});

test('stale episode fetch may not close the newer active room',async()=>{
 let rejectFetch;
 const waiting=new Promise((_,reject)=>{rejectFetch=reject});
 const s=scenario(()=>waiting);
 s.ctx.__room=s.room;
 const first=vm.runInContext('enterParty(__room)',s.ctx);
 s.ctx.partyGeneration=2;
 s.ctx.partyRoom={id:'new-room',host:'other',anime_id:'anime-1'};
 rejectFetch(Error('Old room failed'));
 await first;
 assert.deepEqual(s.closings,[]);
 assert.deepEqual(s.alerts,[]);
 assert.equal(s.ctx.partyRoom.id,'new-room');
});
