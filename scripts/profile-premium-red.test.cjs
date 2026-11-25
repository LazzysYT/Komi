'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
function adapter(){
  const scope={
    matchMedia:()=>({matches:true}),
    document:{addEventListener:()=>{}},
    location:{origin:'https://komianime.online'},URL,
    userFavorites:{guest:{123:true}},
    userProfiles:{friend:{displayName:'Друг'}},
    komiEpisodeProgress:{guest_123:{index:2,season:1,time:230,duration:1200,updated:1795000000000}},
    komiAchievements:()=>({xp:100,badges:['Первый просмотр']})
  };
  scope.window=scope;
  vm.createContext(scope);
  vm.runInContext(read('home-discovery.js'),scope);
  vm.runInContext(read('profile-premium.js'),scope);
  const ctx={
    username:'guest',isMe:true,resumeReady:true,
    statsCounts:{'Смотрю':0,'В планах':0,'Просмотрено':1,'Отложено':0,'Брошено':0},
    myFriends:['friend'],topGenres:[['Драма',1]],
    profileAnimeById:new Map([['123',{id:'123',title:'Тестовое аниме',poster:'https://example.org/test.jpg'}]]),
    section:'overview'
  };
  return {ui:scope.window.KomiProfileUI,ctx};
}
test('Premium monochrome reference is scoped to existing profile and bundled last',()=>{
 const css=read('profile-premium-mono.css'),bundle=read('komi.bundle.css'),html=read('index.html');
 assert.match(css,/#profile\.komi-profile-premium-mono/);
 assert.doesNotMatch(css,/#[A-Fa-f0-9]*FF454F/i);
 assert.match(css,/\.profile-summary-strip/);
 assert.match(css,/#profile\.komi-profile-premium-mono \.profile-header-card/);
 assert.match(css,/grid-template-columns:minmax\(0,1\.85fr\) minmax\(280px,1fr\)/);
 assert.match(css,/@media\(max-width:860px\)/);
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.match(css,/profile-tabs-ready::before/);
 assert.ok(bundle.endsWith('/* --- profile-premium-mono.css --- */\n'+css+'\n'));
 assert.ok(/href="\/komi\.production\.css\?v=[A-Za-z0-9._-]+"/.test(html));
 assert.equal((html.match(/<link rel="stylesheet" href="\/komi\.production\.css\?v=/g)||[]).length,1);
});
test('Profile hero preserves data bindings, avatar upload, friends and login',()=>{
 const app=read('app-main.js');
 for(const token of [
  'id="profile"','komi-profile-premium-mono','profile-cover',
  'komiSafeUrl(p.avatar)','komiSafeUrl(p.banner || p.cover || p.coverUrl)',
  'data-profile-balance','id="profile-settings"','id="avatarFileInput"',
  'updateUserProfile(this)','sendFriendRequest(window.komiViewedProfileName)',
  'removeFriend(window.komiViewedProfileName)','data-profile-party',
  "logoutUser('local')",'data-profile-share'
 ])assert.ok(app.includes(token),token+' missing');
 assert.ok(app.includes('userAnimeStatuses[username]'));
 assert.ok(app.includes('KomiProfileUI.content'));
});
test('overview uses real saved data and the summary leaves unverified metrics unavailable',()=>{
 const {ui,ctx}=adapter();
 const html=ui.content(ctx);
 for(const phrase of ['Топ избранного','Продолжить просмотр','Мои списки','Витрина достижений','Тестовое аниме','Серия 3'])
   assert.ok(html.includes(phrase),phrase);
 assert.ok(html.includes('/api/poster?src='));
 const summary=ui.summary({level:1,xp:100,multiplier:1,titleCount:1,friendCount:1});
 for(const k of ['episodes','hours'])assert.match(summary,new RegExp('data-profile-field="'+k+'"[^>]*>—'));
 assert.doesNotMatch(summary,/data-profile-field="meanScore"/);
 assert.match(html,/data-profile-list="Просмотрено" aria-label="Просмотрено: 1 — открыть список"/);
 assert.match(html,/<span>Просмотрено<\/span><strong>1<\/strong><small>100%<\/small>/);
  assert.match(html,/profile-achievement-progress/);
 assert.match(html,/profile-distribution-part/);
 assert.match(html,/profile-distribution-part" style="--profile-segment:#[A-Fa-f0-9]{6};flex:1/);
});
test('Privacy and escape protections remain active',()=>{
 const {ui,ctx}=adapter();
 const privateHistory=ui.content({...ctx,section:'history',isMe:false});
 assert.match(privateHistory,/доступна только владельцу/);
 assert.doesNotMatch(privateHistory,/Тестовое аниме|Серия 3/);
 assert.doesNotMatch(ui.content({...ctx,isMe:false}),/data-profile-resume|Продолжить просмотр/);
 ctx.profileAnimeById=new Map([['123',{id:'123',title:'<svg onload=alert(1)>',poster:'javascript:alert(1)'}]]);
 const html=ui.content(ctx);
 assert.ok(html.includes('&lt;svg'));
 assert.doesNotMatch(html,/<svg onload=/);
 assert.doesNotMatch(html,/src="javascript:/);
});
test('grouped navigation retains owner sections and an accessible active state',()=>{
 const {ui}=adapter();
 const nav=ui.navigation('friends',2,14,1,true,true);
 for(const section of ['overview','anime','history','activity','achievements','friends','comments'])
   assert.ok(nav.includes('data-profile-tab="'+section+'"'));
 assert.equal((nav.match(/aria-pressed="true"/g)||[]).length,1);
 assert.match(nav,/profile-tab-counter/);
 assert.doesNotMatch(ui.navigation('friends',2,14,1,false,false),/data-profile-tab="(?:history|activity)"/);
});
