'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
function adapter(){
  const scope={
    window:{matchMedia:()=>({matches:true})},
    document:{addEventListener:()=>{}},
    location:{origin:'https://komianime.online'},URL,
    userFavorites:{guest:{123:true}},
    userProfiles:{friend:{displayName:'Друг'}},
    komiEpisodeProgress:{guest_123:{index:2,season:1,time:230,duration:1200,updated:1795000000000}},
    komiAchievements:()=>({xp:100,badges:['Первый просмотр']})
  };
  vm.runInNewContext(read('profile-premium.js'),scope);
  const ctx={
    username:'guest',isMe:true,
    statsCounts:{'Смотрю':0,'В планах':0,'Просмотрено':1,'Отложено':0,'Брошено':0},
    myFriends:['friend'],topGenres:[['Драма',1]],
    profileAnimeById:new Map([['123',{id:'123',title:'Тестовое аниме',poster:'https://example.org/test.jpg'}]]),
    section:'overview'
  };
  return {ui:scope.window.KomiProfileUI,ctx};
}
test('Premium Dark + Red is scoped to existing profile and bundled last',()=>{
 const css=read('profile-premium-red.css'),bundle=read('komi.bundle.css'),html=read('index.html');
 assert.match(css,/#profile\.komi-profile-premium-red/);
 assert.match(css,/#FF454F/i);
 assert.match(css,/grid-template-columns:minmax\(0,1\.85fr\) minmax\(280px,1fr\)/);
 assert.match(css,/@media\(max-width:860px\)/);
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.match(css,/profile-tabs-ready::before/);
 assert.ok(bundle.endsWith('/* --- profile-premium-red.css --- */\n'+css+'\n'));
 assert.ok(html.includes('komi.bundle.css?v=20261119c'));
 assert.equal((html.match(/<link rel="stylesheet" href="\/komi\.bundle/g)||[]).length,1);
});
test('Profile hero preserves data bindings, avatar upload, friends and login',()=>{
 const app=read('app-main.js');
 for(const token of [
  'id="profile"','komi-profile-premium-red','profile-cover',
  'komiSafeUrl(p.avatar)','komiSafeUrl(p.banner || p.cover || p.coverUrl)',
  'data-profile-balance','id="profile-settings"','id="avatarFileInput"',
  'updateUserProfile(this)','sendFriendRequest(window.komiViewedProfileName)',
  'removeFriend(window.komiViewedProfileName)','data-profile-party',
  "logoutUser(\\'local\\')",'data-profile-share'
 ])assert.ok(app.includes(token),token+' missing');
 assert.ok(app.includes('userAnimeStatuses[username]'));
 assert.ok(app.includes('KomiProfileUI.content'));
});
test('Bento views use real saved data and server-backed metrics are never fabricated',()=>{
 const {ui,ctx}=adapter();
 const html=ui.content(ctx);
 for(const phrase of ['Топ избранного','Продолжить просмотр','Статистика просмотра','Витрина достижений','Тестовое аниме','Серия 3'])
   assert.ok(html.includes(phrase),phrase);
 assert.ok(html.includes('/api/poster?src='));
 for(const k of ['episodes','hours','meanScore'])assert.match(html,new RegExp('data-profile-field="'+k+'">—'));
 assert.match(html,/profile-distribution-part/);
 assert.match(html,/--profile-segment:#FF454F/);
});
test('Privacy and escape protections remain active',()=>{
 const {ui,ctx}=adapter();
 const privateHistory=ui.content({...ctx,section:'history',isMe:false});
 assert.match(privateHistory,/доступна только владельцу/);
 assert.doesNotMatch(privateHistory,/Тестовое аниме|Серия 3/);
 ctx.profileAnimeById=new Map([['123',{id:'123',title:'<svg onload=alert(1)>',poster:'javascript:alert(1)'}]]);
 const html=ui.content(ctx);
 assert.ok(html.includes('&lt;svg'));
 assert.doesNotMatch(html,/<svg onload=/);
 assert.doesNotMatch(html,/src="javascript:/);
});
test('Tab navigation retains six legacy sections and accessible active state',()=>{
 const {ui}=adapter();
 const nav=ui.navigation('friends',2,14,1);
 for(const section of ['overview','anime','history','achievements','friends','comments'])
   assert.ok(nav.includes('data-profile-tab="'+section+'"'));
 assert.equal((nav.match(/aria-pressed="true"/g)||[]).length,1);
 assert.match(nav,/profile-tab-counter/);
});
