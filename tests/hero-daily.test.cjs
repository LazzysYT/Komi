'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
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
 assert.ok(normalized.every(item=>item.title==='live '+item.id&&item.desc==='Ready'&&artwork(item.id).startsWith('https://image.tmdb.org/t/p/w1280/')));
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
