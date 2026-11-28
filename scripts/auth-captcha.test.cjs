'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {makeRunner}=require('../komi-auth-captcha.js');
function fixture({key='',verify=async()=> 'fixture-token'}={}){
 const form={};let visible=true;const busy=[],sent=[];
 const gate=makeRunner({keyFor:()=>key,verify,isVisible:()=>visible,setBusy:(_,flag)=>busy.push(flag)});
 const send=async t=>{sent.push(t);return 'sent';};
 return {form,gate,busy,sent,send,hide(){visible=false;}};
}
test('disabled configuration sends no token and does not challenge',async()=>{
 const m=fixture({verify(){throw Error('must not call');}});
 assert.deepEqual(await m.gate.run(m.form,m.send),{value:'sent'});assert.deepEqual(m.sent,[undefined]);assert.deepEqual(m.busy,[true,false]);
});
test('enabled configuration sends verified token once',async()=>{
 const m=fixture({key:'site-key-fixture'});
 assert.equal((await m.gate.run(m.form,m.send)).value,'sent');assert.deepEqual(m.sent,['fixture-token']);
});
test('missing token or provider failure cannot reach Auth',async()=>{
 for(const verify of [async()=>'',async()=>{throw Error('unavailable');}]){
  const m=fixture({key:'fixture',verify});await assert.rejects(m.gate.run(m.form,m.send));assert.equal(m.sent.length,0);assert.deepEqual(m.busy,[true,false]);
 }
});
test('duplicate submissions are skipped until the first completes',async()=>{
 let release;const m=fixture({key:'fixture',verify:()=>new Promise(r=>{release=r;})});
 const first=m.gate.run(m.form,m.send);assert.deepEqual(await m.gate.run(m.form,m.send),{skipped:true});release('token');await first;assert.equal(m.sent.length,1);
});
test('closing or switching form during challenge never submits credentials',async()=>{
 let release;const m=fixture({key:'fixture',verify:()=>new Promise(r=>{release=r;})});
 const first=m.gate.run(m.form,m.send);m.gate.cancel();m.hide();release('token');assert.deepEqual(await first,{skipped:true});assert.equal(m.sent.length,0);
});
test('server request failure unlocks form and retry uses fresh token',async()=>{
 let n=0;const m=fixture({key:'fixture',verify:async()=> 'token-'+(++n)});
 await assert.rejects(m.gate.run(m.form,async()=>{throw Error('network');}));
 await m.gate.run(m.form,m.send);assert.deepEqual(m.sent,['token-2']);assert.deepEqual(m.busy,[true,false,true,false]);
});
test('CSP admits Turnstile on main site but not on admin security page',()=>{
 const c=require('../vercel.json');
 const h=c.headers.find(x=>x.source==='/(.*)'&&!x.missing).headers.find(x=>x.key==='Content-Security-Policy').value;
 for(const directive of ['script-src ','script-src-elem '])assert.ok(h.split(';').some(s=>s.trim().startsWith(directive)&&s.includes('https://challenges.cloudflare.com')));
 const admin=c.headers.find(x=>x.source==='/admin-security.html').headers.find(x=>x.key==='Content-Security-Policy').value;
 assert.doesNotMatch(admin,/challenges\.cloudflare\.com/);
});

test('public reporting pages remain linked and do not expose internal legal drafts',()=>{
 const fs=require('node:fs'),path=require('node:path'),root=path.join(__dirname,'..');
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8'),config=require('../vercel.json');
 for(const route of ['security','copyright']){
  assert.ok(html.includes('href="/'+route+'"'));
  assert.ok(config.rewrites.some(r=>r.source==='/'+route&&r.destination==='/'+route+'.html'));
  const page=fs.readFileSync(path.join(root,route+'.html'),'utf8');
  assert.ok(page.includes('href="/contacts"'));
  assert.doesNotMatch(page,/<script\b|<form\b|ПІДТВЕРДИТИ/i);
 }
 const ignore=fs.readFileSync(path.join(root,'.vercelignore'),'utf8');
 assert.ok(ignore.split(/\r?\n/).includes('docs/security/'));
 assert.ok(ignore.split(/\r?\n/).includes('docs/legal-review.md'));
});
