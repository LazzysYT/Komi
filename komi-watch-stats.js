/* Personal playback stats, independent from AniCoin and Premium. */
(function(root){
'use strict';
const prefix='komi-watch-stat-v1:';
const coveragePrefix='komi-watch-coverage-v1:';
const MAX_SECONDS=604800;
const MIN_FLUSH_MS=10000;
function playbackDelta(prev,next){
 if(!prev||!next||prev.rate!==next.rate)return 0;
 const elapsed=(next.at-prev.at)/1000, moved=next.position-prev.position;
 if(!Number.isFinite(elapsed)||!Number.isFinite(moved)||!Number.isFinite(next.rate)||
    elapsed<=0||elapsed>3||moved<=0||next.rate<=0||moved>elapsed*next.rate+0.20)return 0;
 return moved/next.rate;
}
function mergeRanges(ranges){
 const sorted=ranges.filter(r=>Array.isArray(r)&&r.length===2&&r.every(Number.isFinite)&&r[0]>=0&&r[1]>r[0])
   .sort((a,b)=>a[0]-b[0]);
 const merged=[];
 for(const [start,end] of sorted){
  const last=merged[merged.length-1];
  if(last&&start<=last[1]+0.10)last[1]=Math.max(last[1],end);
  else merged.push([start,end]);
 }
 return merged;
}
function createWatchStats({owner,client,storage,clock,uuid,onSaved=()=>{},onPending=()=>{}}){
 let session=null;
 const inflight=new Map();
 const memory=new Map();
 const key=(uid,id)=>prefix+uid+':'+id;
 function save(uid,id,seconds){
  const k=key(uid,id);
  memory.set(k,Math.max(memory.get(k)||0,seconds));
  try{storage?.setItem(k,String(Math.max(Number(storage.getItem(k))||0,seconds)));}catch{}
 }
 function pending(uid){
  const start=prefix+uid+':', rows=new Map();
  function add(k,value){
   const id=k?.startsWith(start)?k.slice(start.length):'';
   const n=Number(value);
   if(/^[0-9a-f-]{36}$/i.test(id)&&Number.isSafeInteger(n)&&n>0&&n<=MAX_SECONDS)
     rows.set(id,Math.max(rows.get(id)||0,n));
  }
  for(const [k,n] of memory)add(k,n);
  try{for(let i=0;i<(storage?.length||0);i++){const k=storage.key(i);if(k?.startsWith(start))add(k,storage.getItem(k));}}catch{}
  return rows;
 }
 function forget(uid,id,sent){
  const k=key(uid,id);
  if((memory.get(k)||0)<=sent)memory.delete(k);
  try{if((Number(storage?.getItem(k))||0)<=sent)storage?.removeItem(k);}catch{}
 }
 function record(uid,delta){
  if(!uid||uid!==owner()||!Number.isFinite(delta)||delta<=0)return;
  if(session?.uid!==uid||session.total>=MAX_SECONDS)
    session={uid,id:uuid(),total:0,last:clock(),saved:0};
  const s=session;
  s.total=Math.min(MAX_SECONDS,s.total+delta);
  // A fraction of a millisecond of floating point error must not hide a minute.
  const total=Math.floor(s.total+1e-6);
  if(total<=s.saved)return;
  const minute=Math.floor(total/60)>Math.floor(s.saved/60);
  s.saved=total;
  save(uid,s.id,total);
  if(minute||clock()-s.last>=MIN_FLUSH_MS){s.last=clock();void flush(uid);}
 }
 function flush(uid=owner()){
  if(!uid||owner()!==uid||!client())return Promise.resolve(false);
  if(inflight.has(uid))return inflight.get(uid);
  if(!pending(uid).size)return Promise.resolve(true);
  let job;
  job=Promise.resolve().then(async()=>{
   for(let pass=0;pass<3;pass++){
    const rows=pending(uid);
    if(!rows.size)break;
    for(const [id,seconds] of rows){
     if(owner()!==uid)return false;
     const controller=typeof AbortController==='function'?new AbortController():null;
     const timer=controller&&setTimeout(()=>controller.abort(),7000);
     try{
      let request=client().rpc('komi_save_watch_session',{p_owner:uid,p_session:id,p_seconds:seconds});
      if(controller&&typeof request.abortSignal==='function')request=request.abortSignal(controller.signal);
      const result=await request;
      if(result?.error||result?.data!==true)return false;
      if(owner()!==uid)return false;
      forget(uid,id,seconds);
     }finally{if(timer)clearTimeout(timer);}
    }
   }
   if(owner()===uid)onSaved(uid);
   return true;
  }).catch(()=>false).finally(()=>{
   if(inflight.get(uid)===job)inflight.delete(uid);
   if(owner()===uid)onPending(uid);
  });
  inflight.set(uid,job);
  return job;
 }
 function reset(uid){if(session?.uid===uid)session=null;}
 return {record,flush,pending,reset};
}
function coverageKey(video){
 const {owner,animeId,season,episode,completionIndex}=video.dataset||{};
 const slot=completionIndex??episode;
 if(!owner||!/^\d+$/.test(animeId||'')||!/^\d+$/.test(season||'')||!/^\d+$/.test(slot||''))return '';
 return coveragePrefix+[owner,animeId,season,slot].map(encodeURIComponent).join(':');
}
function updateCoverage(video,storage){
 const duration=Number(video.duration), key=coverageKey(video);
 if(!key||!Number.isFinite(duration)||duration<=0)return 0;
 const ranges=[];
 try{
  const prior=JSON.parse(storage?.getItem(key)||'null');
  if(prior&&Math.abs(prior.duration-duration)<Math.max(2,duration*0.015)&&Array.isArray(prior.ranges))
    ranges.push(...prior.ranges.slice(0,120));
 }catch{}
 const played=video.played;
 for(let i=0;i<(played?.length||0)&&i<120;i++){
  try{ranges.push([played.start(i),Math.min(duration,played.end(i))]);}catch{}
 }
 const merged=mergeRanges(ranges).map(([a,b])=>[Math.min(duration,a),Math.min(duration,b)]).filter(([a,b])=>b>a).slice(0,120);
 try{storage?.setItem(key,JSON.stringify({duration,ranges:merged}));}catch{}
 return merged.reduce((total,[a,b])=>total+b-a,0)/duration;
}
if(typeof module==='object'&&module.exports){
 module.exports={playbackDelta,mergeRanges,createWatchStats,updateCoverage};
 return;
}
const activeOwner=()=>typeof currentUser==='undefined'?null:currentUser?.authUserId||null;
const getClient=()=>typeof _supabase==='undefined'?null:_supabase;
let storage;
try{storage=root.localStorage;}catch{}
const stats=createWatchStats({owner:activeOwner,client:getClient,storage,clock:()=>performance.now(),
 uuid:()=>crypto.randomUUID(),onSaved:uid=>root.dispatchEvent(new CustomEvent('komi:watch-stats-saved',{detail:uid}))});
function bind(video){
 const owner=video.dataset.owner;
 if(!owner||activeOwner()!==owner)return;
 const now=()=>performance.now();
 const point=()=>({at:now(),position:video.currentTime,rate:video.playbackRate});
 const valid=()=>video.isConnected&&owner===activeOwner()&&!video.error&&!video.komiMediaFailed;
 let previous=null,lastCoverage=0;
 const collect=()=>{if(valid())updateCoverage(video,storage);};
 const anchor=()=>{previous=valid()&&!document.hidden&&!video.paused&&!video.seeking&&!video.ended?point():null;};
 const settle=(tail=false)=>{
  if(!valid())return;
  if(tail&&previous&&!video.seeking)stats.record(owner,playbackDelta(previous,point()));
  collect(); previous=null; void stats.flush(owner);
 };
 video.addEventListener('playing',anchor);
 video.addEventListener('seeked',anchor);
 video.addEventListener('timeupdate',()=>{
  if(!valid()||document.hidden||video.paused||video.seeking||video.ended){previous=null;return;}
  const next=point();
  stats.record(owner,playbackDelta(previous,next));
  previous=next;
  if(next.at-lastCoverage>=10000){lastCoverage=next.at;collect();}
 });
 for(const type of ['seeking','waiting','pause','ended','emptied','error','ratechange'])
  video.addEventListener(type,()=>settle(type==='pause'||type==='ended'||type==='waiting'));
 video.addEventListener('ratechange',anchor);
 video.komiWatchStatsVisibility=()=>{ if(document.hidden)settle(true);else anchor(); };
 video.komiWatchStatsDispose=()=>settle(!document.hidden);
}
function visible(){document.getElementById('animeVideoPlayer')?.komiWatchStatsVisibility?.();}
document.addEventListener('visibilitychange',visible);
root.addEventListener('pagehide',()=>document.getElementById('animeVideoPlayer')?.komiWatchStatsDispose?.());
root.addEventListener('online',()=>void stats.flush());
root.KomiWatchStats={bind,flush:stats.flush,hasPending:uid=>stats.pending(uid).size>0,reset:stats.reset,
 completion:video=>updateCoverage(video,storage)>=0.80};
})(globalThis);
