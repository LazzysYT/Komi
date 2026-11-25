'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const app=fs.readFileSync(path.join(__dirname,'../app-main.js'),'utf8');
const start=app.indexOf('const initialCatalogPromise = new Promise');
const end=app.indexOf('// Let the public catalog load first',start);
assert.ok(start>=0&&end>start);
const source=app.slice(start,end)+'\ninitialCatalogPromise;';

function fixture({route='home',ready=false,withImage=false}={}) {
  let release, calls=0, next=0;
  const events=new EventTarget(), timers=new Map();
  const image=withImage?Object.assign(new EventTarget(),{complete:ready}):null;
  const promise=new Promise(resolve=>{release=resolve;});
  const context={
    window:Object.assign(events,{KomiHeroDaily:{firstImage:{ready,promise}}}),
    document:{querySelector:()=>image},currentView:route,
    komiHomePreviewCatalog:[{id:'61316'}],komiRouteView:()=>route,
    location:{search:''},URLSearchParams,
    loadDataFromCloud(){calls++;return Promise.resolve();},
    setTimeout(fn,ms){const id=++next;timers.set(id,{fn,ms});return id;},
    clearTimeout(id){timers.delete(id);}
  };
  const completed=vm.runInNewContext(source,context);
  return {events,timers,release,completed,calls:()=>calls};
}

test('a daily image not yet mounted keeps background catalog requests behind its decode',async()=>{
  const x=fixture();
  assert.equal(x.calls(),0);
  x.release(true);
  await x.completed;
  assert.equal(x.calls(),1);
  assert.equal(x.timers.size,0);
});

test('user input bypasses the image wait and later decode cannot start another catalog scan',async()=>{
  const x=fixture();
  x.events.dispatchEvent(new Event('pointerdown'));
  await x.completed;
  x.release(true);
  await Promise.resolve();
  assert.equal(x.calls(),1);
  assert.equal(x.timers.size,0);
});

test('a stalled image cannot block the catalog beyond the bounded head start',async()=>{
  const x=fixture();
  const [{fn,ms}]=[...x.timers.values()];
  assert.equal(ms,1800);
  fn();
  await x.completed;
  assert.equal(x.calls(),1);
});

test('catalog routes and decoded previews load catalog data immediately',async()=>{
  for(const options of [{route:'catalog'},{ready:true},{ready:true,withImage:true}]) {
    const x=fixture(options);
    await x.completed;
    assert.equal(x.calls(),1);
    assert.equal(x.timers.size,0);
  }
});

test('a failed first frame releases background work instead of leaving an endless wait',async()=>{
  const x=fixture();
  x.release(false);
  await x.completed;
  assert.equal(x.calls(),1);
});
