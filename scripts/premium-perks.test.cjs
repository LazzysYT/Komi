'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');

test('Premium appears in Komi rail, SPA route and public features page',()=>{
  const html=read('index.html'),app=read('app-main.js'),staticEvents=read('static-ui-events.js');
  assert.match(html,/id="sidePremiumBtn"/);
  assert.match(html,/data-komi-click="premium"/);
  assert.match(staticEvents,/case 'click:premium'/);
  assert.match(app,/currentView === 'premium'/);
  const ui=read('komi-premium.js');
  for(const feature of ['Анимированные аватары','Живой фон профиля','2000 XP','500 AniCoin'])
    assert.ok(ui.includes(feature),feature);
});

test('one-time server bonus cannot be faked by browser or repeated on renewal',()=>{
  const sql=read('supabase/migrations/20261119135500_premium_perks_and_animated_media.sql');
  const app=read('app-main.js');
  const ui=read('komi-premium.js');
  assert.match(sql,/PRIMARY KEY REFERENCES auth\.users/);
  assert.match(sql,/ON CONFLICT \(user_id\) DO NOTHING/);
  assert.match(sql,/AFTER INSERT OR UPDATE OF active_until ON public\.komi_premium_badges/);
  assert.match(sql,/premium_welcome/);
  assert.match(sql,/VALUES \(NEW\.user_id, NEW\.coins_awarded\)/);
  assert.match(sql,/VALUES \(NEW\.user_id, NEW\.coins_awarded, 'premium_welcome'\)/);
  assert.match(sql,/REVOKE ALL ON public\.komi_premium_rewards FROM PUBLIC, anon, authenticated/);
  assert.match(ui,/komi_premium_rewards/);
  assert.doesNotMatch(ui,/\.(?:insert|update|upsert)\(/);
  assert.match(app,/xpForUsername\(username\)/);
  assert.match(app,/Math\.floor\(xp\/500\)\+1/);
  assert.match(app,/KomiProfileUI\.summary/);
  const scope={window:{},document:{addEventListener(){}}};
  vm.runInNewContext(read('profile-premium.js'),scope);
  const summary=scope.window.KomiProfileUI.summary({level:6,xp:62,multiplier:1.5,titleCount:0,friendCount:0});
  assert.match(summary,/<progress max="500" value="62">62 из 500<\/progress>/);
});

test('GIF media can be uploaded only while premium is active, via RLS, and not edit bonus',()=>{
  const sql=read('supabase/migrations/20261119135500_premium_perks_and_animated_media.sql');
  const upload=read('komi-premium-media.js');
  assert.match(sql,/CREATE POLICY "Komi premium own animated avatar"/);
  assert.match(sql,/CREATE POLICY "Komi premium own animated profile background"/);
  assert.match(sql,/CREATE POLICY "premium user inserts own media"/);
  assert.match(sql,/CREATE POLICY "premium user updates own media"/);
  assert.match(sql,/GRANT UPDATE\(avatar_path,background_path\)/);
  assert.match(sql,/Active badge SELECT policy filters expired rows/);
  assert.match(upload,/GIF87a/);
  assert.match(upload,/GIF89a/);
  assert.match(upload,/client\.auth\.getUser\(\)/);
  assert.match(upload,/client\.storage\.from\(bucket\)\.upload/);
  assert.doesNotMatch(upload,/komi_premium_badges.*(?:insert|update)|komi_premium_rewards.*(?:insert|update)/);
});

test('watch-time rewards remain one coin per 1200 real playback seconds',()=>{
  const s=read('anicoin.js');
  assert.match(s,/max="1200"/);
  assert.match(s,/timeupdate/);
  assert.match(s,/video\.playbackRate <= 1\.05/);
  assert.match(s,/data-komi-coin-embed-start/);
  assert.match(s,/aniCoinStartEmbed\(\)/);
  assert.match(s,/aniCoinStopEmbed\(\)/);
});

test('premium CSS bundle contains its generated last layer and checkout terms are clear',()=>{
  const css=read('profile-premium-mono.css');
  const bundle=read('komi.bundle.css');
  assert.ok(bundle.endsWith(css+'\n'));
  assert.match(css,/\.komi-premium-perks-grid/);
  assert.match(css,/\.komi-premium-media-inputs/);
  assert.match(read('premium.html'),/2000 XP/);
  assert.match(read('premium.html'),/500 AniCoin/);
});
