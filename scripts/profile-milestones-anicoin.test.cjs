'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const app=fs.readFileSync(path.join(root,'app-main.js'),'utf8');
const premium=fs.readFileSync(path.join(root,'profile-premium.js'),'utf8');
const coin=fs.readFileSync(path.join(root,'anicoin.js'),'utf8');

function section(source,from,to) {
  const start=source.indexOf(from);
  const end=source.indexOf(to,start);
  assert.ok(start>=0 && end>start,from+' exists');
  return source.slice(start,end);
}
const escapeText=value=>String(value??'').replace(/[&<>"']/g,char=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
})[char]);

test('35 distinct milestones derive only from actual saved lists, favorites, friends and XP',()=>{
  const code=section(app,'function komiAchievements(username) {','function komiRecommendations()');
  const ctx=vm.createContext({
    userAnimeStatuses:{owner:{'1':'Просмотрено','2':'Смотрю','3':'В планах'}},
    userFavorites:{owner:{'1':true}},
    friendsFor:()=>['a','b','c'],
    window:{KomiPremium:{xpForUsername:()=>0}},
    currentUser:{username:'owner',authUserId:'user-1'},
    komiQuestRewardState:{owner:null,data:null},
    komiServerXpState:{owner:null,data:null}
  });
  vm.runInContext(code,ctx);
  const achievements=vm.runInContext('komiAchievements("owner")',ctx);
  assert.equal(achievements.achievements.length,35);
  assert.equal(new Set(achievements.achievements.map(a=>a.id)).size,35);
  assert.equal(achievements.watched,1);
  assert.equal(achievements.watching,1);
  assert.equal(achievements.favorites,1);
  assert.equal(achievements.planned,1);
  assert.equal(achievements.listed,3);
  assert.equal(achievements.friends,3);
  assert.equal(achievements.xp,165);
  assert.equal(achievements.achievements.find(a=>a.id==='friend-three').earned,true);
  assert.equal(achievements.achievements.find(a=>a.id==='watch-250').earned,false);
  assert.ok(achievements.badges.includes('Первый просмотр'));
  const view=section(premium,'function achievementWidget(username,isMe,full=false){','function watchHistory(ctx){');
  const ui=vm.createContext({
    komiAchievements:()=>achievements,escapeText,number:x=>Math.max(0,Number(x)||0),
    format:x=>String(x),header:(name,meta)=>'<header>'+name+meta+'</header>'
  });
  vm.runInContext(view,ui);
  const full=vm.runInContext("achievementWidget('owner',true,true)",ui);
  const small=vm.runInContext("achievementWidget('owner',true,false)",ui);
  assert.equal((full.match(/class="profile-achievement is-/g)||[]).length,35);
  assert.equal((small.match(/class="profile-achievement is-/g)||[]).length,3);
  assert.equal((small.match(/class="profile-achievement is-earned/g)||[]).length,2);
  assert.equal((small.match(/class="profile-achievement is-locked/g)||[]).length,1);
  assert.match(full,/Открыто \d+ из 35 достижений/);
  assert.match(small,/Все достижения \(35\)/);
});

test('full friends tab displays escaped public nicknames and GIF avatars, keeping original profile route',()=>{
  const name='google_1234567890abcdef1234567890ab';
  const ui=vm.createContext({
    userProfiles:{[name]:{displayName:'Komi <friend>',avatar:'https://cdn.example.test/avatar.gif'}},
    komiVisibleUsername:(_name,profile)=>profile.displayName,
    safeUrl:url=>url.startsWith('https://')?url:'',
    escapeText
  });
  vm.runInContext(section(premium,'function fullFriendRows(names) {','function content(ctx){'),ui);
  ui.names=[name];
  const html=vm.runInContext('fullFriendRows(names)',ui);
  assert.match(html,/Komi &lt;friend&gt;/);
  assert.match(html,/avatar.gif/);
  assert.match(html,/komiProfileFriendNames\[0\]/);
  assert.doesNotMatch(html,/google_1234567890abcdef/);
  assert.match(premium,/fullList.innerHTML=fullFriendRows\(names\)/);
  assert.match(app,/KomiProfileUI.fullFriendRows\(myFriends\)/);
});

test('server-confirmed watch threshold rewards update wallet and visibly acknowledge coin',async()=>{
  const rpc=section(coin,'async function aniCoinRequest(','function aniCoinBadge()');
  const messages=[];
  const session=vm.createContext({
    currentUser:{authUserId:'user-1'},
    aniCoinOwner:'user-1',aniCoinWallet:{balance:0},
    _supabase:{rpc:async()=>({data:{balance:1,seconds:0,owned:[]},error:null})},
    currentView:'home',window:{KomiProfileUI:null},
    document:{getElementById:()=>null,querySelectorAll:()=>[]},
    komiStatusFeedback:message=>messages.push(message)
  });
  vm.runInContext(rpc,session);
  const response=await vm.runInContext("aniCoinRequest('watch',{p_session:'fake',p_seconds:12})",session);
  assert.equal(response.balance,1);
  assert.match(messages[0],/\+1 AniCoin/);
  assert.equal(session.aniCoinWallet.balance,1);
  const migration=fs.readFileSync(path.join(root,'supabase/migrations/202611090003_anicoin_shop.sql'),'utf8');
  assert.match(migration,/balance\s*=\s*balance\s*\+\s*earned_seconds\s*\/\s*1200/);
  assert.match(coin,/document\.hidden/);
  assert.match(coin,/aniCoinStartEmbed\(\)/);
});
