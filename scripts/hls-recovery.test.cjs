'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const {source}=require('../player-core');
const code=fs.readFileSync(path.join(__dirname,'../player-runtime.js'),'utf8');

function harness() {
  const timers=new Map();
  let nextTimer=1;
  const instances=[];
  class Hls {
    static Events={ERROR:'error'};
    static ErrorTypes={NETWORK_ERROR:'networkError',MEDIA_ERROR:'mediaError'};
    static isSupported(){return true;}
    constructor(){this.listeners={};this.starts=0;this.recovers=0;this.destroyed=false;instances.push(this)}
    on(name,cb){this.listeners[name]=cb}
    emit(data){this.listeners.error?.(null,data)}
    loadSource(url){this.url=url}
    attachMedia(video){this.video=video}
    startLoad(){this.starts++}
    recoverMediaError(){this.recovers++}
    destroy(){this.destroyed=true}
  }
  let failures=0;
  const events=[];
  const video={
    isConnected:true,komiMediaFailed:false,
    canPlayType(){return ''},
    pause(){},removeAttribute(){},querySelectorAll(){return []},load(){},
    dispatchEvent(event){events.push(event.type);return true}
  };
  const context=vm.createContext({
    window:{Hls}, Event,
    document:{addEventListener(){}},
    KomiPlayerCore:{source},
    video,
    failed(){failures++},
    setTimeout(fn,delay){const id=nextTimer++;timers.set(id,{fn,delay});return id},
    clearTimeout(id){timers.delete(id)}
  });
  vm.runInContext(code,context,{filename:'player-runtime.js'});
  const attach=raw=>vm.runInContext('attachKomiMedia(video, '+JSON.stringify(raw)+', failed)',context);
  return {video,timers,instances,events,attach,dispose:()=>vm.runInContext('disposeKomiMedia(video)',context),
    failures:()=>failures, fireNext:()=>{const [id,job]=timers.entries().next().value||[];if(!job)throw Error('No retry timer');timers.delete(id);job.fn();return job.delay}};
}

test('HLS makes only two bounded retries before showing the recoverable error UI',async()=>{
  const h=harness();
  await h.attach('https://media.test/episode.m3u8');
  assert.equal(h.instances.length,1);
  const stream=h.instances[0];
  stream.emit({fatal:false,type:'networkError'});
  assert.equal(h.timers.size,0);
  stream.emit({fatal:true,type:'networkError'});
  assert.equal(h.timers.size,1);
  stream.emit({fatal:true,type:'networkError'});
  assert.equal(h.timers.size,1,'The same network failure must not queue duplicate retries');
  assert.equal(h.fireNext(),500);
  assert.equal(stream.starts,1);
  stream.emit({fatal:true,type:'networkError'});
  assert.equal(h.fireNext(),1000);
  assert.equal(stream.starts,2);
  stream.emit({fatal:true,type:'networkError'});
  assert.equal(h.failures(),1);
  assert.equal(stream.destroyed,true);
  assert.equal(h.video.komiMediaFailed,true);
  assert.deepEqual(h.events,['komi:hls-levels']);
  assert.equal(h.timers.size,0);
});

test('HLS attempts a single media decoder recovery and then exposes the real error',async()=>{
  const h=harness();
  await h.attach('https://media.test/episode.m3u8');
  const stream=h.instances[0];
  stream.emit({fatal:true,type:'mediaError'});
  assert.equal(stream.recovers,1);
  assert.equal(h.failures(),0);
  stream.emit({fatal:true,type:'mediaError'});
  assert.equal(h.failures(),1);
  assert.equal(stream.destroyed,true);
});

test('Changing or closing an HLS source cancels outstanding recovery timers',async()=>{
  const h=harness();
  await h.attach('https://media.test/first.m3u8');
  const first=h.instances[0];
  first.emit({fatal:true,type:'networkError'});
  assert.equal(h.timers.size,1);
  await h.attach('https://media.test/second.m3u8');
  assert.equal(h.timers.size,0);
  assert.equal(first.destroyed,true);
  first.emit({fatal:true,type:'networkError'});
  assert.equal(h.failures(),0);
  h.instances[1].emit({fatal:true,type:'networkError'});
  assert.equal(h.timers.size,1);
  h.dispose();
  assert.equal(h.timers.size,0);
  assert.equal(h.instances[1].destroyed,true);
  assert.equal(h.failures(),0);
});
