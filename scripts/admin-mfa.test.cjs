'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {controller}=require('../komi-admin-mfa.js');
function mock({admin=true,user='owner',verified=[],aal='aal1',verifyError=false}={}){
 const calls=[];
 const ok=data=>({data,error:null});
 const db={auth:{getUser:async()=>ok({user:{id:user}}),mfa:{
  listFactors:async()=>ok({totp:verified}),
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
