'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const dir=path.join(__dirname,'..');
const src=file=>fs.readFileSync(path.join(dir,file),'utf8');

function renderAdapter() {
  const sandbox={
    window:{matchMedia:()=>({matches:true})},
    document:{addEventListener:()=>{}},
    location:{origin:'https://komianime.online'},
    URL,
    userFavorites:{owner:{'123':true}},
    userProfiles:{friend:{displayName:'Друг'}},
    komiEpisodeProgress:{owner_123:{index:2,season:1,time:125,duration:1000,updated:1795000000000}},
    komiAchievements:()=>({xp:150,badges:['Первый просмотр']})
  };
  vm.runInNewContext(src('profile-premium.js'),sandbox);
  const ui=sandbox.window.KomiProfileUI;
  const base={
    username:'owner',isMe:true,statsCounts:{'Смотрю':1,'В планах':0,'Просмотрено':1,'Отложено':0,'Брошено':0},
    topGenres:[['Фэнтези',2]],myFriends:['friend'],
    profileAnimeById:new Map([['123',{id:'123',title:'Anime test',poster:'https://example.org/p.png'}]])
  };
  return {ui,base};
}

test('premium release adapter loaded ahead of app-main without replacing auth and database',()=>{
  const html=src('index.html');
  assert.ok(html.indexOf('profile-premium.js')<html.indexOf('app-main.js'));
  assert.equal((html.match(/<script src="\.\/profile-premium\.js(?:\?v=[A-Za-z0-9._-]+)?"><\/script>/g)||[]).length,1);
  const app=src('app-main.js');
  for(const feature of ['id="profile"','data-profile-cover','data-profile-balance','profile-settings',
    'KomiProfileUI.navigation','KomiProfileUI.content','handleAvatarFileUpload(event)','updateUserProfile(this)'])
    assert.ok(app.includes(feature),feature+' missing');
  assert.ok(src('dynamic-ui-events.js').includes("['overview','anime','history','achievements','friends','comments']"));
});

test('owner gets real saved history, but public visitor never sees it',()=>{
  const {ui,base}=renderAdapter();
  const own=ui.content({...base,section:'history'});
  assert.match(own,/История просмотра/);
  assert.match(own,/Anime test/);
  assert.match(own,/Серия 3/);
  const stranger=ui.content({...base,isMe:false,section:'history'});
  assert.match(stranger,/доступна только владельцу/);
  assert.doesNotMatch(stranger,/Anime test|125|Серия 3/);
});

test('overview exposes truthful statistics, favorite preview, friends and achievements',()=>{
  const {ui,base}=renderAdapter();
  const html=ui.content({...base,section:'overview'});
  for(const phrase of ['Статистика просмотра','Продолжить просмотр','Любимые жанры','Витрина достижений','Топ избранного','Друзья','Anime test'])
    assert.ok(html.includes(phrase),phrase);
  assert.match(html,/data-profile-field="episodes">0/);
  assert.match(html,/data-profile-field="hours">0/);
  assert.match(html,/data-profile-field="meanScore">0/);
  assert.match(html,/--profile-segment:#F1F1F1/);
});

test('profile adapter escapes titles and rejects executable poster sources',()=>{
  const {ui,base}=renderAdapter();
  base.profileAnimeById=new Map([['123',{id:'123',title:'<img src=x onerror=alert(1)>',poster:'javascript:alert(1)'}]]);
  const html=ui.content({...base,section:'overview'});
  assert.ok(html.includes('&lt;img'));
  assert.doesNotMatch(html,/<img src=x onerror/);
  assert.doesNotMatch(html,/src="javascript:/);
  assert.doesNotMatch(src('profile-premium.js'),/\beval\s*\(|new Function\b/);
});

test('profile is monochrome and does not recolor posters or videos',()=>{
  const style=src('komi-black-white.css').split('/* Imported premium dashboard from user')[1];
  assert.ok(style,'premium CSS section missing');
  assert.doesNotMatch(style,/#[a-f0-9]{0,4}(ff454f|e5344b)/i);
  assert.doesNotMatch(style,/(?:filter|backdrop-filter):\s*grayscale/i);
  assert.match(style,/prefers-reduced-motion:reduce/);
});
