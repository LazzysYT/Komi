const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const a=html.indexOf('async function restoreGoogleSession()');
const b=html.indexOf('        // Keep async profile loads in order',a);
assert.ok(a>=0&&b>a,'Auth restore function missing');
const restoreSource=html.slice(a,b);

function fixture({previous={authUserId:'uid-a',username:'google_user_a'},
  next={id:'uid-b',username:'google_user_b'}}={}) {
 const calls=[];
 const currentUser=previous?{...previous}:null;
 const ctx=vm.createContext({
  currentUser,
  _supabase:{
   auth:{getSession:async()=>({data:{session:{user:{
     id:next.id,app_metadata:{provider:'google'},user_metadata:{}
   }}},error:null})},
   from(table){assert.equal(table,'komi_profiles');
    const q={select(){return this;},eq(){return this;},
      maybeSingle:async()=>({data:{display_name:'B',avatar_url:null,bio:'New',created_at:'2026-11-11'},error:null}),
      insert:async()=>({error:null})};
    return q;}
  },
  googleProfileName:()=>next.username,
  userAnimeStatuses:{google_user_a:{'11':'Просмотрено'}},
  userFavorites:{google_user_a:{'11':'Любимые'}},
  userCustomFolders:{google_user_a:{'Сохранённое':['11']}},
  komiEpisodeProgress:{google_user_a_11:{time:20}},
  userWatchHistory:{google_user_a_11:20},
  userProfiles:{[next.username]:{avatar:'https://example.test/avatar.png'}},
  protectedFriendRequests:[{owner:'uid-a',id:5}],
  protectedFriendList:{owner:'uid-a',idsByName:new Map([['A','uid-a']])},
  protectedFriendSent:{owner:'uid-a',names:new Set(['A'])},
  komiAdminVerified:true,
  clearKomiAccountData(user){
   calls.push(['clear',user.authUserId,user.username]);
   delete ctx.userAnimeStatuses[user.username];
   delete ctx.userFavorites[user.username];
   delete ctx.userCustomFolders[user.username];
   delete ctx.komiEpisodeProgress[user.username+'_11'];
   delete ctx.userWatchHistory[user.username+'_11'];
  },
  closeWatchModal:()=>calls.push(['close-watch']),
  leaveWatchPartyRoom:async()=>{calls.push(['leave-party'])},
  requireServerAdmin:async()=>false,
  loadAuthenticatedAnimeData:async()=>calls.push(['load-account']),
  loadProtectedFriends:async()=>{},
  loadAccountNotifications:async()=>{},
  updateNotificationsUI:()=>{},
  saveData:()=>calls.push(['save']),
  closeAuthModal:()=>{},
  render:()=>{},
  location:{hash:''},
  aniCoinRequest:null,
  applySavedKomiProfile:()=>{},
  Date,Map,Set,Error,console:{warn(){},error(){}},
  setTimeout(){},encodeURIComponent
 });
 vm.runInContext(restoreSource,ctx);
 return {ctx,calls,restore:()=>vm.runInContext('restoreGoogleSession()',ctx)};
}
test('switching verified UUID clears earlier private folders, statuses, favorites and friend context',async()=>{
 const x=fixture();
 await x.restore();
 assert.deepEqual(x.calls.slice(0,3),[['close-watch'],['leave-party'],['clear','uid-a','google_user_a']]);
 assert.equal(x.ctx.currentUser.authUserId,'uid-b');
 assert.equal(x.ctx.currentUser.username,'google_user_b');
 assert.equal(x.ctx.userCustomFolders.google_user_a,undefined);
 assert.equal(x.ctx.userFavorites.google_user_a,undefined);
 assert.equal(x.ctx.userAnimeStatuses.google_user_a,undefined);
 assert.equal(x.ctx.protectedFriendList.owner,null);
 assert.equal(x.ctx.protectedFriendSent.owner,null);
 assert.equal(x.ctx.protectedFriendRequests.length,0);
 assert.equal(x.ctx.komiAdminVerified,false);
});
test('same displayed username with different verified UID still triggers cleanup',async()=>{
 const x=fixture({previous:{authUserId:'uid-a',username:'shared'},next:{id:'uid-b',username:'shared'}});
 await x.restore();
 assert.ok(x.calls.some(c=>c[0]==='clear'&&c[1]==='uid-a'));
});
test('same verified identity does not clear cache during ordinary session refresh',async()=>{
 const x=fixture({previous:{authUserId:'uid-b',username:'google_user_b'}});
 await x.restore();
 assert.equal(x.calls.some(c=>c[0]==='clear'),false);
 assert.equal(x.calls.some(c=>c[0]==='leave-party'),false);
});
test('legacy-only local account is preserved for explicit import rather than silently claimed',async()=>{
 const x=fixture({previous:{username:'old_local_nickname'}});
 await x.restore();
 assert.equal(x.calls.some(c=>c[0]==='clear'),false);
 assert.equal(x.ctx.currentUser.authUserId,'uid-b');
});
