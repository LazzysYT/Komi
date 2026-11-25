'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname,'..','hero-hd-art.js'),'utf8');

class Events {
  constructor() { this.events = new Map(); }
  addEventListener(type,fn) {
    if (!this.events.has(type)) this.events.set(type,new Set());
    this.events.get(type).add(fn);
  }
  removeEventListener(type,fn) { this.events.get(type)?.delete(fn); }
  emit(type,event = {}) { for (const fn of this.events.get(type) || []) fn({type,...event}); }
}
function classes(initial = []) {
  const values = new Set(initial);
  return {
    contains:name=>values.has(name), add:name=>values.add(name), remove:name=>values.delete(name),
    toggle(name,on) { if (on ?? !values.has(name)) values.add(name); else values.delete(name); }
  };
}
const settle = async () => { for (let i=0;i<12;i++) await new Promise(resolve=>setImmediate(resolve)); };

function fixture({slides:input=[{}],imageSizes={},media=[],metadata,ready=true,playMode='success',
  intersectionObserver=true,initialIntersection=true,rect} = {}) {
  const timers = new Map(),frames = new Map(),imageRequests = [],apiRequests = [],videos = [],storage = new Map();
  const mutations = [],observers = [];
  let nextTimer = 1,nextFrame = 1,currentSlider,geometryReads=0;
  const reduced = new Events(); reduced.matches = false;
  const fine = new Events(); fine.matches = true;
  const connection = new Events(); connection.saveData = false; connection.effectiveType = '4g';
  const document = new Events(); document.hidden = false; document.activeElement = null;
  const watchModal = {classList:classes()};
  const attributes = new Map();
  const icon = () => ({hidden:false,toggleAttribute(_name,value) { this.hidden = value; }});
  const pauseIcon = icon(),playIcon = icon();
  const button = {
    hidden:false,disabled:false,ownerSlider:null,
    closest(selector) { return selector === '#heroSlider' ? this.ownerSlider : selector === '[data-komi-hero-toggle]' ? this : null; },
    setAttribute:(name,value)=>attributes.set(name,value),getAttribute:name=>attributes.get(name),
    querySelectorAll(selector) { return selector === '[data-komi-hero-pause-icon]' ? [pauseIcon] : selector === '[data-komi-hero-play-icon]' ? [playIcon] : []; }
  };
  const slider = new Events();
  Object.assign(slider,{
    dataset:{},isConnected:true,hover:false,slides:[],
    rect:rect || {left:0,top:0,right:1200,bottom:500,width:1200,height:500},
    properties:new Map(),
    getBoundingClientRect() { geometryReads++; return this.rect; },
    closest(selector) { return selector === '#heroSlider' || selector === '.komi-home-hero' ? this : null; },
    contains(node) { return node === this || node?.ownerSlider === this; },
    matches(selector) { return selector === ':hover' ? this.hover : selector === ':focus-within' ? this.contains(document.activeElement) : false; },
    querySelectorAll(selector) { return selector === '.hero-slide' ? this.slides : selector === '[data-komi-hero-toggle]' ? [button] : []; }
  });
  slider.style = {setProperty:(name,value)=>slider.properties.set(name,value),removeProperty:name=>slider.properties.delete(name)};
  currentSlider = slider; button.ownerSlider = slider;
  const main = {};

  class Video extends Events {
    constructor() {
      super(); this.classList = classes(); this.paused = true; this.playCount = 0; this.pauseCount = 0;
      this.ownerSlide = null; this.ownerSlider = null; this.detached = false; this.playResolvers = [];
      videos.push(this);
    }
    get isConnected() { return !this.detached && Boolean(this.ownerSlider?.isConnected); }
    setAttribute() {}
    removeAttribute(name) { if (name === 'src') this.src = ''; }
    load() { this.loadCount = (this.loadCount || 0)+1; }
    remove() { this.detached = true; if (this.ownerSlide?.video === this) this.ownerSlide.video = null; }
    play() {
      this.playCount++;
      if (playMode === 'reject') return Promise.reject(Object.assign(new Error('Blocked'),{name:'NotAllowedError'}));
      this.paused = false;
      if (playMode === 'pending') return new Promise(resolve=>this.playResolvers.push(resolve));
      queueMicrotask(()=>this.emit('playing'));
      return Promise.resolve();
    }
    pause() { this.pauseCount++; this.paused = true; }
  }
  slider.slides = input.map((values,index) => {
    const slide = new Events();
    Object.assign(slide,{
      ownerSlider:slider,
      dataset:{komiAnimeId:String(52991+index),...values},
      classList:classes(['hero-slide','komi-hd-poster',...(index === 0 ? ['active'] : [])]),
      closest:selector=>selector === '#heroSlider' ? slider : null,
      querySelector(selector) {
        if (selector === 'img.komi-hub-hero-art') return this.img;
        if (selector === 'video.komi-hero-video') return this.video || null;
        return null;
      }
    });
    Object.defineProperty(slide,'isConnected',{get:()=>slider.isConnected});
    const img = new Events();
    Object.assign(img,{
      ownerSlider:slider,dataset:{},complete:ready,naturalWidth:300,naturalHeight:450,
      after(video) { slide.video = video; video.ownerSlide = slide; video.ownerSlider = slider; },
      _src:'https://images.example/portrait.jpg'
    });
    Object.defineProperty(img,'isConnected',{get:()=>slider.isConnected});
    Object.defineProperty(img,'src',{
      get() { return this._src; },
      set(url) { this._src = url; const size=imageSizes[url]; if (size) [this.naturalWidth,this.naturalHeight]=size; this.complete=true; queueMicrotask(()=>this.emit('load')); }
    });
    slide.img = img;
    return slide;
  });
  class Image {
    set src(url) {
      imageRequests.push(url);
      queueMicrotask(()=>{
        const size=imageSizes[url];
        if (size) { [this.naturalWidth,this.naturalHeight]=size; this.onload?.(); }
        else this.onerror?.();
      });
    }
    removeAttribute() {}
  }
  document.getElementById = id => id === 'heroSlider' ? currentSlider : id === 'mainContainer' ? main : id === 'watchModal' ? watchModal : null;
  document.querySelectorAll = selector => {
    const all = currentSlider?.isConnected ? currentSlider.slides : [];
    return selector.endsWith('.active') ? all.filter(s=>s.classList.contains('active')) : all;
  };
  document.createElement = tag => { if (tag === 'video') return new Video(); throw new Error('Unexpected element '+tag); };
  const root = new Events();
  Object.assign(root,{
    navigator:{connection},innerHeight:900,innerWidth:1200,
    matchMedia:text=>text.includes('prefers-reduced-motion') ? reduced : fine,
    requestAnimationFrame:fn=>{ const id=nextFrame++; frames.set(id,fn); return id; },
    cancelAnimationFrame:id=>frames.delete(id),
    requestIdleCallback:fn=>queueMicrotask(fn),
    IntersectionObserver:class {
      constructor(fn) { this.callback=fn; this.targets=new Set(); observers.push(this); }
      observe(target) { this.targets.add(target); }
      unobserve(target) { this.targets.delete(target); }
    }
  });
  if (!intersectionObserver) delete root.IntersectionObserver;
  if (metadata) root.komiFetchHeroMetadata = metadata;
  const context = {
    window:root,document,URL,AbortController,Image,
    setTimeout:(fn,delay)=>{const id=nextTimer++;timers.set(id,{fn,delay});return id;},
    clearTimeout:id=>timers.delete(id),
    sessionStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)},
    MutationObserver:class {
      constructor(fn) { this.callback=fn; }
      observe(target,options) { mutations.push({target,options,callback:this.callback}); }
    },
    fetch:async(_url,options)=>{ apiRequests.push(JSON.parse(options.body)); return {ok:true,json:async()=>({data:{Page:{media}}})}; }
  };
  vm.runInNewContext(source,context,{filename:'hero-hd-art.js'});
  if (intersectionObserver && initialIntersection !== null)
    observers[0].callback([{target:slider,isIntersecting:initialIntersection,intersectionRatio:initialIntersection?1:0}]);
  return {
    root,document,slider,slides:slider.slides,button,pauseIcon,playIcon,attributes,connection,reduced,fine,videos,
    imageRequests,apiRequests,timers,frames,observers,
    get geometryReads() { return geometryReads; },
    runDeferred() { for (const [id,item] of [...timers]) if (item.delay === 1800) { timers.delete(id); item.fn(); } },
    mutate() { for (const observer of mutations) if(observer.target===main) observer.callback(); },
    watch(open) {
      watchModal.classList.toggle('active',open);
      for(const observer of mutations) if(observer.target===watchModal && observer.options.attributes &&
          observer.options.attributeFilter?.includes('class'))
        observer.callback([{target:watchModal,type:'attributes',attributeName:'class'}]);
    },
    detach() { slider.isConnected=false; currentSlider=null; this.mutate(); },
    intersect(visible) { observers[0].callback([{target:slider,isIntersecting:visible,intersectionRatio:visible?1:0}]); },
    preference(media,value) { media.matches=value; media.emit('change'); },
    click() { document.emit('click',{target:button}); },
    flushFrames() { for (const [id,fn] of [...frames]) { frames.delete(id); fn(); } }
  };
}
const videoUrl = 'https://media.example/hero.mp4';

test('initial visibility waits for IntersectionObserver without a synchronous geometry read',async()=>{
  const f=fixture({slides:[{komiHeroVideo:videoUrl}],initialIntersection:null});
  assert.equal(f.geometryReads,0);
  assert.equal(f.root.KomiHeroArt.isPaused(f.slider),true);
  f.root.KomiHeroArt.scan();await settle();
  assert.equal(f.videos.length,0);
  assert.equal(f.apiRequests.length,0);
  f.intersect(false);f.root.KomiHeroArt.scan();await settle();
  assert.equal(f.videos.length,0);
  f.intersect(true);f.runDeferred();await settle();
  assert.equal(f.videos.length,1);
  assert.equal(f.videos[0].paused,false);
  assert.equal(f.geometryReads,0);
});

test('browsers without IntersectionObserver retain the initial geometry visibility fallback',async()=>{
  const visible=fixture({slides:[{komiHeroVideo:videoUrl}],intersectionObserver:false});
  visible.root.KomiHeroArt.scan();await settle();
  assert.equal(visible.geometryReads,1);
  assert.equal(visible.videos[0].paused,false);
  const offscreen=fixture({slides:[{komiHeroVideo:videoUrl}],intersectionObserver:false,
    rect:{left:0,right:1200,top:950,bottom:1450,width:1200,height:500}});
  offscreen.root.KomiHeroArt.scan();await settle();
  assert.equal(offscreen.geometryReads,1);
  assert.equal(offscreen.root.KomiHeroArt.isPaused(offscreen.slider),true);
  assert.equal(offscreen.videos.length,0);
});

test('first video waits for deferred scan and decoded first image; inactive videos never load',async()=>{
  const f=fixture({slides:[{komiHeroVideo:videoUrl},{komiHeroVideo:'https://media.example/next.webm'}],ready:false});
  assert.equal(f.videos.length,0);
  f.runDeferred(); await settle();
  assert.equal(f.videos.length,0);
  f.slides[0].img.complete=true; f.slides[0].img.emit('load');
  f.runDeferred(); await settle();
  assert.equal(f.videos.length,1);
  const video=f.videos[0];
  assert.equal(video.src,videoUrl);
  assert.equal(video.muted,true); assert.equal(video.defaultMuted,true); assert.equal(video.playsInline,true);
  assert.equal(video.loop,true); assert.equal(video.preload,'none');
  for(let i=0;i<6;i++) f.root.KomiHeroArt.scan();
  await settle();
  assert.equal(video.playCount,1);
  assert.equal(f.slides[1].video,undefined);
});

test('pause control resumes despite focus/hover on itself, then retains an explicit user pause',async()=>{
  const f=fixture({slides:[{komiHeroVideo:videoUrl},{}]});
  f.root.KomiHeroArt.scan(); await settle();
  const video=f.videos[0];
  f.slider.hover=true; f.document.activeElement=f.button; f.slider.emit('pointerenter');
  assert.equal(video.paused,true);
  assert.equal(f.attributes.get('aria-pressed'),'true');
  assert.equal(f.attributes.get('aria-label'),'Продолжить слайдер');
  f.click(); await settle();
  assert.equal(f.root.KomiHeroArt.isPaused(f.slider),false);
  assert.equal(video.paused,false);
  assert.equal(f.attributes.get('aria-pressed'),'false');
  assert.equal(f.pauseIcon.hidden,false); assert.equal(f.playIcon.hidden,true);
  f.click();
  assert.equal(video.paused,true);
  f.slider.hover=false; f.document.activeElement=null; f.slider.emit('pointerleave');
  assert.equal(f.root.KomiHeroArt.isPaused(f.slider),true);
  assert.equal(f.slider.dataset.komiHeroPaused,'true');
});

test('slide changes, hidden tab, offscreen hero and route removal stop playback',async()=>{
  const f=fixture({slides:[{komiHeroVideo:videoUrl},{komiHeroVideo:'https://media.example/next.webm'}]});
  f.root.KomiHeroArt.scan(); await settle();
  const first=f.videos[0];
  f.slides[0].classList.remove('active');f.slides[1].classList.add('active');
  f.root.KomiHeroArt.selectedSlide();await settle();
  const second=f.videos[1];
  assert.equal(first.paused,true);assert.equal(second.paused,false);
  f.document.hidden=true;f.document.emit('visibilitychange');
  assert.equal(second.paused,true);
  f.document.hidden=false;f.document.emit('visibilitychange');await settle();
  assert.equal(second.paused,false);
  f.intersect(false);
  assert.equal(second.paused,true);assert.equal(f.slider.dataset.komiHeroVisible,'false');
  f.root.KomiHeroArt.scan();await settle();assert.equal(second.paused,true);
  f.intersect(true);await settle();assert.equal(second.paused,false);
  f.detach();
  assert.equal(second.paused,true);assert.equal(second.src,'');
  assert.equal(f.observers[0].targets.size,0);
});

test('live reduced-motion and data-saving changes pause media and permit later resume',async()=>{
  const f=fixture({slides:[{komiHeroVideo:videoUrl}]});
  f.root.KomiHeroArt.scan();await settle();
  const video=f.videos[0];
  f.preference(f.reduced,true);
  assert.equal(video.paused,true);assert.equal(f.root.KomiHeroArt.isPaused(f.slider),true);
  assert.equal(f.button.disabled,true);
  f.preference(f.reduced,false);await settle();assert.equal(video.paused,false);
  f.connection.saveData=true;f.connection.emit('change');assert.equal(video.paused,true);
  f.connection.saveData=false;f.connection.emit('change');await settle();assert.equal(video.paused,false);
  f.connection.effectiveType='2g';f.connection.emit('change');assert.equal(video.paused,true);
});

test('watch dialog pauses the still-mounted hero immediately and closing respects existing pause preferences',async()=>{
  const f=fixture({slides:[{komiHeroVideo:videoUrl},{}]});
  f.root.KomiHeroArt.scan();await settle();
  const video=f.videos[0];
  assert.equal(video.paused,false);
  assert.equal(f.slider.dataset.komiHeroPaused,'false');
  f.watch(true);
  assert.equal(f.slider.isConnected,true);
  assert.equal(f.slider.dataset.komiHeroVisible,'true');
  assert.equal(video.paused,true,'The modal observer must stop media without waiting for a scan or timer tick');
  assert.equal(f.slider.dataset.komiHeroPaused,'true');
  assert.equal(f.root.KomiHeroArt.isPaused(f.slider),true);
  f.watch(false);await settle();
  assert.equal(video.paused,false);
  assert.equal(f.root.KomiHeroArt.isPaused(f.slider),false);
  f.click();
  assert.equal(video.paused,true);
  const attempts=video.playCount;
  f.watch(true);f.watch(false);await settle();
  assert.equal(video.paused,true,'Closing the player must preserve an explicit hero pause');
  assert.equal(f.root.KomiHeroArt.isPaused(f.slider),true);
  assert.equal(video.playCount,attempts);
  f.click();await settle();
  assert.equal(video.paused,false);
  f.watch(true);f.preference(f.reduced,true);f.watch(false);await settle();
  assert.equal(video.paused,true,'Closing the player must respect reduced motion');
  assert.equal(f.root.KomiHeroArt.isPaused(f.slider),true);
});

test('unsupported video URLs are ignored and rejected playback does not retry on every scan',async()=>{
  const invalid=fixture({slides:[{komiHeroVideo:'https://media.example/not-a-video.jpg'}]});
  invalid.root.KomiHeroArt.scan();await settle();assert.equal(invalid.videos.length,0);
  const blocked=fixture({slides:[{komiHeroVideo:videoUrl}],playMode:'reject'});
  blocked.root.KomiHeroArt.scan();await settle();
  for(let i=0;i<5;i++) blocked.root.KomiHeroArt.scan();
  await settle();
  assert.equal(blocked.videos[0].playCount,1);
  assert.equal(blocked.videos[0].classList.contains('is-playing'),false);
  assert.equal(blocked.slides[0].img.src,'https://images.example/portrait.jpg');
});

test('an old pending play result cannot pause a more recent resumed play',async()=>{
  const f=fixture({slides:[{komiHeroVideo:videoUrl}],playMode:'pending'});
  f.root.KomiHeroArt.scan();await settle();
  const video=f.videos[0];
  assert.equal(video.playCount,1);
  f.document.hidden=true;f.document.emit('visibilitychange');
  f.document.hidden=false;f.document.emit('visibilitychange');
  assert.equal(video.playCount,2);
  video.playResolvers[0]();await settle();
  assert.equal(video.paused,false);
  video.playResolvers[1]();await settle();assert.equal(video.paused,false);
});

test('explicit banner wins without downloading larger screenshot or external alternatives',async()=>{
  const banner='https://images.example/custom.jpg',still='https://images.example/frame.jpg';
  const external='https://s4.anilist.co/file/anilistcdn/media/anime/banner/external.jpg';
  const f=fixture({slides:[{komiHeroBanner:banner,komiHeroStill:still}],
    imageSizes:{[banner]:[1200,675],[still]:[1920,1080],[external]:[2560,900]},
    media:[{idMal:52991,bannerImage:external,isAdult:false}]});
  f.root.KomiHeroArt.scan();await settle();
  assert.equal(f.slides[0].img.src,banner);
  assert.deepEqual(f.imageRequests,[banner]);
  assert.equal(f.apiRequests.length,0);
});

test('an unusable custom banner falls back to screenshot before external artwork',async()=>{
  const banner='https://images.example/missing.jpg',still='https://images.example/frame.jpg';
  const f=fixture({slides:[{komiHeroBanner:banner,komiHeroStill:still}],imageSizes:{[still]:[1920,1080]}});
  f.root.KomiHeroArt.scan();await settle();
  assert.equal(f.slides[0].img.src,still);
  assert.deepEqual(f.imageRequests,[banner,still]);assert.equal(f.apiRequests.length,0);
});

test('late admin metadata replaces an already-wide first slide and changing video URL replaces playback',async()=>{
  let resolveMetadata;
  const banner='https://images.example/custom.jpg';
  const external='https://s4.anilist.co/file/anilistcdn/media/anime/banner/external.jpg';
  const f=fixture({slides:[{}],imageSizes:{[banner]:[1200,675],[external]:[1920,1080]},
    media:[{idMal:52991,bannerImage:external,isAdult:false}],metadata:()=>new Promise(resolve=>{resolveMetadata=resolve;})});
  f.root.KomiHeroArt.scan();await settle();
  assert.equal(f.slides[0].img.src,external);
  assert.equal(f.slides[0].classList.contains('komi-hd-wide'),true);
  resolveMetadata({banner,video:videoUrl,still:''});await settle();
  assert.equal(f.slides[0].img.src,banner);
  assert.equal(f.videos[0].src,videoUrl);
  f.slides[0].dataset.komiHeroVideo='https://media.example/replacement.webm';
  f.root.KomiHeroArt.syncVideos();await settle();
  assert.equal(f.videos[0].paused,true);assert.equal(f.videos[0].src,'');
  assert.equal(f.videos[1].src,'https://media.example/replacement.webm');
});

test('pointer updates are coalesced into one animation frame and reduced motion clears parallax',async()=>{
  const f=fixture({slides:[{},{}]});
  for(let i=0;i<40;i++) f.document.emit('pointermove',{target:f.slider,clientX:i*10,clientY:100});
  assert.equal(f.frames.size,1);
  f.flushFrames();
  assert.equal(parseFloat(f.slider.properties.get('--komi-hero-x')),1.75);
  f.document.emit('pointermove',{target:f.slider,clientX:900,clientY:100});
  assert.equal(f.frames.size,1);
  f.preference(f.reduced,true);
  assert.equal(f.frames.size,0);assert.equal(f.slider.properties.has('--komi-hero-x'),false);
  f.document.emit('pointermove',{target:f.slider,clientX:900,clientY:100});
  assert.equal(f.frames.size,0);
});


test('metadata invalidation ignores a stale in-flight response after an admin edit',async()=>{
  const resolvers=[];
  const oldBanner='https://images.example/old.jpg',newBanner='https://images.example/new.jpg';
  const f=fixture({imageSizes:{[oldBanner]:[1920,1080],[newBanner]:[1920,1080]},metadata:()=>new Promise(resolve=>resolvers.push(resolve))});
  f.root.KomiHeroArt.scan();await settle();
  assert.equal(resolvers.length,1);
  f.root.KomiHeroArt.invalidateMetadata('52991');await settle();
  assert.equal(resolvers.length,2);
  resolvers[1]({banner:newBanner,video:'',still:''});await settle();
  assert.equal(f.slides[0].img.src,newBanner);
  resolvers[0]({banner:oldBanner,video:'',still:''});await settle();
  assert.equal(f.slides[0].img.src,newBanner);
});

test('media decode failure keeps the image and prevents automatic retry loops',async()=>{
  const f=fixture({slides:[{komiHeroVideo:videoUrl}]});
  f.root.KomiHeroArt.scan();await settle();
  const video=f.videos[0];video.emit('error');
  assert.equal(video.paused,true);assert.equal(video.classList.contains('is-playing'),false);
  for(let i=0;i<5;i++) f.root.KomiHeroArt.scan();
  await settle();
  assert.equal(video.playCount,1);assert.equal(f.slides[0].img.src,'https://images.example/portrait.jpg');
});
