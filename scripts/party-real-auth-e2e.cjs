// Real two-account Watch Party server synchronization / access regression.
// Runs ONLY with two dedicated test credentials in a manual workflow_dispatch.
// Never changes friendships or user profiles. Only a disposable private room.
'use strict';
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const keys=['KOMI_TEST_EMAIL_A','KOMI_TEST_PASSWORD_A','KOMI_TEST_EMAIL_B','KOMI_TEST_PASSWORD_B'];
for(const key of keys) {
  if(!process.env[key]) { console.error('Missing dedicated test secret: '+key); process.exit(2); }
}
const BASE=process.env.KOMI_TEST_URL||'https://komianime.online/';

(async()=>{
  const browser=await chromium.launch({headless:true});
  const contexts=[];
  let roomId='';
  let hostPage=null;
  async function login(suffix) {
    const context=await browser.newContext();
    contexts.push(context);
    const page=await context.newPage();
    const res=await page.goto(BASE,{waitUntil:'domcontentloaded',timeout:60000});
    assert.ok(res?.ok(),'Site not accessible for account '+suffix);
    await page.waitForFunction(()=>typeof _supabase!=='undefined'&&!!_supabase);
    const data=await page.evaluate(async ({email,password})=>{
      const response=await _supabase.auth.signInWithPassword({email,password});
      if(response.error) return {error:response.error.message};
      await restoreGoogleSession();
      return {uid:response.data.user?.id,username:currentUser?.username,
        authId:currentUser?.authUserId};
    },{email:process.env['KOMI_TEST_EMAIL_'+suffix],
       password:process.env['KOMI_TEST_PASSWORD_'+suffix]});
    if(data.error||!data.uid||!data.username||data.authId!==data.uid)
      throw Error('Dedicated account '+suffix+' is not ready: '+(data.error||'no profile'));
    return {page,uid:data.uid,username:data.username};
  }
  async function call(page,action,id=null,args={}) {
    return page.evaluate(async payload=>{
      const {data,error}=await _supabase.rpc('komi_party',{
        action:payload.action,room_id:payload.id,args:payload.args
      });
      return {data,error:error?.message||null};
    },{action,id,args});
  }
  try {
    const a=await login('A');
    const b=await login('B');
    hostPage=a.page;
    assert.notEqual(a.uid,b.uid,'Test accounts must not refer to the same user');
    // Creating a room clears this host's existing rooms; do not disrupt
    // an active test account that was accidentally used for something else.
    const existing=await call(a.page,'list');
    if(existing.error) throw Error('Cannot list existing rooms: '+existing.error);
    assert.ok(Array.isArray(existing.data),'Room listing must return an array');
    if(existing.data.some(room=>room.host===a.uid)) {
      console.log('SKIP real party state test: dedicated host account already has an active room');
      return;
    }
    const created=await call(a.page,'create',null,{
      name:'Komi QA private test room',animeId:'52991',private:true,episode:0,source:'Komi QA source'
    });
    if(created.error||!created.data?.id) throw Error('Private test room create failed: '+created.error);
    roomId=created.data.id;
    assert.equal(created.data.host,a.uid);
    assert.equal(created.data.private,true);
    // A private room is invisible and unreadable before an authenticated invite.
    const before=await call(b.page,'read',roomId);
    assert.ok(before.error||!before.data,'Guest accessed a private room before invitation');
    // Verify friendship using protected rows, not a fabricated local contact.
    const friendships=await a.page.evaluate(async()=>{
      const {data,error}=await _supabase.from('komi_friendships').select('user_a,user_b');
      return {data,error:error?.message||null};
    });
    if(friendships.error) throw Error('Cannot verify friend membership: '+friendships.error);
    const areFriends=(friendships.data||[]).some(link=>
      (link.user_a===a.uid&&link.user_b===b.uid)||(link.user_a===b.uid&&link.user_b===a.uid));
    if(!areFriends) {
      console.log('PASS private-room access denied to uninvited test account');
      console.log('SKIP two-account state replication: test accounts are not verified friends');
      return;
    }
    const invited=await call(a.page,'invite',roomId,{username:b.username});
    if(invited.error) throw Error('Invite failed for verified test friend: '+invited.error);
    const joined=await call(b.page,'read',roomId);
    if(joined.error||joined.data?.id!==roomId)
      throw Error('Invited guest cannot read private room: '+joined.error);
    // This is a real Supabase RPC round-trip from two separate authenticated browsers.
    for(const state of [{episode:0,source:'Komi QA source',position:86,playing:true},
                        {episode:1,source:'Komi QA source',position:103,playing:false}]) {
      const updated=await call(a.page,'state',roomId,state);
      if(updated.error) throw Error('Host state update failed: '+updated.error);
      const seen=await call(b.page,'read',roomId);
      if(seen.error) throw Error('Guest failed to receive host state: '+seen.error);
      assert.equal(Number(seen.data.position),state.position);
      assert.equal(Number(seen.data.episode),state.episode);
      assert.equal(seen.data.playing,state.playing);
      assert.equal(seen.data.source,state.source);
    }
    console.log('PASS real 2-account private invite and server state replication');
  } finally {
    if(roomId&&hostPage&&!hostPage.isClosed()) {
      const closed=await call(hostPage,'close',roomId).catch(e=>({error:e.message}));
      if(closed.error) {
        console.error('Could not clean up disposable test room: '+closed.error);
        process.exitCode=1;
      }
    }
    for(const context of contexts) await context.close();
    await browser.close();
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
