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
  assert.equal(ctx.userProfiles[technicalFriend].publicAvatarUserId,friend);
  assert.deepEqual(refreshNames,[technicalFriend]);
  assert.equal(notifications,1);
  assert.deepEqual(Array.from(vm.runInContext('friendsFor(currentUser.username)',ctx)),[technicalFriend]);
  assert.deepEqual(Array.from(vm.runInContext("friendsFor('someone_else')",ctx)),[],
    'do not expose an owner\'s friend list in another profile');
});

test('friend mini cards render safe nicknames, actual GIF avatars, and original account targets',()=>{
  const first=premium.indexOf('function friendAvatarMarkup(name,profile,label)');
  const last=premium.indexOf('function content(ctx)',first);
  assert.ok(first>0 && last>first);
  const escapeText=value=>String(value??'').replace(/[&<>"']/g,c=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
  const ctx=vm.createContext({
    userProfiles:{
      [technicalFriend]:{displayName:'Test <friend>',avatar,publicAvatarUserId:friend}
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
  assert.match(premium,/root\.KomiProfileUI\s*=\s*\{[^}]*\brefreshFriends\s*[,}]/);
  assert.match(app,/KomiProfileUI\.summary/);
  assert.match(premium,/data-profile-friends-total/);
});

test('hydrating friends updates the compact summary without changing another profile',()=>{
  const total={textContent:'—'};
  const profile={dataset:{profileUser:technicalOwner},querySelector:selector=>selector==='[data-profile-friends-total]'?total:null};
  const sandbox={document:{addEventListener(){},getElementById:()=>profile},URL,location:{origin:'https://komianime.online'},
    currentUser:{username:technicalOwner,authUserId:owner},userProfiles:{}};
  sandbox.window=sandbox;
  vm.runInNewContext(premium,sandbox);
  sandbox.KomiProfileUI.refreshFriends(['first','second']);
  assert.equal(total.textContent,'2');
  assert.deepEqual(Array.from(sandbox.komiProfileFriendNames),['first','second']);
  profile.dataset.profileUser='other_user';
  sandbox.KomiProfileUI.refreshFriends(['third']);
  assert.equal(total.textContent,'2','a late owner response must not repaint a public profile');
});

test('all profile friend cards keep a local placeholder slot for a GIF with no static avatar',()=>{
  const sandbox={document:{addEventListener(){}},URL,location:{origin:'https://komianime.online'},
    userProfiles:{[technicalFriend]:{displayName:'Коми',publicAvatarUserId:friend,avatar:'javascript:alert(1)'}}};
  sandbox.window=sandbox;
  vm.runInNewContext(premium,sandbox);
  const markup=sandbox.KomiProfileUI.fullFriendRows([technicalFriend]);
  assert.match(markup,/>К<img data-komi-friend-avatar="" data-komi-friend-avatar-id="00000000-0000-4000-8000-000000000002"/);
  assert.match(markup,/visibility:hidden/);
  assert.doesNotMatch(markup,/javascript:|google_1234567890abcdef/);
});

test('friend media chooses the verified ID, falls back after image errors, and accepts changed GIFs',()=>{
  const scripts=fs.readFileSync(path.join(root,'komi-premium.js'),'utf8');
  const a=scripts.indexOf('function applyFriendAvatar('),b=scripts.indexOf('function badge(',a);
  assert.ok(a>0&&b>a);
  const attrs=new Map([['data-komi-friend-avatar-id',friend],['src',avatar]]);
  const img={getAttribute:key=>attrs.get(key)||null,hasAttribute:key=>attrs.has(key),
    setAttribute:(key,val)=>attrs.set(key,val),removeAttribute:key=>attrs.delete(key),style:{},matches:()=>true};
  let entitled=true;
  const media=new Map([[friend,{avatar_path:'live.gif'}]]);
  const context=vm.createContext({img,media,friendAvatarStates:new WeakMap(),
    friendAvatarSelector:'img[data-komi-friend-avatar]',uid:()=>{throw Error('Directory lookup must not be necessary');},
    isActiveId:id=>entitled&&id===friend,imageUrl:(bucket,path)=>path?'https://safe.example/'+bucket+'/'+path:''});
  vm.runInContext(scripts.slice(a,b),context);
  context.applyFriendAvatar(img);
  assert.equal(attrs.get('src'),'https://safe.example/avatars/live.gif');
  context.onFriendAvatarError({target:img});
  assert.equal(attrs.get('src'),avatar);
  context.applyFriendAvatar(img);
  assert.equal(attrs.get('src'),avatar,'the same failing GIF should not loop on refresh');
  context.onFriendAvatarError({target:img});
  assert.equal(attrs.has('src'),false);
  assert.equal(img.style.visibility,'hidden');
  media.set(friend,{avatar_path:'replacement.gif'});
  context.applyFriendAvatar(img);
  assert.equal(attrs.get('src'),'https://safe.example/avatars/replacement.gif');
  assert.equal(img.style.visibility,'');
  entitled=false;
  context.applyFriendAvatar(img);
  assert.equal(attrs.has('src'),false,'inactive Premium must not grant custom GIF');
});
