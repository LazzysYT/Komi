'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {playbackDelta,mergeRanges,createWatchStats,updateCoverage}=require('../komi-watch-stats');
const root=path.join(__dirname,'..');
const read=x=>fs.readFileSync(path.join(root,x),'utf8');
function storage(){
 const values=new Map();
 return {get length(){return values.size;},key:i=>[...values.keys()][i],
   setItem:(k,v)=>values.set(k,v),getItem:k=>values.get(k),removeItem:k=>values.delete(k)};
}
function playerFixture(saved=storage()){
 let user='a',now=0,n=0,fail=false;
 const calls=[],server=new Map();
 const api=()=>({rpc:async(_fn,p)=>{
   calls.push(p);
   if(fail)return {error:new Error('offline')};
   const key=p.p_owner+':'+p.p_session;
   server.set(key,Math.max(server.get(key)||0,p.p_seconds));
   return {data:true};
 }});
 const make=()=>createWatchStats({owner:()=>user,clock:()=>now,storage:saved,client:api,
   uuid:()=>('00000000-0000-4000-8000-'+String(++n).padStart(12,'0'))});
 return {make,calls,server,tick:ms=>now+=ms,fail:bool=>fail=bool,switch:id=>user=id};
}
test('active playback accrues elapsed time at real speed, not seek distance or buffered time',()=>{
 const p=(at,position,rate=1)=>({at,position,rate});
 assert.equal(playbackDelta(p(0,10),p(1000,11)),1);
 assert.equal(playbackDelta(p(0,10,2),p(1000,12,2)),1);
 assert.equal(playbackDelta(p(0,10,0.5),p(1000,10.5,0.5)),1);
 for(const samples of [[p(0,1),p(1000,55)],[p(0,5),p(1000,4)],[p(0,2),p(1000,2)],
 [p(0,1),p(6000,7)],[p(0,1),p(1000,3,2)],[null,p(1000,11)]])
   assert.equal(playbackDelta(...samples),0);
});
test('first minute persists without rounding to an hour, and another second joins the in-flight save',async()=>{
 const f=playerFixture(),s=f.make();
 for(let i=0;i<61;i++){f.tick(1000);s.record('a',1);if((i+1)%10===0||i===59)await s.flush();}
 await s.flush();
 assert.ok(f.calls.some(p=>p.p_seconds===60));
 assert.equal([...f.server.values()].reduce((a,b)=>a+b),61);
 assert.equal(s.pending('a').size,0);
});
test('outbox replays previous owner data only for that account after a reload',async()=>{
 const f=playerFixture();let s=f.make();
 f.fail(true);
 s.record('a',59);s.record('a',1);
 assert.equal(await s.flush(),false);
 f.switch('b');s=f.make();f.fail(false);
 await s.flush();assert.equal(f.server.size,0);
 s.record('b',5);
 await s.flush();assert.equal(f.server.size,1);
 f.switch('a');s=f.make();
 await s.flush();
 assert.deepEqual([...f.server.values()].sort((a,b)=>a-b),[5,60]);
 assert.equal(s.pending('a').size,0);
});
test('skipping to the end does not turn a minute into a complete episode; actual played ranges survive resume',()=>{
 const local=storage();
 const video={dataset:{owner:'a',animeId:'123',season:'1',episode:'8',completionIndex:'7'},duration:1200,played:null};
 const withRanges=ranges=>{video.played={length:ranges.length,start:i=>ranges[i][0],end:i=>ranges[i][1]};return updateCoverage(video,local);};
 assert.ok(withRanges([[0,60],[1195,1200]])<0.10);
 assert.ok(withRanges([[60,650]])<0.80);
 assert.ok(withRanges([[650,1150]])>=0.80);
 video.dataset.owner='b';
 assert.equal(withRanges([[1195,1200]]),5/1200);
 assert.deepEqual(mergeRanges([[11,23],[0,12],[24,25],[27,26]]),[[0,23],[24,25]]);
});
test('summary formats one minute in Russian and never shows owner read controls publicly',()=>{
 const ctx={document:{addEventListener(){}},location:{origin:'https://example.test'},URL};
 ctx.window=ctx;
 vm.runInNewContext(read('profile-premium.js'),ctx);
 const ui=ctx.KomiProfileUI;
 for(const [seconds,expected] of [[null,'—'],[0,'0 минут'],[59,'Меньше минуты'],[60,'1 минута'],[120,'2 минуты'],[660,'11 минут'],[3660,'1 ч 1 мин']])
   assert.equal(ui.watchTime(seconds),expected);
 assert.match(ui.summary({ownWatchStats:true}),/data-profile-watch-retry/);
 assert.doesNotMatch(ui.summary({ownWatchStats:false}),/data-profile-watch-retry/);
 assert.match(read('player-ux.js'),/Отметить серию просмотренной/);
 assert.match(read('player-runtime.js'),/KomiWatchStats\?\.bind/);
 assert.doesNotMatch(read('komi-watch-stats.js'),/komi_anicoin|p_action:'watch'/);
});
