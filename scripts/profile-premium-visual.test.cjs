'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');

function adapter(premium=true){
 const scope={URL,location:{origin:'https://komianime.online'},document:{addEventListener(){}},
  KomiPremium:{isActiveName:()=>premium},userProfiles:{},
  userFavorites:{owner:Object.fromEntries(Array.from({length:8},(_,i)=>[i+1,true]))}};
 scope.window=scope;
 vm.runInNewContext(read('profile-premium.js'),scope);
 return {ui:scope.KomiProfileUI,ctx:{username:'owner',isMe:true,resumeReady:true,section:'overview',
  statsCounts:{'Смотрю':0,'В планах':0,'Просмотрено':8,'Отложено':0,'Брошено':0},myFriends:[],topGenres:[],
  profileAnimeById:new Map(Array.from({length:8},(_,i)=>[String(i+1),{id:i+1,title:'Аниме '+(i+1)}]))}};
}

test('profile header uses preserved avatar image and music capsule without oversized Premium panel',()=>{
 const app=read('app-main.js');
 assert.match(app,/<span class="profile-avatar-inner"><img src="\$\{safeProfileText\(komiSafeUrl\(p\.avatar\)/);
 assert.match(app,/class="profile-avatar-effects"/);
 assert.match(app,/data-profile-cover/);
 assert.match(app,/data-komi-profile-music-capsule hidden/);
 assert.match(app,/data-komi-profile-music-icon/);
 assert.ok(app.indexOf('data-komi-profile-music-capsule')>app.indexOf('profile-badges-row'));
 assert.doesNotMatch(app,/KOMI PREMIUM · ACTIVE|Особый статус в сообществе/);
 assert.match(app,/data-komi-premium-username/);
 assert.match(app,/KomiProfileUI\.summary/);
 const {ui}=adapter();
 const summary=ui.summary({level:6,xp:62,multiplier:1.5,titleCount:8,friendCount:0});
 assert.match(summary,/class="profile-xp-progress-track"/);
 assert.match(summary,/<progress max="500" value="62">62 из 500<\/progress>/);
 assert.match(summary,/class="profile-xp-multiplier is-premium">×1,5<\/span>/);
});

test('active Premium displays six saved favorites; standard accounts display three',()=>{
 for(const [premium,capacity] of [[true,6],[false,3]]){
  const {ui,ctx}=adapter(premium);
  const html=ui.content(ctx);
  const favorites=Array.from(html.matchAll(/data-profile-anime="(\d+)"/g),match=>Number(match[1]));
  assert.deepEqual(favorites,Array.from({length:capacity},(_,i)=>i+1));
  assert.doesNotMatch(html,/data-profile-add-favorite/,'a full showcase has no empty add tile');
  assert.equal(html.includes('data-premium-slots="6"'),premium);
 }
});

test('Web Audio remains opt-in with synced accessible playback controls',()=>{
 const decor=read('komi-premium-decor.js');
 assert.match(decor,/button\.addEventListener\('click'/);
 assert.match(decor,/\.isActiveId\?\.\(id\)/);
 assert.match(decor,/soundNames=\{1:'Тихий вечер',2:'Космический свет'\}/);
 assert.match(decor,/capsule\.hidden=true/);
 assert.match(decor,/aria-pressed/);
 assert.match(decor,/data-komi-profile-music-icon/);
 assert.doesNotMatch(decor,/autoplay|new Audio\(/i);
});

test('rendered production CSS contains complete scoped Premium styles and reduced motion',()=>{
 const css=read('profile-premium-mono.css');
 const bundle=read('komi.bundle.css');
 const prod=read('komi.production.css');
 for(const token of ['komi-premium-equalizer','komi-premium-xp-shimmer','komi-premium-cover-gradient',
   'profile-avatar-inner','profile-avatar-effects','profile-premium-slots-badge',
   'data-premium-slots="6"','komi-profile-music[data-playing="true"]'])assert.ok(css.includes(token),token);
 assert.ok(bundle.endsWith('/* --- profile-premium-mono.css --- */\n'+css+'\n'));
 assert.ok(prod.includes(bundle.trimEnd()));
 assert.match(css,/prefers-reduced-motion:reduce/);
 for(const frame of ['moon','aurora','noir','silver','frost','neon','orbit','eclipse',
   'prism','royal','pixel','halo']) assert.ok(css.includes('.profile-avatar-frame.komi-store-frame-'+frame),frame);
});
