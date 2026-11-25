'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname,'..','cinema-layout-v3.js'),'utf8');
const section = (start,end) => {
  const from=source.indexOf(start), to=source.indexOf(end,from);
  assert.ok(from>=0 && to>from,'Missing renderer section '+start);
  return source.slice(from,to);
};

// A small eventful DOM model tests image failures without network or a browser
// dependency. The companion browser fixture verifies the same transitions in DOM.
class Element {
  constructor(tag) {
    this.tagName=tag.toUpperCase(); this.className=''; this.dataset={};
    this.attributes={}; this.children=[]; this.listeners={}; this._text='';
    this.classList={
      contains:name=>this.className.split(/\s+/).includes(name),
      toggle:(name,force)=>{
        const on=force ?? !this.classList.contains(name);
        this.className=this.className.split(/\s+/).filter(value=>value && value!==name).concat(on?[name]:[]).join(' ');
        return on;
      }
    };
  }
  get textContent(){return this._text+this.children.map(child=>child.textContent).join('');}
  set textContent(value){this.replaceChildren();this._text=String(value);}
  get isConnected(){return !!this.connected || !!this.parentNode?.isConnected;}
  append(...nodes){for(const node of nodes){node.remove();node.parentNode=this;this.children.push(node);}}
  prepend(node){node.remove();node.parentNode=this;this.children.unshift(node);}
  remove(){if(this.parentNode){this.parentNode.children=this.parentNode.children.filter(child=>child!==this);this.parentNode=null;}}
  replaceChildren(...nodes){for(const child of this.children)child.parentNode=null;this.children=[];this._text='';this.append(...nodes);}
  setAttribute(name,value){this.attributes[name]=String(value);}
  getAttribute(name){return this.attributes[name] ?? null;}
  addEventListener(name,callback){(this.listeners[name] ||= []).push(callback);}
  emit(name){for(const callback of this.listeners[name] || [])callback({type:name});}
  matches(selector){
    if(selector.startsWith('.'))return this.classList.contains(selector.slice(1));
    const attribute=selector.match(/^\[([^=]+)="([^"]*)"\]$/);
    if(attribute)return this.getAttribute(attribute[1])===attribute[2];
    return this.tagName===selector.toUpperCase();
  }
  querySelectorAll(selector){
    const found=[];
    for(const child of this.children){if(child.matches(selector))found.push(child);found.push(...child.querySelectorAll(selector));}
    return found;
  }
  querySelector(selector){
    const space=selector.indexOf(' ');
    if(space>=0){
      for(const parent of this.querySelectorAll(selector.slice(0,space))){const child=parent.querySelector(selector.slice(space+1));if(child)return child;}
      return null;
    }
    return this.querySelectorAll(selector)[0] || null;
  }
  closest(selector){return this.matches(selector)?this:this.parentNode?.closest(selector) || null;}
  getBoundingClientRect(){return {bottom:0};}
}

function fixture() {
  const document={createElement:tag=>new Element(tag)};
  const captured=new Map([['5114:1:6','data:image/jpeg;base64,captured']]);
  const renderer=new Function('document','URL','location','capturedFrames','frameKey','measuredDurations','hydrateEpisodeFrames',
    'let episodeListPreference = true;'+section('  function indexEpisodePreviews(','  function captureCurrentFrame(')+
    section('  function episodePreview(','  function setStatus(')+
    'return {indexEpisodePreviews,setListMode,paintEpisodeImage};')(
      document,URL,{origin:'https://komianime.online'},captured,(ctx,index)=>ctx.animeId+':'+ctx.season+':'+index,new Map(),()=>{});
  const grid=new Element('div');grid.connected=true;
  const clicked=[];
  const buttons=Array.from({length:68},(_,index)=>{
    const button=new Element('button');
    button.className='komi-episode-number'+(index===0?' active':'');
    button.dataset.episodeNumber=String(index+1);button.textContent=String(index+1);
    button.addEventListener('click',()=>clicked.push(index));grid.append(button);
    return button;
  });
  const episodeMeta=Array.from({length:68},(_,index)=>index>=64?{supplementalLabel:'Дополнительный выпуск · STEPonee'}:{});
  episodeMeta[0].preview='https://images.test/frame.png';
  episodeMeta[1].preview='https://images.test/missing.png';
  episodeMeta[2].preview=episodeMeta[3].preview='https://images.test/repeated.png';
  episodeMeta[4].preview='https://images.test/poster.png';
  episodeMeta[5].preview='javascript:invalid';
  const context={animeId:'5114',season:1,episodeMeta,grid,viewButtons:[],sidebar:{inert:false},
    episodeFallbacks:['https://images.test/poster.png','https://images.test/banner.png'],failedPreviews:new Set()};
  context.uniquePreviews=renderer.indexEpisodePreviews(context);
  renderer.setListMode(context,true);
  return {renderer,context,buttons,clicked};
}

test('episode images become frames only after load, with no misleading title poster in the list',()=>{
  const {buttons}=fixture();
  for (const i of [0,6]) buttons[i].querySelector('img').emit('load');
  const kinds=buttons.slice(0,7).map(button=>button.querySelector('.komi-episode-thumb').dataset.previewKind);
  assert.deepEqual(kinds,['frame','unavailable','unavailable','unavailable','unavailable','unavailable','frame']);
  assert.equal(buttons[0].querySelector('.komi-episode-thumb-kind').textContent,'Кадр серии');
  assert.match(buttons[0].getAttribute('aria-label'),/Сейчас смотришь.*Кадр серии/);
  for(const index of [2,3,4,5]) assert.equal(buttons[index].querySelector('img'),null);
  assert.equal(buttons[6].querySelector('img').src,'data:image/jpeg;base64,captured');
});

test('failed episode frame retains a visible number without recycling title artwork',()=>{
  const {context,buttons}=fixture();
  const row=buttons[1], frame=row.querySelector('.komi-episode-thumb'), image=frame.querySelector('img');
  image.emit('error');
  assert.equal(context.failedPreviews.has('https://images.test/missing.png'),true);
  assert.equal(frame.querySelector('img'),null);
  assert.equal(frame.dataset.previewKind,'unavailable');
  assert.equal(frame.querySelector('.komi-episode-thumb-kind').textContent,'Нет изображения');
  assert.equal(frame.querySelector('.komi-episode-thumb-badge').textContent,'2');
  assert.match(row.getAttribute('aria-label'),/Нет изображения/);
});

test('late load or error from a retired image cannot overwrite a replacement',()=>{
  const {renderer,buttons}=fixture();
  const frame=buttons[1].querySelector('.komi-episode-thumb'), retired=frame.querySelector('img');
  renderer.paintEpisodeImage(frame,[{url:'data:image/jpeg;base64,new-frame',kind:'frame'}]);
  retired.emit('error');retired.emit('load');
  assert.equal(frame.dataset.previewKind,'unavailable');
  frame.querySelector('img').emit('load');
  assert.equal(frame.dataset.previewKind,'frame');
  assert.equal(frame.querySelector('img').src,'data:image/jpeg;base64,new-frame');
});

test('supplementary labels preserve all 68 buttons, original click indices and display numbers across view changes',()=>{
  const {renderer,context,buttons,clicked}=fixture();
  assert.equal(buttons[63].querySelector('.komi-episode-supplemental'),null);
  assert.match(buttons[64].querySelector('.komi-list-label').textContent,/Доп\. выпуск 65/);
  assert.match(buttons[67].getAttribute('aria-label'),/Дополнительный выпуск 68.*STEPonee/);
  buttons[64].emit('click');assert.deepEqual(clicked,[64]);
  buttons[0].querySelector('img').emit('error');
  renderer.setListMode(context,false);
  assert.equal(buttons[64].textContent,'65');
  renderer.setListMode(context,true);
  assert.equal(buttons[0].querySelector('.komi-episode-thumb-kind').textContent,'Нет изображения');
  assert.deepEqual(context.grid.querySelectorAll('.komi-episode-number'),buttons);
  assert.equal(buttons[67].dataset.episodeNumber,'68');
  assert.equal(context.grid.querySelectorAll('.komi-episode-number').length,68);
});


test('public data resolves MAL to AniList, rejects duplicate or untrusted stills, and deduplicates requests',async()=>{
  const calls=[];
  const root={fetch:async (url,options)=>{
    calls.push(url);
    assert.equal(options.credentials,'omit');
    assert.equal(options.referrerPolicy,'no-referrer');
    const data = url.includes('/map/') ? {anilist_id:171018} : [
      {number:1,still:'https://image.tmdb.org/t/p/w500/episode-one.jpg'},
      {number:2,still:'https://other.example/title.jpg'},
      {number:3,still:'https://image.tmdb.org/t/p/w500/reused.jpg'},
      {number:4,still:'https://image.tmdb.org/t/p/w500/reused.jpg'},
      {number:5,still:'https://image.tmdb.org/t/p/w500/a.jpg'},
      {number:5,still:'https://image.tmdb.org/t/p/w500/b.jpg'},
      {number:6,still:'https://image.tmdb.org/t/p/w500/./other.jpg'}
    ];
    return {ok:true,status:200,json:async()=>data};
  }};
  const get=new Function('root',section('  const episodeArtworkBase','  function hydrateEpisodeFrames')+
    'return getPublicEpisodeFrames;')(root);
  const first=get(57334);
  assert.strictEqual(first,get(57334));
  const frames=await first;
  assert.deepEqual([...frames],[[1,'https://image.tmdb.org/t/p/w300/episode-one.jpg']]);
  assert.equal(calls.length,2);
  assert.match(calls[0],/map\/57\/57334\.json$/);
  assert.match(calls[1],/data\/171\/171018\.json$/);
});

test('public data backfills only uniquely numbered season-one rows of the current watch view',async()=>{
  const want = new Map([[1,'https://image.tmdb.org/t/p/w300/one.jpg'],[2,'two'],[3,'three'],[4,'four']]);
  let requested=0, isCurrent=true;
  const load=new Function('root','getPublicEpisodeFrames','actualPreview','currentContext','uniquePreview','capturedFrames','frameKey','paintWatchEpisodeFrame',
    section('  function hydrateEpisodeFrames','  let current')+'return hydrateEpisodeFrames;')(
    {fetch(){}},()=>{requested++;return Promise.resolve(want);},()=>'',()=>isCurrent,()=>'',new Map(),()=>'',()=>{});
  const make=season=>({season,episodeArtworkId:5114,externalPreviews:[],uniquePreviews:[],episodeFallbacks:[],
    abort:new AbortController(),grid:{querySelectorAll:()=>[]},
    episodeMeta:[{number:1},{number:2},{number:2},{number:3,supplementalLabel:'extra'},{number:4}]});
  const later=make(2);load(later);assert.equal(requested,0);
  const obsolete=make(1);load(obsolete);isCurrent=false;await Promise.resolve();assert.deepEqual(obsolete.externalPreviews,[]);
  const current=make(1);isCurrent=true;load(current);await Promise.resolve();
  assert.equal(current.externalPreviews[0],want.get(1));
  assert.equal(current.externalPreviews[4],want.get(4));
  assert.deepEqual(Object.keys(current.externalPreviews),['0','4']);
});


test('Fullmetal Alchemist example carries exactly 64 distinct episode still links, never the supplemental releases',()=>{
  const data=JSON.parse(fs.readFileSync(path.join(__dirname,'..','episode-stills','5114.json'),'utf8'));
  assert.deepEqual(data.map(x=>x.number),Array.from({length:64},(_,i)=>i+1));
  assert.equal(new Set(data.map(x=>x.still)).size,64);
});
