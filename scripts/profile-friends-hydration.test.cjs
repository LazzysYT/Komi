'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.join(__dirname,'..');
const app=fs.readFileSync(path.join(root,'app-main.js'),'utf8');
const premium=fs.readFileSync(path.join(root,'profile-premium.js'),'utf8');
const technicalFriend='google_1234567890abcdef1234567890ab';
const technicalOwner='google_abcdefabcdef1234567890abcdef';
const owner='00000000-0000-4000-8000-000000000001';
const friend='00000000-0000-4000-8000-000000000002';
const avatar='https://cdn.example.test/friend.gif';

test('friend lookup hydrates saved nicknames and avatars without exposing Google IDs',async()=>{
  const first=app.indexOf('let protectedFriendRequests = []');
  const last=app.indexOf('async function respondProtectedFriendRequest(',first);
  assert.ok(first>0 && last>first,'read-only friend loader should exist');

  let selectedFields='',refreshNames=null,notifications=0;
  const resultFor=table=>({
    komi_friend_requests: [],
    komi_friendships:[{user_a:owner,user_b:friend}],
    komi_profiles:[{user_id:friend,username:technicalFriend,display_name:'Komi Friend',avatar_url:avatar}]
  })[table];
  const supabase={
    from(table){
      const query={
        select(fields){if(table==='komi_profiles')selectedFields=fields;return query;},
        eq(){return query;},
        in(){return Promise.resolve({data:resultFor(table),error:null});},
        then(resolve,reject){return Promise.resolve({data:resultFor(table),error:null}).then(resolve,reject);}
      };
      return query;
    }
  };
  const ctx=vm.createContext({
    currentUser:{username:technicalOwner,authUserId:owner},
    _supabase:supabase,userProfiles:{},
    komiSafeAvatarUrl:value=>String(value||''),
    updateNotificationsUI(){notifications++;},
    renderFriendsDrawer(){},
    window:{
      KomiProfileUI:{refreshFriends(names){refreshNames=Array.from(names)}},
      KomiFriendRooms:{refresh(){}}
    }
  });
  vm.runInContext(app.slice(first,last),ctx);
  await vm.runInContext('loadProtectedFriends()',ctx);
  assert.equal(selectedFields,'user_id,username,display_name,avatar_url');
  assert.equal(ctx.userProfiles[technicalFriend].displayName,'Komi Friend');
  assert.equal(ctx.userProfiles[technicalFriend].avatar,avatar);
  assert.deepEqual(refreshNames,[technicalFriend]);
  assert.equal(notifications,1);
  assert.deepEqual(Array.from(vm.runInContext('friendsFor(currentUser.username)',ctx)),[technicalFriend]);
  assert.deepEqual(Array.from(vm.runInContext("friendsFor('someone_else')",ctx)),[],
    'do not expose an owner\'s friend list in another profile');
});

test('friend mini cards render safe nicknames, actual GIF avatars, and original account targets',()=>{
  const first=premium.indexOf('function friendRows(names)');
  const last=premium.indexOf('function content(ctx)',first);
  assert.ok(first>0 && last>first);
  const escapeText=value=>String(value??'').replace(/[&<>"']/g,c=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
  const ctx=vm.createContext({
    userProfiles:{
      [technicalFriend]:{displayName:'Test <friend>',avatar}
    },
    komiVisibleUsername:(name,p)=>p.displayName||name,
    safeUrl:url=>/^https:\/\//.test(url)?url:'',
    escapeText
  });
  vm.runInContext(premium.slice(first,last),ctx);
  ctx.names=[technicalFriend];
  const html=vm.runInContext('friendRows(names)',ctx);
  assert.match(html,/Test &lt;friend&gt;/);
  assert.match(html,/<img src="https:\/\/cdn\.example\.test\/friend\.gif"/);
  assert.match(html,/komiProfileFriendNames\[0\]/);
  assert.doesNotMatch(html,/<friend>|google_1234567890abcdef/);
  assert.match(premium,/refreshFriends\}/);
  assert.match(app,/data-profile-friends-count/);
});
