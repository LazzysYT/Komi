'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const player=require('../player-core');

function adapter({progress={},favorites={'1':true},premium=true,document={addEventListener(){}}}={}){
  const sandbox={URL,location:{origin:'https://komianime.online'},document,
    userFavorites:{owner:favorites},userProfiles:{},komiEpisodeProgress:progress,
    KomiPremium:{isActiveName:()=>premium},KomiPlayerCore:player,
    komiAchievements:()=>({xp:0,badges:[],achievements:[]})};
  sandbox.window=sandbox;
  vm.createContext(sandbox);
  vm.runInContext(read('home-discovery.js'),sandbox);
  vm.runInContext(read('profile-premium.js'),sandbox);
  const base={username:'owner',isMe:true,resumeReady:true,section:'overview',canSeeProfileActivity:true,
    statsCounts:{'Смотрю':1,'В планах':0,'Просмотрено':0,'Отложено':0,'Брошено':0},
    topGenres:[],myFriends:[],profileAnimeById:new Map(Array.from({length:10},(_,i)=>[String(i+1),{id:i+1,title:'Аниме '+(i+1)}]))};
  return {ui:sandbox.KomiProfileUI,base,sandbox};
}
const progress=(overrides={})=>({index:0,season:1,time:30,duration:100,updated:10,...overrides});
const resumeIds=html=>Array.from(html.matchAll(/data-profile-resume="([^"]+)"/g),match=>match[1]);
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};

function historyLoader({ready=false,replies=[],queue=Promise.resolve()}={}){
  const started=deferred(),saved=progress();
  let renders=0,requests=0,cached=0;
  const state={Date:{now:()=>1000,parse:Date.parse},_supabase:{},
    currentUser:{authUserId:'owner-id',username:'owner'},komiCollectionLoadEpoch:0,
    komiResumeReadyUid:ready?'owner-id':null,komiResumeLoadError:null,komiSessionRestoreQueue:queue,
    userAnimeStatuses:{owner:{}},userFavorites:{owner:{}},userCustomFolders:{owner:{}},
    komiEpisodeProgress:{owner_1:saved},userWatchHistory:{owner_1:saved.time},
    async komiLoadAllOwnedRows(table){
      if(table!=='komi_watch_progress')return {data:[],error:null};
      requests++;started.resolve();
      return replies.length?await replies.shift():{data:[],error:null};
    },
    komiMergeCollectionMutations:(_kind,_uid,_started,data)=>data,
    render(){renders++;},komiStoreReadyResume(){cached++;},
    async komiHydrateSavedAnimeCards(){},async komiLoadCloudFolders(){},console:{warn(){}}};
  const app=read('app-main.js');
  const begin=app.indexOf('async function loadAuthenticatedAnimeData()');
  const end=app.indexOf('async function persistAuthenticatedStatus(',begin);
  assert.ok(begin>=0&&end>begin);
  vm.createContext(state);
  vm.runInContext(app.slice(begin,end),state);
  return {state,saved,started,renders:()=>renders,requests:()=>requests,cached:()=>cached};
}
const progressRows=id=>({data:[{anime_id:id,season:1,episode_index:0,position_seconds:45,duration_seconds:100,updated_at:'2026-11-25T00:00:00Z'}],error:null});
const ownerError=()=>({owner:'owner-id',username:'owner'});

test('all profile destinations remain visible and private owner tabs remain private',()=>{
  const {ui}=adapter();
  const owner=ui.navigation('overview',5,12,3,true,true);
  assert.deepEqual(Array.from(owner.matchAll(/data-profile-tab="([^"]+)"/g),match=>match[1]),['overview','anime','history','friends','achievements','activity','comments']);
  assert.doesNotMatch(owner,/profile-more/);
  const active=ui.navigation('achievements',5,12,3,true,true);
  assert.match(active,/<button[^>]*class="komi-profile-tab active"[^>]*data-profile-tab="achievements"[^>]*aria-pressed="true"[^>]*>/);
  const publicProfile=ui.navigation('overview',null,12,3,false,false);
  assert.doesNotMatch(publicProfile,/data-profile-tab="(?:history|activity)"/);
  assert.match(publicProfile,/data-profile-tab="friends"/);
});

test('zero, finished and invalid progress cannot displace unfinished episodes before the overview limit',()=>{
  const {ui,base}=adapter({progress:{
    owner_1:progress({time:0,updated:100}),
    owner_2:progress({time:95,updated:90}),
    owner_3:progress({time:30,updated:80}),
    owner_4:progress({time:17,duration:null,updated:70}),
    owner_5:progress({index:-1,updated:110}),
    owner_6:progress({time:Infinity,updated:120}),
    owner_7:progress({season:0,updated:130}),
    other_8:progress({updated:140}),
    owner_9:progress({updated:5})
  }});
  const html=ui.content(base);
  assert.deepEqual(resumeIds(html),['3','4']);
  assert.match(html,/Продолжить с 0:30/);
  assert.doesNotMatch(html,/Продолжить с 0:00/);
});

test('history distinguishes a first watch from a completed episode and remains private',()=>{
  const {ui,base}=adapter({progress:{owner_1:progress({time:0}),owner_2:progress({time:95,updated:9})}});
  const history=ui.content({...base,section:'history'});
  assert.deepEqual(resumeIds(history),['1','2']);
  assert.match(history,/Смотреть с начала/);
  assert.match(history,/Серия просмотрена/);
  assert.doesNotMatch(history,/Продолжить с 0:00/);
  assert.deepEqual(resumeIds(ui.content({...base,isMe:false,section:'history'})),[]);
  assert.match(ui.content({...base,isMe:false,section:'history'}),/доступна только владельцу/);
  assert.doesNotMatch(ui.content({...base,isMe:false,section:'history',resumeFailed:true}),/data-profile-history-retry|Не удалось/);
  assert.deepEqual(resumeIds(ui.content({...base,resumeReady:false})),[]);
  assert.deepEqual(resumeIds(ui.content({...base,resumeReady:false,section:'history'})),[]);
  assert.doesNotMatch(ui.content(base),/profile-continue-widget/,'there is no empty continue-watching panel');
});

test('resume labels and native links use the episode number shared by duplicate voice sources',()=>{
  const {ui,base}=adapter({progress:{owner_1:progress({index:1})}});
  base.profileAnimeById.set('1',{id:1,title:'Две озвучки',episodes:[
    {number:1,season:1,url:'https://example.org/one.mp4'},
    {number:1,season:1,url:'https://example.org/one-second.mp4'},
    {number:2,season:1,url:'https://example.org/two.mp4'}
  ]});
  const html=ui.content(base);
  assert.match(html,/Сезон 1 · Серия 1/);
  assert.match(html,/href="\/anime\/1\?season=1&amp;episode=1#player"/);
  assert.doesNotMatch(html,/Сезон 1 · Серия 2/);
});

test('favorite showcase renders saved titles and at most one add action without empty public slots',()=>{
  const {ui,base,sandbox}=adapter();
  const html=ui.content(base);
  assert.equal((html.match(/data-profile-anime=/g)||[]).length,1);
  assert.equal((html.match(/data-profile-add-favorite/g)||[]).length,1);
  sandbox.userFavorites.owner=Object.fromEntries([1,2,3,4,5,6].map(id=>[id,true]));
  const full=ui.content(base);
  assert.equal((full.match(/data-profile-anime=/g)||[]).length,6);
  assert.doesNotMatch(full,/data-profile-add-favorite/);
  sandbox.userFavorites.owner={};
  const stranger=ui.content({...base,isMe:false});
  assert.doesNotMatch(stranger,/data-profile-add-favorite|Пустой слот/);
  assert.match(stranger,/В избранном пока нет аниме/);
});

test('unknown metrics stay unavailable while verified zero stays numeric and account repaint is isolated',()=>{
  const fields={};
  for(const key of ['episodes','hours','meanScore']){
    const classes=new Set();
    fields[key]={textContent:'unchanged',dataset:{},classList:{add:name=>classes.add(name),remove:name=>classes.delete(name),contains:name=>classes.has(name)},
      removeAttribute:name=>{if(name==='data-profile-count')delete fields[key].dataset.profileCount;}};
  }
  const profile={dataset:{profileUser:'owner'},querySelector:selector=>fields[selector.match(/data-profile-field="([^"]+)"/)?.[1]]};
  const {ui}=adapter({document:{addEventListener(){},getElementById:()=>profile}});
  ui.metrics('owner',{episodes:null,hours:undefined,meanScore:'unknown'});
  for(const field of Object.values(fields)){
    assert.equal(field.textContent,'—');
    assert.equal(field.classList.contains('is-missing'),true);
    assert.equal(field.dataset.profileCount,undefined);
  }
  ui.metrics('owner',{episodes:0,hours:0,meanScore:0});
  for(const field of Object.values(fields)){
    assert.equal(field.textContent,'0');
    assert.equal(field.classList.contains('is-missing'),false);
    assert.equal(field.dataset.profileCount,'0');
  }
  ui.metrics('someone-else',{episodes:99,hours:99,meanScore:9});
  assert.equal(fields.episodes.textContent,'0');
  ui.metrics('owner',{episodes:-1,hours:Infinity,meanScore:NaN});
  assert.equal(fields.episodes.textContent,'—');
  assert.equal(fields.hours.textContent,'—');
  assert.equal(fields.meanScore.textContent,'—');
});

test('opening another profile clears private folder and search state while reopening the same one preserves it',()=>{
  const app=read('app-main.js');
  const start=app.indexOf('function openProfile(username) {');
  const end=app.indexOf('async function komiCopyProfileLink()',start);
  assert.ok(start>0&&end>start);
  const routes=[];
  const state={currentUser:{username:'owner'},profileTargetUser:'owner',currentView:'profile',slideInterval:null,
    profilePageSection:'anime',profileActiveTab:'Личная папка',profileCollectionSearchQuery:'мой запрос',
    document:{documentElement:{dataset:{}}},location:{pathname:'/profile',search:'',hash:''},
    history:{pushState:(_a,_b,route)=>routes.push(route)},render(){},openAuthModal(){},clearInterval(){},encodeURIComponent};
  vm.createContext(state);
  vm.runInContext(app.slice(start,end),state);
  state.openProfile('owner');
  assert.equal(state.profilePageSection,'anime');
  assert.equal(state.profileActiveTab,'Личная папка');
  assert.equal(state.profileCollectionSearchQuery,'мой запрос');
  state.openProfile('friend');
  assert.equal(state.profileTargetUser,'friend');
  assert.equal(state.profilePageSection,'overview');
  assert.equal(state.profileActiveTab,'Просмотрено');
  assert.equal(state.profileCollectionSearchQuery,'');
  assert.deepEqual(routes,['/profile?profile=friend']);
});

test('history refresh failure preserves verified progress and a successful retry clears the owner error',async()=>{
  const f=historyLoader({ready:true,replies:[{data:[],error:Error('offline')},progressRows(2)]});
  await f.state.loadAuthenticatedAnimeData();
  assert.equal(f.state.komiResumeReadyUid,'owner-id');
  assert.equal(f.state.komiEpisodeProgress.owner_1,f.saved);
  assert.equal(f.state.userWatchHistory.owner_1,30);
  assert.equal(f.state.komiResumeLoadError.owner,'owner-id');
  assert.equal(f.state.komiResumeLoadError.username,'owner');
  assert.equal(f.cached(),0,'failed progress must not replace the verified cache');
  const retry=f.state.retryKomiProfileHistory();
  assert.equal(f.state.komiResumeLoadError,null,'retry consumes the error before waiting');
  assert.equal(await retry,true);
  assert.equal(f.state.komiResumeLoadError,null);
  assert.equal(f.state.komiEpisodeProgress.owner_2.time,45);
  assert.equal(f.state.komiEpisodeProgress.owner_1,undefined);
  assert.equal(f.cached(),1);
});

test('history retry joins the restore queue and repeated clicks issue only one load',async()=>{
  const gate=deferred(),f=historyLoader({queue:gate.promise,replies:[progressRows(2)]});
  f.state.komiResumeLoadError=ownerError();
  const pending=f.state.retryKomiProfileHistory();
  assert.equal(f.state.komiResumeLoadError,null);
  assert.equal(f.renders(),1,'the first click immediately renders a pending state');
  assert.equal(await f.state.retryKomiProfileHistory(),undefined);
  assert.equal(f.requests(),0,'the existing restore must finish before the retry loads');
  gate.resolve();
  assert.equal(await pending,true);
  assert.equal(f.requests(),1);
  assert.equal(f.renders(),2);
});

test('a rejected progress request leaves a retryable owner error instead of permanent loading',async()=>{
  const response=deferred(),f=historyLoader({replies:[response.promise]});
  f.state.komiResumeLoadError=ownerError();
  const pending=f.state.retryKomiProfileHistory();
  await f.started.promise;
  response.reject(Error('connection closed'));
  assert.equal(await pending,false);
  assert.equal(f.state.komiResumeReadyUid,null);
  assert.equal(f.state.komiResumeLoadError.owner,'owner-id');
  assert.equal(f.state.komiResumeLoadError.username,'owner');
  assert.equal(f.renders(),2);
});

test('retry refuses missing auth and errors belonging to another identity',async()=>{
  for(const [currentUser,error] of [
    [null,ownerError()],
    [{username:'owner'},ownerError()],
    [{authUserId:'owner-id',username:'owner'},null],
    [{authUserId:'other-id',username:'owner'},ownerError()],
    [{authUserId:'owner-id',username:'changed'},ownerError()]
  ]){
    const f=historyLoader();
    f.state.currentUser=currentUser;f.state.komiResumeLoadError=error;
    assert.equal(await f.state.retryKomiProfileHistory(),undefined);
    assert.equal(f.requests(),0);
    assert.equal(f.renders(),0);
    assert.equal(f.state.komiResumeLoadError,error);
  }
});

test('changing account or username before a queued retry prevents the request',async()=>{
  for(const next of [{authUserId:'other-id',username:'owner'},{authUserId:'owner-id',username:'changed'}]){
    const gate=deferred(),f=historyLoader({queue:gate.promise});
    f.state.komiResumeLoadError=ownerError();
    const pending=f.state.retryKomiProfileHistory();
    const nextError={owner:next.authUserId,username:next.username};
    f.state.currentUser=next;f.state.komiResumeLoadError=nextError;
    gate.resolve();
    assert.equal(await pending,undefined);
    assert.equal(f.requests(),0);
    assert.equal(f.renders(),1);
    assert.equal(f.state.komiResumeLoadError,nextError);
  }
});

test('an old retry response cannot repaint or set an error after the account changes',async()=>{
  for(const next of [{authUserId:'other-id',username:'owner'},{authUserId:'owner-id',username:'changed'}]){
    const response=deferred(),f=historyLoader({replies:[response.promise]});
    f.state.komiResumeLoadError=ownerError();
    const pending=f.state.retryKomiProfileHistory();
    await f.started.promise;
    const nextError={owner:next.authUserId,username:next.username};
    f.state.currentUser=next;f.state.komiResumeLoadError=nextError;
    response.resolve({data:[],error:Error('late failure')});
    assert.equal(await pending,undefined);
    assert.equal(f.renders(),1);
    assert.equal(f.state.komiResumeLoadError,nextError);
    assert.equal(f.state.komiResumeReadyUid,null);
  }
});

test('an older failed history load cannot replace a newer successful load for the same owner',async()=>{
  const older=deferred(),f=historyLoader({replies:[older.promise,progressRows(2)]});
  const pending=f.state.loadAuthenticatedAnimeData();
  await f.state.loadAuthenticatedAnimeData();
  assert.equal(f.state.komiResumeReadyUid,'owner-id');
  assert.equal(f.state.komiEpisodeProgress.owner_2.time,45);
  older.resolve({data:[],error:Error('stale request')});
  await pending;
  assert.equal(f.state.komiResumeLoadError,null);
  assert.equal(f.state.komiEpisodeProgress.owner_2.time,45);
  assert.equal(f.renders(),1);
  assert.equal(f.cached(),1);
});
