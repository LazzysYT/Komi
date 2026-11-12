const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

test('browser SDK URLs use exact reviewed versions, not floating major tags',()=>{
  const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
  const scripts=Array.from(html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/gi),m=>m[1]);
  const sdk=scripts.filter(url=>url.includes('@supabase/supabase-js@'));
  assert.equal(sdk.length,1);
  assert.equal(sdk[0],'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.0');
  assert.ok(!/supabase-js@2(?=[/"?#]|$)/.test(sdk[0]),'Floating @2 releases are disallowed');
  const player=fs.readFileSync(path.join(__dirname,'../player-runtime.js'),'utf8');
  assert.match(player,/hls\.js@1\.6\.19/);
});
