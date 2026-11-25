'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const app=read('app-main.js');
const start=app.indexOf('function renderProfileView(container)');
const renderProfile=app.slice(start,app.indexOf('let avatarDraft =',start));
const escape=s=>String(s??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
function fixture({owner=true,user='Komi',section='overview'}={}){
 const listeners={},container={innerHTML:'',querySelector:()=>null};
 let focus=null, renders=0, auth=null;
 const globals={document:{addEventListener:(event,cb)=>{listeners[event]=cb},querySelectorAll:()=>[{dataset:{profileTab:'activity'},focus:()=>{focus='activity'}}]},
 URL,location:{origin:'https://example.org'},currentUser:owner?{username:'Komi',authUserId:'verified'}:null,
 profileTargetUser:user,profilePageSection:section,profileActiveTab:'Просмотрено',profileCollectionSearchQuery:'',
 userProfiles:{Komi:{displayName:'Komi & Friends',avatar:'https://example.org/a.png',banner:'https://example.org/b.png',title:'Киноман',regDate:'2026'}},
 userAnimeStatuses:{Komi:{'1':'Просмотрено'}},userFavorites:{Komi:{'1':true}},userCustomFolders:{Komi:{'Любимая папка':['1']}},
 komiEpisodeProgress:{Komi_1:{updated:10,index:0,time:240,duration:1200},visitor_2:{updated:20,index:0,time:700,duration:1200}},
 profileWalls:{Komi:[{text:'Стена сохранена',author:'Komi',time:'вчера'}]},
 friendsFor:()=>['Друг'],komiProfileAnimeIndex:()=>new Map([['1',{id:1,title:'Пример тайтла',genres:['Мистика']}]]),
 komiSavedCardsOwner:null,komiSavedAnimeCards:new Map(),komiAchievements:()=>({level:2,xp:30,badges:[],achievements:[]}),
 komiQuestRewardState:{owner:null,data:null},komiPrivacyState:{owner:null},
 komiPrivacyRequest:()=>{},komiDailyActivityRead:()=>{},komiVerifiedXpRead:()=>{},komiDailyQuestRewardRead:()=>{},
 komiProfileQuests:()=>[],komiSafeUrl:x=>x,komiVisibleUsername:(n,p)=>p.displayName||n,
 safeProfileText:escape,escapeFriendHtml:escape,komiFolderImportableCount:()=>1,renderCard:a=>a.title,
 render:()=>{renders++;globals.renderProfileView(container);},openAuthModal:x=>{auth=x}
 };
 globals.window=globals;
 vm.createContext(globals);
 vm.runInContext(read('profile-premium.js'),globals);
 vm.runInContext(renderProfile,globals);
 globals.renderProfileView(container);
 return {globals,listeners,html:()=>container.innerHTML,focus:()=>focus,renders:()=>renders,auth:()=>auth};
}
test('guest sees an explicit sign-in choice without exposing a stored profile or auto-opening the auth dialog',()=>{
 const f=fixture({owner:false,user:null});
 assert.match(f.html(),/data-profile-guest-login/);
 assert.match(f.html(),/href="\/catalog"/);
 assert.doesNotMatch(f.html(),/profile-settings|Киноман|data-profile-resume|data-komi-quest-rewards/);
 assert.equal(f.auth(),null);
 const button={matches:selector=>selector==='[data-profile-guest-login]'};
 f.listeners.click({target:{closest:()=>button}});
 assert.equal(f.auth(),'login');
});
test('owner overview preserves private resume, settings, music, cover, wallet, favorites and separate activity route',()=>{
 const f=fixture();const h=f.html();
 assert.ok(h.indexOf('Разделы профиля') < h.indexOf('Продолжить просмотр'));
 assert.ok(h.indexOf('Продолжить просмотр')<h.indexOf('Статистика просмотра'));
 for (const hook of ['profile-settings','data-komi-privacy-panel','data-komi-profile-music','data-profile-share','data-profile-balance','data-profile-resume="1"','data-komi-shop-showcase','data-profile-jump="activity"','data-profile-tab="activity"']) assert.ok(h.includes(hook),hook);
 assert.doesNotMatch(h,/data-profile-resume="2"|data-komi-daily-activity|data-komi-quest-rewards/);
 const tab={dataset:{profileTab:'activity'},matches:()=>false,closest:()=>({querySelectorAll:()=>[tab]})};
 f.listeners.click({target:{closest:()=>tab}});
 assert.equal(f.renders(),1);
 assert.equal(f.focus(),'activity');
 for(const hook of ['data-komi-daily-activity','data-komi-quest-rewards','data-komi-daily-refresh','data-quest-reward-id','daily-checkin'])assert.ok(f.html().includes(hook),hook);
});
test('shared profile does not gain owner controls even when the previous section was Activity',()=>{
 const f=fixture({owner:true,user:'Друг',section:'activity'});
 assert.equal(f.globals.profilePageSection,'overview');
 assert.doesNotMatch(f.html(),/data-profile-tab="activity"|data-komi-daily-activity|data-profile-resume|data-profile-balance|id="profile-settings"/);
 assert.match(f.html(),/data-profile-share/);
 assert.match(f.html(),/data-profile-party/);
});
test('collection, folders, friends, wall, history and achievements retain their entry points',()=>{
 for(const [section,re] of [['anime',/Поиск в коллекции[\s\S]*Пример тайтла/],['history',/История просмотра[\s\S]*Продолжить с 4:00/],['achievements',/Достижения/],['friends',/Открыть профиль/],['comments',/Стена сохранена/]]){
  assert.match(fixture({section}).html(),re,section);
 }
 const h=fixture({section:'anime'}).html();
 for(const word of ['Любимая папка','createCustomFolder','deleteCustomFolder','importLocalCustomFolders'])assert.ok(h.includes(word),word);
 assert.match(read('index.html'),/\/profile-studio\.css\?v=/);
});
