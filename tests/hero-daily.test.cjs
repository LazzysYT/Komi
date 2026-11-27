'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {lead,lineup,artwork,first,prepare}=require('../komi-home-boot.js');
const instant=s=>Date.parse(s);
test('daily lead changes at Kyiv midnight, not on refreshes during the same day',()=>{
 assert.equal(lead(instant('2026-11-24T22:00:00Z')),'61316');
 assert.equal(lead(instant('2026-11-25T21:59:59Z')),'61316');
 assert.equal(lead(instant('2026-11-25T22:00:00Z')),'61469');
 assert.equal(new Set(Array.from({length:5},(_,i)=>lead(instant('2026-11-25T12:00:00Z')+i*86400000))).size,5);
});
test('curated art stays paired with the same ID during catalogue hydration',()=>{
 const seed=['61316','61469','61967','60636','59978'].map(id=>({id,title:'seed '+id,desc:'Ready'}));
 const normalized=lineup(seed.map(item=>({id:item.id,title:'live '+item.id})).reverse(),seed);
 assert.equal(normalized[0].id,first);
 assert.equal(normalized.length,5);
 assert.ok(normalized.every(item=>item.title==='live '+item.id&&item.desc==='Ready'&&
  new RegExp('^/assets/hero/daily/'+item.id+'-[A-Za-z0-9]+\\.webp$').test(artwork(item.id))));
 assert.ok(normalized.every(item=>fs.existsSync(path.join(__dirname,'..',artwork(item.id)))));
 assert.equal(artwork('brand-loop'),'');
});
test('placeholder never becomes transition-ready and an actual image is decoded once',async()=>{
 const image={complete:true,naturalWidth:300,currentSrc:'/anime-artwork.svg',dataset:{},getAttribute(){return this.currentSrc;},addEventListener(){},removeEventListener(){}};
 const slide={querySelector:()=>image};
 assert.equal(await prepare(slide),false);
 image.currentSrc=artwork(first);
 let count=0;
 image.decode=async()=>{count++;};
 assert.equal(await prepare(slide),true);
 assert.equal(await prepare(slide),true);
 assert.equal(count,1);
});

// A small DOM fixture keeps parse, image load and decode independently pending.
// It exercises the head script without loading an application or browser.
class BootNode {
 constructor(tag='div',attrs={}) {
  this.tag=tag;this.attrs={...attrs};this.children=[];
  const attribute=key=>'data-'+key.replace(/[A-Z]/g,c=>'-'+c.toLowerCase());
  this.dataset=new Proxy({}, {get:(_,key)=>this.attrs[attribute(key)],set:(_,key,value)=>{this.attrs[attribute(key)]=String(value);return true;}});
  this.classList={
   contains:name=>this.className.split(/\s+/).includes(name),
   add:(...names)=>{this.className=[...new Set([...this.className.split(/\s+/).filter(Boolean),...names])].join(' ');},
   remove:(...names)=>{this.className=this.className.split(/\s+/).filter(name=>!names.includes(name)).join(' ');},
   toggle:(name,on)=>{if(on)this.classList.add(name);else this.classList.remove(name);}
  };
 }
 get className(){return this.attrs.class||'';}set className(value){this.attrs.class=value;}
 get attributes(){return Object.entries(this.attrs).map(([name,value])=>({name,value}));}
 get firstElementChild(){return this.children[0]||null;}
 get disabled(){return 'disabled' in this.attrs;}set disabled(on){this.toggleAttribute('disabled',on);}
 get src(){return this.attrs.src||'';}set src(value){this.attrs.src=value;}
 getAttribute(name){return this.attrs[name]??null;}
 setAttribute(name,value){this.attrs[name]=String(value);}
 removeAttribute(name){delete this.attrs[name];}
 toggleAttribute(name,on){if(on)this.attrs[name]='';else delete this.attrs[name];}
 matches(selector) {
  const tag=selector.match(/^[\w-]+/)?.[0];
  if(tag&&this.tag!==tag)return false;
  if([...selector.matchAll(/\.([\w-]+)/g)].some(([,name])=>!this.classList.contains(name)))return false;
  return [...selector.matchAll(/\[([\w-]+)(?:="([^"]*)")?\]/g)].every(([,name,value])=>
   name in this.attrs&&(value===undefined||this.attrs[name]===value));
 }
 querySelectorAll(selector){return this.children.flatMap(child=>[...(child.matches(selector)?[child]:[]),...child.querySelectorAll(selector)]);}
 querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
 append(...nodes){for(const node of nodes){node.remove();this.children.push(node);node.parentNode=this;}}
 prepend(node){node.remove();this.children.unshift(node);node.parentNode=this;}
 remove(){if(this.parentNode){this.parentNode.children=this.parentNode.children.filter(node=>node!==this);this.parentNode=null;}}
 replaceChildren(...nodes){for(const child of [...this.children])child.remove();this.append(...nodes);}
 replaceWith(node){const parent=this.parentNode,index=parent.children.indexOf(this);node.remove();parent.children[index]=node;node.parentNode=parent;this.parentNode=null;}
 cloneNode(deep){const clone=new BootNode(this.tag,this.attrs);clone.textContent=this.textContent;if(deep)clone.append(...this.children.map(child=>child.cloneNode(true)));return clone;}
}
function bootFixture({date='2026-11-25T12:00:00Z',pathname='/',hash='',search='',withImage=true}={}) {
 const timestamp=Date.parse(date),timers=new Map(),events=new Map(),windowEvents=new Map(),frames=[];
 const register=(map,name,fn)=>{if(!map.has(name))map.set(name,[]);map.get(name).push(fn);};
 const emit=(map,name,event)=>{for(const fn of map.get(name)||[])fn(event);};
 const main=new BootNode('main'),head=new BootNode('head'),html=new BootNode('html');
 const template=new BootNode('template',{class:'komi-boot-real-hero'}),hero=new BootNode('section',{class:'komi-home-hero'});
 const wrapper=new BootNode('div',{class:'hero-slides-wrapper'});
 const ids=['61316','61469','61967','60636','59978'];
 for(const [index,id] of ids.entries()) {
  const slide=new BootNode('article',{class:'hero-slide komi-hd-poster'+(index===0?' active':''),'data-komi-anime-id':id});
  const title=new BootNode('h1');title.textContent='Seed '+id;
  slide.append(new BootNode('img',{class:'komi-hub-hero-art',src:'https://old.example/'+id+'.jpg','data-poster-direct':'https://cover.example/'+id+'.jpg'}),
   title,new BootNode('a',{class:'komi-hub-play',href:'/anime/'+id+'#player'}),new BootNode('button',{class:'komi-hub-list'}));
  wrapper.append(slide);
 }
 wrapper.append(new BootNode('article',{class:'hero-slide','data-komi-promo':'brand-loop'}));
 hero.append(wrapper,new BootNode('button',{class:'hero-dot'}));
 template.content={firstElementChild:hero};
 const shell=new BootNode('div',{class:'komi-boot-shell'});shell.append(template);
 main.append(shell,new BootNode('section',{class:'komi-seo-fallback'}));
 let decodeResolve,decodeReject;
 const decoding=new Promise((resolve,reject)=>{decodeResolve=resolve;decodeReject=reject;});
 const images=[];
 class Image extends BootNode {
  constructor(){super('img');this.complete=false;this.naturalWidth=0;images.push(this);}
  decode(){this.decodeCalls=(this.decodeCalls||0)+1;return decoding;}
 }
 const observers=[];
 const document={head,documentElement:html,readyState:'loading',
  createElement:tag=>new BootNode(tag),getElementById:id=>id==='mainContainer'?main:null,
  querySelector:selector=>head.querySelector(selector),
  addEventListener:(name,fn)=>register(events,name,fn),
  removeEventListener:(name,fn)=>events.set(name,(events.get(name)||[]).filter(item=>item!==fn))};
 const scope={document,location:{pathname,hash,search},Image:withImage?Image:undefined,URLSearchParams,
  Date:class extends Date{constructor(...args){super(...(args.length?args:[timestamp]));}static now(){return timestamp;}},
  MutationObserver:class{constructor(fn){this.callback=fn;observers.push(this);}observe(){}disconnect(){this.disconnected=true;}},
  addEventListener:(name,fn)=>register(windowEvents,name,fn),
  requestAnimationFrame:fn=>{frames.push(fn);return frames.length;},
  setTimeout:(fn,delay)=>{const key={delay};timers.set(key,fn);return key;},clearTimeout:key=>timers.delete(key)};
 scope.window=scope;
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../komi-home-boot.js'),'utf8'),scope);
 return {scope,document,main,head,html,images,template,observers,
  interactive(){document.readyState='interactive';emit(events,'readystatechange');},
  loaded(){const image=images[0];image.complete=true;image.naturalWidth=1280;image.naturalHeight=720;image.currentSrc=image.src;image.onload();},
  decodeResolve,decodeReject,
  paintFrame(){for(const fn of frames.splice(0))fn();},
  fontLoaded(){const font=new BootNode('link');font.id='komi-font-css';font.media='print';emit(events,'load',{target:font});return font;},
  stylesheetLoaded(link){emit(events,'load',{target:link});},
  expire(delay){for(const [key,fn] of [...timers])if(key.delay===delay)fn();},
  navigate(next){Object.assign(scope.location,next);emit(windowEvents,'hashchange');}
 };
}
test('daily hero paints before application scripts only after parsing and image decoding',async()=>{
 const f=bootFixture(),daily=f.scope.KomiHeroDaily,initial=daily.firstImage;
 assert.equal(initial.src,artwork('61316'));
 assert.equal(f.head.children.find(link=>link.rel==='preload')?.href,initial.src);
 assert.equal(initial.image.fetchPriority,'high');
 assert.equal(f.main.querySelector('.komi-home-discovery'),null);
 f.interactive();f.loaded();
 assert.equal(initial.ready,false,'A load event alone cannot reveal an undecoded frame');
 assert.equal(daily.preview,undefined);
 f.decodeResolve();assert.equal(await initial.promise,true);
 assert.equal(initial.ready,true);
 assert.equal(daily.preview.querySelector('.komi-hub-hero-art'),initial.image);
 assert.equal(initial.image.decodeCalls,1);
 assert.equal(f.main.children.length,1,'SEO and inert template do not create duplicate visible heroes');
 assert.equal(f.main.firstElementChild.dataset.komiBootPreview,'');
 assert.ok(!f.html.classList.contains('komi-home-booting'));
 assert.ok(daily.preview.querySelectorAll('button').every(button=>button.disabled));
 assert.equal(daily.preview.querySelector('.komi-hub-play').getAttribute('href'),'/anime/61316#player');
 assert.equal(f.main.querySelector('.komi-home-catalog-link').getAttribute('href'),'/catalog');
});
test('a decoded image waits for the parser before replacing main',async()=>{
 const f=bootFixture(),daily=f.scope.KomiHeroDaily;
 f.loaded();f.decodeResolve();await daily.firstImage.promise;
 assert.equal(daily.preview,undefined);
 assert.ok(f.main.querySelector('template.komi-boot-real-hero'));
 f.interactive();
 assert.equal(daily.preview.querySelector('.komi-hub-hero-art'),daily.firstImage.image);
});
test('every daily lead keeps its own title, artwork and watch route in early markup',async()=>{
 const ids=['61316','61469','61967','60636','59978'];
 for(let offset=0;offset<5;offset++) {
  const f=bootFixture({date:new Date(Date.parse('2026-11-25T12:00:00Z')+offset*86400000).toISOString()});
  const daily=f.scope.KomiHeroDaily;
  f.interactive();f.loaded();f.decodeResolve();await daily.firstImage.promise;
  const slides=daily.preview.querySelectorAll('.hero-slide');
  assert.deepEqual(slides.slice(0,5).map(slide=>slide.dataset.komiAnimeId),ids.slice(offset).concat(ids.slice(0,offset)));
  assert.equal(slides.length,6);
  assert.equal(slides[5].dataset.komiPromo,'brand-loop');
  for(const [index,slide] of slides.slice(0,5).entries()) {
   const id=slide.dataset.komiAnimeId,image=slide.querySelector('.komi-hub-hero-art');
   assert.equal(slide.querySelector('h1').textContent,'Seed '+id);
   assert.equal(slide.querySelector('.komi-hub-play').getAttribute('href'),'/anime/'+id+'#player');
   assert.equal(slide.dataset.komiHeroBanner,artwork(id));
   assert.equal(slide.classList.contains('active'),index===0);
   assert.equal(image.src,index===0?artwork(id):'/anime-artwork.svg');
   if(index)assert.equal(image.dataset.komiHeroDeferredSrc,artwork(id));
  }
 }
});
test('failed, undecodable or timed-out daily artwork never replaces the neutral shell',async()=>{
 for(const failure of ['load','decode','timeout']) {
  const f=bootFixture(),daily=f.scope.KomiHeroDaily;
  f.interactive();
  if(failure==='load')f.images[0].onerror();
  else if(failure==='decode'){f.loaded();f.decodeReject(new Error('decode failed'));}
  else f.expire(4200);
  assert.equal(await daily.firstImage.promise,false);
  assert.equal(daily.preview,undefined);
  assert.equal(f.main.querySelector('.komi-home-discovery'),null);
  assert.ok(f.main.querySelector('template.komi-boot-real-hero'));
 }
});
test('a late daily decode cannot overwrite an application render or changed route',async()=>{
 for(const changed of ['application','route']) {
  const f=bootFixture(),daily=f.scope.KomiHeroDaily;
  f.interactive();f.loaded();
  let current;
  if(changed==='application'){current=new BootNode('div',{class:'komi-home-discovery'});f.main.replaceChildren(current);}
  else f.navigate({hash:'#catalog'});
  f.decodeResolve();await daily.firstImage.promise;
  assert.equal(daily.preview,undefined);
  if(current)assert.equal(f.main.firstElementChild,current);
  else assert.ok(f.main.querySelector('template.komi-boot-real-hero'));
 }
});
test('non-home and direct watch routes skip daily preview and profile CSS activates as parsed',()=>{
 for(const route of [{pathname:'/catalog'},{pathname:'/profile'},{pathname:'/anime/61316'},{hash:'#shop'},{search:'?anime=61316'}]) {
  const f=bootFixture(route);
  assert.equal(f.scope.KomiHeroDaily.firstImage,undefined);
  assert.equal(f.images.length,0);
 }
 const f=bootFixture({pathname:'/profile'}),styles=f.observers[0];
 f.head.append(new BootNode('link',{'data-komi-deferred-style':'shop'}));
 styles.callback();assert.ok(!styles.disconnected,'Shop stylesheet alone must not stop watching for profile CSS');
 const profile=new BootNode('link',{'data-komi-deferred-style':'profile'});profile.media='print';
 f.head.append(profile);styles.callback();
 assert.equal(profile.media,'all');
 assert.ok(!styles.disconnected,'Profile stylesheet must not stop watching for cosmetic styles');
 const cosmetics=new BootNode('link',{'data-komi-deferred-style':'cosmetics'});cosmetics.media='print';
 f.head.append(cosmetics);styles.callback();
 assert.equal(cosmetics.media,'all');
 assert.ok(!styles.disconnected,'The new living-profile stylesheet must also be discovered');
 const living=new BootNode('link',{'data-komi-deferred-style':'living'});living.media='print';
 f.head.append(living);styles.callback();
 assert.equal(living.media,'all');
 assert.equal(styles.disconnected,true);
});
test('fonts loaded before the daily preview wait until its second animation frame',async()=>{
 const f=bootFixture(),font=f.fontLoaded();
 assert.equal(font.media,'print');
 f.interactive();f.loaded();f.decodeResolve();await f.scope.KomiHeroDaily.firstImage.promise;
 assert.ok(f.scope.KomiHeroDaily.preview);
 assert.equal(font.media,'print','Image decoding alone must not trigger competing font downloads');
 f.paintFrame();assert.equal(font.media,'print');
 f.paintFrame();assert.equal(font.media,'all');
});
test('fonts loaded after the preview respect the pending paint or activate immediately afterward',async()=>{
 for(const afterPaint of [false,true]) {
  const f=bootFixture();
  f.interactive();f.loaded();f.decodeResolve();await f.scope.KomiHeroDaily.firstImage.promise;
  f.paintFrame();
  if(afterPaint)f.paintFrame();
  const font=f.fontLoaded();
  assert.equal(font.media,afterPaint?'all':'print');
  f.paintFrame();assert.equal(font.media,'all');
 }
});
test('font deadline still releases a successfully decoded hero when animation frames are suspended',async()=>{
 const f=bootFixture(),font=f.fontLoaded();
 f.interactive();f.loaded();f.decodeResolve();await f.scope.KomiHeroDaily.firstImage.promise;
 assert.ok(f.scope.KomiHeroDaily.preview);
 assert.equal(font.media,'print');
 // Background documents may never deliver either requested animation frame.
 f.expire(4200);
 assert.equal(font.media,'all','Font release keeps its own deadline after the image deadline is cleared');
});
test('font activation remains bounded on image failure, decode failure, missing image support or route exit',async()=>{
 for(const failure of ['load','decode','deadline','route']) {
  const f=bootFixture(),font=f.fontLoaded();
  assert.equal(font.media,'print');
  if(failure==='load')f.images[0].onerror();
  else if(failure==='decode'){f.loaded();f.decodeReject(new Error('decode failed'));}
  else if(failure==='deadline')f.expire(4200);
  else f.navigate({hash:'#catalog'});
  if(failure!=='route')await f.scope.KomiHeroDaily.firstImage.promise;
  assert.equal(font.media,'all',failure+' releases font activation without waiting for a successful hero');
 }
 assert.equal(bootFixture({withImage:false}).fontLoaded().media,'all');
 for(const route of [{pathname:'/catalog'},{pathname:'/profile'},{pathname:'/anime/61316'},{hash:'#shop'},{search:'?anime=61316'}])
  assert.equal(bootFixture(route).fontLoaded().media,'all','Other routes keep their normal font activation');
});
test('cosmetics promote for both shop and profile routes and other deferred styles activate on load',()=>{
 for(const route of [{pathname:'/shop'},{pathname:'/profile'},{hash:'#shop'},{hash:'#profile'}]) {
  const f=bootFixture(route),cosmetics=new BootNode('link',{'data-komi-deferred-style':'cosmetics'});
  cosmetics.media='print';f.head.append(cosmetics);f.observers[0].callback();
  assert.equal(cosmetics.media,'all');
 }
 const f=bootFixture();
 for(const kind of ['motion','cosmetics']) {
  const link=new BootNode('link',{'data-komi-deferred-style':kind});link.media='print';
  f.stylesheetLoaded(link);assert.equal(link.media,'all','Non-font styles are not gated by hero paint');
 }
});
