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
function fixture({owner=true,user='Komi',section='overview',resumeReady=true,resumeError=null}={}){
 const listeners={},callbacks={},container={innerHTML:'',querySelector:()=>null};
 let focus=null, renders=0, auth=null;
 const summary={focus:()=>{focus='more'},scrollIntoView:()=>{}};
 const more={open:false,contains:()=>false,querySelector:selector=>selector.includes('summary')?summary:null};
 const profile={querySelectorAll:()=>navigationButtons(),querySelector:selector=>selector.includes('summary')?summary:selector.includes('profile-more')?more:null};
 const navigationButtons=()=>[...container.innerHTML.matchAll(/data-profile-tab="([^"]+)"/g)].map(([,id])=>({
  dataset:{profileTab:id},focus:()=>{focus=id},scrollIntoView:()=>{},
  closest:selector=>selector==='#profile'?profile:selector.includes('profile-more')&&['activity','achievements','comments'].includes(id)?more:null
 }));
 const query=selector=>selector==='#profile'?profile:selector.includes('summary')?summary:selector.includes('profile-more[open]')?(more.open?more:null):selector.includes('profile-more')?more:
  selector.includes('data-profile-tab=')?navigationButtons().find(button=>selector.includes('"'+button.dataset.profileTab+'"')):null;
 const globals={document:{addEventListener:(event,cb)=>{(callbacks[event]??=[]).push(cb);listeners[event]=payload=>callbacks[event].forEach(listener=>listener(payload));},querySelectorAll:()=>navigationButtons(),querySelector:query,getElementById:id=>id==='profile'?profile:null},
 URL,location:{origin:'https://example.org'},currentUser:owner?{username:'Komi',authUserId:'verified'}:null,
 profileTargetUser:user,profilePageSection:section,profileActiveTab:'Просмотрено',profileCollectionSearchQuery:'',
 userProfiles:{Komi:{displayName:'Komi & Friends',avatar:'https://example.org/a.png',banner:'https://example.org/b.png',title:'Киноман',regDate:'2026'}},
 userAnimeStatuses:{Komi:{'1':'Просмотрено'}},userFavorites:{Komi:{'1':true}},userCustomFolders:{Komi:{'Любимая папка':['1']}},
 komiResumeReadyUid:resumeReady?'verified':null,
 komiResumeLoadError:resumeError,
 komiEpisodeProgress:{Komi_1:{updated:10,index:0,season:1,time:240,duration:1200},visitor_2:{updated:20,index:0,season:1,time:700,duration:1200}},
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
 vm.runInContext(read('home-discovery.js'),globals);
 vm.runInContext(read('profile-premium.js'),globals);
 vm.runInContext(renderProfile,globals);
 globals.renderProfileView(container);
 return {globals,listeners,html:()=>container.innerHTML,focus:()=>focus,renders:()=>renders,auth:()=>auth,navigationButtons,profile};
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
 assert.ok(h.indexOf('Продолжить просмотр')<h.indexOf('Мои списки'));
 for (const hook of ['profile-settings','data-komi-privacy-panel','data-komi-profile-music','data-profile-share','data-profile-balance','data-profile-resume="1"','data-komi-shop-showcase','data-profile-jump="activity"','data-profile-tab="activity"']) assert.ok(h.includes(hook),hook);
 assert.doesNotMatch(h,/data-profile-resume="2"|data-komi-daily-activity|data-komi-quest-rewards/);
 const tab=f.navigationButtons().find(button=>button.dataset.profileTab==='activity');
 tab.matches=()=>false;
 f.listeners.click({target:{closest:()=>tab}});
 assert.equal(f.renders(),1);
 assert.equal(f.focus(),'more','a collapsed secondary tab must return focus to the visible disclosure');
 for(const hook of ['data-komi-daily-activity','data-komi-quest-rewards','data-komi-daily-refresh','data-quest-reward-id','daily-checkin'])assert.ok(f.html().includes(hook),hook);
});
test('shared profile does not gain owner controls even when the previous section was Activity',()=>{
 const f=fixture({owner:true,user:'Друг',section:'activity'});
 assert.equal(f.globals.profilePageSection,'overview');
 assert.doesNotMatch(f.html(),/data-profile-tab="activity"|data-profile-tab="history"|data-komi-daily-activity|data-profile-resume|data-profile-balance|id="profile-settings"/);
 assert.match(f.html(),/data-profile-share/);
 assert.match(f.html(),/data-profile-party/);
});
test('collection, folders, friends, wall, history and achievements retain their entry points',()=>{
 for(const [section,re] of [['anime',/Поиск в коллекции[\s\S]*Пример тайтла/],['history',/История просмотра[\s\S]*Продолжить с 4:00/],['achievements',/Все достижения/],['friends',/Открыть профиль/],['comments',/Стена сохранена/]]){
  assert.match(fixture({section}).html(),re,section);
 }
 const h=fixture({section:'anime'}).html();
 for(const word of ['Любимая папка','createCustomFolder','deleteCustomFolder','importLocalCustomFolders'])assert.ok(h.includes(word),word);
 assert.match(read('index.html'),/\/profile-studio\.css\?v=/);
});
test('profile summary distinguishes unavailable watch totals from a genuine empty collection',()=>{
 const h=fixture().html();
 assert.match(h,/class="profile-summary"/);
 assert.match(h,/data-profile-field="episodes"[^>]*>—/);
 assert.match(h,/data-profile-field="hours"[^>]*>—/);
 assert.ok(h.indexOf('class="profile-summary"')<h.indexOf('Разделы профиля'));
});
test('unverified history is absent from overview and has a loading state in its owner section',()=>{
 assert.doesNotMatch(fixture({resumeReady:false}).html(),/data-profile-resume/);
 const h=fixture({resumeReady:false,section:'history'}).html();
 assert.doesNotMatch(h,/data-profile-resume/);
 assert.match(h,/Загружаем историю просмотра/);
 assert.doesNotMatch(h,/data-profile-history-retry/);
});
test('history exposes an explicit retry only for the matching owner error and preserves ready progress',()=>{
 const resumeError={owner:'verified',username:'Komi'};
 const failed=fixture({resumeReady:false,resumeError,section:'history'});
 assert.match(failed.html(),/Не удалось загрузить историю/);
 assert.match(failed.html(),/data-profile-history-retry[^>]*>Повторить/);
 assert.doesNotMatch(failed.html(),/data-profile-resume|Загружаем историю просмотра/);
 let retries=0;
 failed.globals.retryKomiProfileHistory=async()=>{retries++;};
 const button={dataset:{},matches:selector=>selector==='[data-profile-history-retry]'};
 failed.listeners.click({target:{closest:()=>button}});
 assert.equal(retries,1,'the visible control must invoke the existing owner retry');
 for(const error of [{owner:'other-id',username:'Komi'},{owner:'verified',username:'Друг'}]){
  const pending=fixture({resumeReady:false,resumeError:error,section:'history'}).html();
  assert.match(pending,/Загружаем историю просмотра/);
  assert.doesNotMatch(pending,/data-profile-history-retry/);
 }
 const publicProfile=fixture({user:'Друг',resumeReady:false,resumeError,section:'history'}).html();
 assert.doesNotMatch(publicProfile,/data-profile-history-retry|data-profile-resume|Не удалось загрузить историю/);
 const ready=fixture({resumeReady:true,resumeError,section:'history'}).html();
 assert.match(ready,/data-profile-resume="1"/);
 assert.match(ready,/Продолжить с 4:00/);
 assert.doesNotMatch(ready,/Загружаем историю просмотра/);
});
test('overview list shortcuts clear stale search and open the requested collection with visible focus',()=>{
 const f=fixture();
 f.globals.profileCollectionSearchQuery='старый запрос';
 const button={dataset:{profileList:'В планах'},matches:()=>false,closest:selector=>selector==='#profile'?f.profile:null};
 f.listeners.click({target:{closest:()=>button}});
 assert.equal(f.globals.profilePageSection,'anime');
 assert.equal(f.globals.profileActiveTab,'В планах');
 assert.equal(f.globals.profileCollectionSearchQuery,'');
 assert.equal(f.focus(),'anime');
 assert.equal(f.renders(),1);
 button.dataset.profileList='чужая закрытая папка';
 f.listeners.click({target:{closest:()=>button}});
 assert.equal(f.globals.profileActiveTab,'В планах');
 assert.equal(f.renders(),1,'an unknown shortcut must not select an arbitrary folder');
});
