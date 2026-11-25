'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
test('hero loading does not paint the site logo or classify it as real artwork',()=>{
  const css=read('komi-hero-senku.css'),script=read('hero-hd-art.js');
  assert.doesNotMatch(css,/background:\s*[^;{}]*url\("\/anime-artwork\.svg"\)/);
  assert.match(css,/\.komi-hub-hero-art\[src="\/anime-artwork\.svg"\][\s\S]*?visibility:\s*hidden/);
  const start=script.indexOf('function updateLayout(slide, img)');
  const end=script.indexOf('function bindImage',start);
  const classify=vm.runInNewContext(script.slice(start,end)+'\nupdateLayout;');
  const state=new Set(['komi-hd-wide']),slide={classList:{toggle:(name,on)=>on?state.add(name):state.delete(name)}};
  classify(slide,{src:'/anime-artwork.svg',naturalWidth:800,naturalHeight:400});
  assert.ok(state.has('komi-hd-wide'));
  assert.ok(!state.has('komi-art-ready'));
  classify(slide,{currentSrc:'https://test.example/cover.jpg',naturalWidth:450,naturalHeight:675});
  assert.ok(!state.has('komi-hd-wide'));
  assert.ok(state.has('komi-hd-poster'));
  assert.ok(state.has('komi-art-ready'));
});
test('only the first two recommendation posters start on the first viewport notification',()=>{
  let callback;
  const observed=[];
  const env={IntersectionObserver:class{constructor(cb){callback=cb;}observe(node){observed.push(node);}unobserve(){}},document:{}};
  vm.runInNewContext(read('home-discovery.js'),env);
  function img(i){return {isConnected:true,src:'/anime-artwork.svg',dataset:{komiLazySrc:'/poster'+i},matches:s=>s.startsWith('img')}}
  const posters=[img(0),img(1),img(2),img(3)];
  const rail={isConnected:true,matches:s=>s==='.komi-home-rail-pending',querySelector:()=>null,
    classList:{remove(){}},removeAttribute(){},querySelectorAll:()=>posters.filter(node=>node.dataset.komiLazySrc)};
  env.KomiHomeDiscovery.observeViewport({querySelectorAll:()=>[rail]});
  assert.deepEqual(posters.map(x=>x.src),Array(4).fill('/anime-artwork.svg'));
  callback([{target:rail,isIntersecting:true}]);
  assert.deepEqual(posters.map(x=>x.src),['/poster0','/poster1','/anime-artwork.svg','/anime-artwork.svg']);
  assert.deepEqual(observed.slice(1),posters.slice(2));
});
