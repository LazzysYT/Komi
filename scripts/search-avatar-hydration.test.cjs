'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const app=fs.readFileSync(path.join(root,'app-main.js'),'utf8');
const css=fs.readFileSync(path.join(root,'komi-media-hub.css'),'utf8');
const bundle=fs.readFileSync(path.join(root,'komi.bundle.css'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');

test('search has one visible keyboard focus ring on wrapper, not a nested input pill',()=>{
  assert.match(css,/\.komi-media-hub \.komi-hub-overlay \.search-bar #searchInput:focus-visible\s*\{\s*outline: none !important;/);
  assert.match(css,/\.komi-hub-overlay \.search-bar:focus-within\s*\{\s*border-color:/);
  assert.match(css,/\.komi-media-hub \.komi-hub-overlay #searchDropdown\.active\s*\{/);
  assert.ok(bundle.includes(css.trim()),'The live CSS bundle must contain search corrections');
  assert.match(html,/href="\/komi\.production\.css\?v=\d+(?:[a-z])?(?:-[a-z0-9-]+)?"/);
});

test('verified avatar cache only returns the same account URL and never persists secrets',()=>{
  const first=app.indexOf('let komiSessionResolved = false;');
  const last=app.indexOf('let userProfiles =',first);
  assert.ok(first>0 && last>first,'avatar helpers must run before profile initialization');
  const store=new Map();
  const localStorage={
    getItem:key=>store.get(key)??null,
    setItem:(key,value)=>store.set(key,String(value)),
    removeItem:key=>store.delete(key)
  };
  const ctx=vm.createContext({URL,localStorage});
  vm.runInContext(app.slice(first,last),ctx);
  const uidA='c2b2a121-0fe7-471b-b031-671d8777690d';
  const uidB='c2b2a121-0fe7-471b-b031-671d8777690e';
  ctx.komiCacheVerifiedAvatar(uidA,'https://cdn.example.org/a.gif');
  assert.equal(ctx.komiReadCachedAvatar(uidA),'https://cdn.example.org/a.gif');
  assert.equal(ctx.komiReadCachedAvatar(uidB),'','Other account must not inherit avatar');
  ctx.komiCacheVerifiedAvatar(uidA,'javascript:alert(1)');
  assert.equal(ctx.komiReadCachedAvatar(uidA),'','Unsafe URL must not persist');
  assert.equal([...store.keys()].every(k=>k.startsWith('komi.sidebar.avatar.v1:')),true);
});

test('avatar redraw is stable and rejects asynchronous images from prior accounts',()=>{
  assert.match(app,/existing\?\.dataset\.komiAvatarSrc !== avatar/);
  assert.match(app,/sidebarAvatarIcon\.dataset\.komiPendingAvatar !== avatar/);
  assert.match(app,/sidebarAvatarIcon\.dataset\.komiAvatarOwner !== owner/);
  assert.match(app,/applySavedKomiProfile\(username, savedProfile\);\s*renderHeaderUser\(\);/);
});

test('home re-render preserves already loaded hero only for the same owner and slide',()=>{
  assert.match(app,/const previousOwner = previousHero\?\.dataset\.komiOwner/);
  assert.match(app,/previousOwner === heroOwner/);
  assert.match(app,/previousRender\.signature === signature/);
  assert.match(app,/homeMarkup\.replace\(heroMarkup, \(\) => previousRender\.markup\)/);
  assert.doesNotMatch(app,/nextHero\.replaceWith\(previousHero\)/);
  assert.match(css,/\.komi-media-hub \.komi-home-hero \.hero-slide\.active\s*\{\s*animation: none !important;/);
});
