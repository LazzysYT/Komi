'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {controller}=require('../komi-admin-mfa.js');
function mock({admin=true,user='owner',verified=[],pending=[],aal='aal1',verifyError=false}={}){
 const calls=[];
 const ok=data=>({data,error:null});
 const db={auth:{getUser:async()=>ok({user:{id:user}}),mfa:{
  listFactors:async()=>ok({totp:verified,all:[...verified,...pending]}),
  getAuthenticatorAssuranceLevel:async()=>ok({currentLevel:aal}),
  enroll:async(args)=>{calls.push(['enroll',args]);return ok({id:'new-factor',totp:{secret:'TESTONLY'}});},
  challengeAndVerify:async(args)=>{calls.push(['verify',args]);if(verifyError)return {data:null,error:{message:'private response'}};aal='aal2';return ok({});}
 }},rpc:async()=>ok(admin)};
 return {db,calls};
}
test('non-admin and wrong account cannot enroll',async()=>{
 for(const m of [mock({admin:false}),mock({user:'other'})]){
  await assert.rejects(controller(m.db,'owner',()=>true).enroll());assert.equal(m.calls.length,0);
 }
});
test('closed panel cannot enroll or verify',async()=>{
 const m=mock();const c=controller(m.db,'owner',()=>false);
 await assert.rejects(c.enroll());await assert.rejects(c.verify('a','123456'));assert.equal(m.calls.length,0);
});
test('only TOTP enrollment, never expose raw response',async()=>{
 const m=mock();const c=controller(m.db,'owner',()=>true);
 assert.deepEqual(await c.enroll(),{id:'new-factor',secret:'TESTONLY'});
 assert.deepEqual(m.calls,[['enroll',{factorType:'totp'}]]);
});
test('existing verified factor requires AAL2 before adding another',async()=>{
 const m=mock({verified:[{id:'a',status:'verified'}]});
 await assert.rejects(controller(m.db,'owner',()=>true).enroll(),/Сначала/);assert.equal(m.calls.length,0);
});
test('valid verification and invalid code handling',async()=>{
 const m=mock();const c=controller(m.db,'owner',()=>true);
 await assert.rejects(c.verify('a','12345'));assert.equal(m.calls.length,0);
 assert.equal((await c.verify('a','123456')).currentLevel,'aal2');
 assert.deepEqual(m.calls,[['verify',{factorId:'a',code:'123456'}]]);
});
test('raw provider errors are not displayed',async()=>{
 const m=mock({verifyError:true});
 await assert.rejects(controller(m.db,'owner',()=>true).verify('a','123456'),e=>!e.message.includes('private response'));
});
test('late enrollment result is discarded after account/view change',async()=>{
 const m=mock();let active=true;
 m.db.auth.mfa.enroll=async()=>{active=false;return {data:{id:'a',totp:{secret:'TESTONLY'}}};};
 await assert.rejects(controller(m.db,'owner',()=>active).enroll(),/Сеанс/);
});
test('backup factor may be added at AAL2',async()=>{
 const m=mock({verified:[{id:'a',status:'verified'}],aal:'aal2'});
 assert.equal((await controller(m.db,'owner',()=>true).enroll()).id,'new-factor');
});

test('isolated page only loads the pinned SDK and dedicated first-party scripts',()=>{
 const fs=require('node:fs'),path=require('node:path'),root=path.join(__dirname,'..');
 const html=fs.readFileSync(path.join(root,'admin-security.html'),'utf8');
 const sources=[...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*>/gi)].map(m=>m[1].split('?')[0]);
 assert.deepEqual(sources,['https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.0','/komi-admin-mfa.js','/admin-security-entry.js']);
 assert.equal((html.match(/<script\b/gi)||[]).length,sources.length);
 assert.doesNotMatch(html,/<iframe\b|<object\b|adsbygoogle|komi-ads-loader/i);
 const config=JSON.parse(fs.readFileSync(path.join(root,'vercel.json'),'utf8'));
 const headers=new Map(config.headers.find(h=>h.source==='/admin-security.html').headers.map(h=>[h.key.toLowerCase(),h.value]));
 assert.match(headers.get('cache-control'),/\bno-store\b/);
 assert.equal(headers.get('referrer-policy'),'no-referrer');
 assert.equal(headers.get('cross-origin-opener-policy'),'same-origin');
 assert.match(headers.get('x-robots-tag'),/\bnoindex\b/);
 const csp=headers.get('content-security-policy');
 assert.match(csp,/default-src 'none'/);
 assert.match(csp,/frame-ancestors 'none'/);
 assert.match(csp,/form-action 'none'/);
 assert.match(csp,/script-src 'self' https:\/\/cdn\.jsdelivr\.net;/);
 assert.match(csp,/script-src-attr 'none'/);
 assert.doesNotMatch(csp,/googlesyndication|vercel\.live|'unsafe-eval'/);
});

test('unfinished TOTP enrollment is recoverable and does not create another factor',async()=>{
 const m=mock({pending:[{id:'existing-totp',status:'unverified',factor_type:'totp'},{id:'other-phone',status:'unverified',factor_type:'phone'}]});
 const c=controller(m.db,'owner',()=>true);
 const state=await c.status();
 assert.deepEqual(state.verified,[]);
 assert.deepEqual(state.pending.map(f=>f.id),['existing-totp']);
 await assert.rejects(c.enroll(),/Сначала завершите/);
 assert.equal(m.calls.length,0);
 assert.equal((await c.verify('existing-totp','123456')).currentLevel,'aal2');
 assert.deepEqual(m.calls,[['verify',{factorId:'existing-totp',code:'123456'}]]);
});
test('existing verified device requires step-up before enrolling even with pending setup',async()=>{
 const m=mock({verified:[{id:'a',status:'verified'}],pending:[{id:'b',status:'unverified',factor_type:'totp'}]});
 await assert.rejects(controller(m.db,'owner',()=>true).enroll(),/Сначала подтвердите вход/);
 assert.equal(m.calls.length,0);
});

test('admin panel requires AAL2 but membership discovery still works before verification',async()=>{
 const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
 const app=fs.readFileSync(path.join(__dirname,'..','app-main.js'),'utf8');
 const source=app.slice(app.indexOf('async function requireServerAdmin('),app.indexOf('let komiAdminUiLoader'));
 assert.match(source,/membershipOnly/);
 const redirects=[],notices=[];
 let level='aal1',role=true,reads=0;
 const ctx=vm.createContext({currentUser:{authUserId:'fixture'},_supabase:{rpc:async()=>({data:role,error:null}),auth:{mfa:{getAuthenticatorAssuranceLevel:async()=>{reads++;return {data:{currentLevel:level},error:null};}}}},komiAdminVerified:false,renderHeaderUser(){},alert(message){notices.push(message)},console:{warn(){}},location:{assign(url){redirects.push(url)}}});
 vm.runInContext(source,ctx);
 assert.equal(await ctx.requireServerAdmin(true,true),true);
 assert.equal(reads,0);
 assert.equal(await ctx.requireServerAdmin(),false);
 assert.deepEqual(redirects,['/admin-security.html']);
 assert.equal(await ctx.requireServerAdmin(true),false);
 level='aal2';
 assert.equal(await ctx.requireServerAdmin(),true);
 role=false;
 assert.equal(await ctx.requireServerAdmin(true,true),false);
 assert.equal(await ctx.requireServerAdmin(),false);
 assert.equal(redirects.length,1);
});
