'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');

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
 assert.match(app,/profile-xp-progress-track/);
 assert.match(app,/profile-xp-multiplier/);
});

test('active Premium unlocks six favorite slots; standard accounts get three',()=>{
 const ui=read('profile-premium.js');
 assert.match(ui,/slice\(0,premiumShowcase\?6:3\)/);
 assert.match(ui,/favoriteLimit=premiumShowcase\?6:3/);
 assert.match(ui,/data-premium-slots="6"/);
 assert.match(ui,/✦ 6 слотов/);
 assert.match(ui,/data-profile-add-favorite/);
 assert.match(ui,/data-profile-anime/);
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
