'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const script=fs.readFileSync(path.join(__dirname,'../komi-ads-loader.js'),'utf8');
const SDK='https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4262066374546613';
const flush=async()=>{for(let i=0;i<4;i++)await Promise.resolve();};
function fixture({state='interactive',hero=true,raf=true,idle=true,existing=false,home=false}={}) {
 const documentEvents=new Map(),windowEvents=new Map(),timers=new Map(),frames=new Map(),idles=new Map();
 const scripts=existing?[{src:SDK}]:[],inserted=[];
 let sequence=0,resolveImage,rejectImage;
 const image=new Promise((resolve,reject)=>{resolveImage=resolve;rejectImage=reject;});
 const listen=(map,name,fn)=>{if(!map.has(name))map.set(name,new Set());map.get(name).add(fn);};
 const remove=(map,name,fn)=>map.get(name)?.delete(fn);
 const emit=(map,name,event={type:name})=>{for(const fn of [...(map.get(name)||[])])fn(event);};
 const document={readyState:state,baseURI:'https://komi.example/',
  querySelectorAll:()=>scripts,createElement:tag=>({tag}),
  head:{append(node){scripts.push(node);inserted.push(node);}},
  addEventListener:(name,fn)=>listen(documentEvents,name,fn),
  removeEventListener:(name,fn)=>remove(documentEvents,name,fn)};
 const scope={document,URL,
  addEventListener:(name,fn)=>listen(windowEvents,name,fn),
  removeEventListener:(name,fn)=>remove(windowEvents,name,fn),
  setTimeout:(fn,delay)=>{const id=++sequence;timers.set(id,{fn,delay});return id;},
  clearTimeout:id=>timers.delete(id)};
 if(home)scope.location={pathname:'/',hash:'',search:''};
 if(hero)scope.KomiHeroDaily={firstImage:{promise:image}};
 if(raf){scope.requestAnimationFrame=fn=>{const id=++sequence;frames.set(id,fn);return id;};scope.cancelAnimationFrame=id=>frames.delete(id);}
 if(idle){scope.requestIdleCallback=(fn,options)=>{const id=++sequence;idles.set(id,{fn,options});return id;};scope.cancelIdleCallback=id=>idles.delete(id);}
 vm.createContext(scope);
 const run=()=>vm.runInContext(script,scope);
 run();
 return {scope,inserted,scripts,timers,frames,idles,resolveImage,rejectImage,run,
  interact(name,event={type:name}){emit(windowEvents,name,event);},
  dom(){emit(documentEvents,'DOMContentLoaded');},
  loaded(){emit(windowEvents,'load');},
  frame(){const pending=[...frames];frames.clear();for(const [,fn] of pending)fn();},
  idle(){const pending=[...idles];idles.clear();for(const [,job] of pending)job.fn();},
  expire(delay){for(const [id,job] of [...timers])if(job.delay===delay){timers.delete(id);job.fn();}},
  listeners(){return [...documentEvents.values(),...windowEvents.values()].reduce((sum,set)=>sum+set.size,0);}
 };
}
function assertSDK(f) {
 assert.equal(f.inserted.length,1);
 assert.equal(f.inserted[0].src,SDK);
 assert.equal(f.inserted[0].async,true);
 assert.equal(f.inserted[0].crossOrigin,'anonymous');
 assert.equal(f.listeners(),0);
 assert.equal(f.timers.size,0);
 assert.equal(f.frames.size,0);
 assert.equal(f.idles.size,0);
}
test('decoded hero still waits for actual DOMContentLoaded, two frames and bounded idle',async()=>{
 const f=fixture();f.resolveImage(true);await flush();
 assert.equal(f.frames.size,0,'interactive is not proof that deferred app scripts finished');
 f.dom();assert.equal(f.frames.size,1);
 f.frame();assert.equal(f.idles.size,0);assert.equal(f.inserted.length,0);
 f.frame();assert.equal(f.idles.size,1);assert.equal([...f.idles.values()][0].options.timeout,1000);
 assert.equal(f.inserted.length,0);
 f.idle();assertSDK(f);
 f.dom();f.loaded();f.run();f.expire(5000);f.expire(1000);f.frame();f.idle();
 assertSDK(f);
});
test('DOM readiness waits for pending hero decode without starting the SDK',async()=>{
 const f=fixture();f.dom();await flush();
 assert.equal(f.frames.size,0);assert.equal(f.inserted.length,0);
 f.resolveImage(true);await flush();f.frame();f.frame();f.idle();assertSDK(f);
});
test('other routes skip the image gate but retain app and paint ordering',async()=>{
 for(const state of ['loading','interactive','complete']) {
  const f=fixture({state,hero:false});await flush();
  if(state!=='complete'){assert.equal(f.frames.size,0);f.dom();}
  f.frame();f.frame();f.idle();assertSDK(f);
 }
});
test('image failures and the boot image timeout release advertising normally',async()=>{
 for(const result of ['failed','timeout','rejected']) {
  const f=fixture();f.dom();
  if(result==='rejected')f.rejectImage(new Error('decode failed'));
  else f.resolveImage(false); // Both the boot timeout and onerror resolve false.
  await flush();f.frame();f.frame();f.idle();assertSDK(f);
 }
});
test('stalled DOM events and suspended animation frames have independent bounded fallbacks',async()=>{
 const f=fixture();f.resolveImage(true);await flush();
 assert.ok([...f.timers.values()].some(job=>job.delay===5000));
 f.expire(5000);assert.equal(f.listeners(),0);
 assert.ok([...f.timers.values()].some(job=>job.delay===1000));
 f.expire(1000);assert.equal(f.frames.size,0);assert.equal(f.inserted.length,0);
 f.idle();assertSDK(f);
});
test('load covers late insertion and missing RAF or idle APIs still yield before insertion',async()=>{
 const late=fixture({hero:false});await flush();late.loaded();late.frame();late.frame();late.idle();assertSDK(late);
 for(const [raf,idle] of [[false,false],[false,true],[true,false]]) {
  const f=fixture({state:'complete',hero:false,raf,idle});await flush();
  if(raf){f.frame();f.frame();}
  assert.equal(f.inserted.length,0);
  if(idle)f.idle();else f.expire(0);
  assertSDK(f);
 }
});
test('existing or concurrently inserted SDK and repeated loader execution never duplicate it',async()=>{
 const existing=fixture({existing:true});await flush();
 assert.equal(existing.inserted.length,0);assert.equal(existing.timers.size,0);assert.equal(existing.listeners(),0);
 existing.run();assert.equal(existing.scripts.length,1);
 const concurrent=fixture({state:'complete',hero:false});await flush();concurrent.frame();concurrent.frame();
 concurrent.scripts.push({src:SDK});concurrent.idle();
 assert.equal(concurrent.inserted.length,0);assert.equal(concurrent.scripts.length,1);
 assert.equal(concurrent.timers.size,0);assert.equal(concurrent.frames.size,0);assert.equal(concurrent.idles.size,0);
});

test('home browsing keeps ads out of initial content work, then loads unchanged SDK once on real engagement',async()=>{
 for(const event of ['pointerdown','keydown','scroll','hashchange']){
  const f=fixture({home:true});f.dom();f.resolveImage(true);await flush();
  f.frame();f.frame();f.idle();assert.equal(f.inserted.length,0);
  f.scope.scrollY=0;f.interact('scroll');f.interact('keydown',{type:'keydown',key:'Shift'});
  assert.equal(f.frames.size,0);
  if(event==='scroll')f.scope.scrollY=180;
  if(event==='hashchange')f.scope.location.hash='#catalog';
  f.interact(event,{type:event,key:'Enter'});f.frame();f.frame();f.idle();assertSDK(f);
  f.interact('pointerdown');f.idle();assertSDK(f);
 }
});
test('early home engagement still waits for app startup and first image',async()=>{
 const f=fixture({home:true});f.interact('pointerdown');
 assert.equal(f.frames.size,0);f.dom();assert.equal(f.frames.size,0);
 f.resolveImage(true);await flush();f.frame();f.frame();f.idle();assertSDK(f);
});
