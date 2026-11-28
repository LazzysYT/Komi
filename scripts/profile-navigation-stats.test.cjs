'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'..','profile-premium.js'),'utf8');
function harness({episodes=12,seconds=2460,fail=false,timeFail=false}={}){
 const fields={episodes:{classList:{toggle(){}},removeAttribute(){}},hours:{classList:{toggle(){}},removeAttribute(){}}},retry={};
 const profile={dataset:{profileOwner:'true',profilePreview:'false',profileUser:'owner'},querySelector(selector){if(selector.includes('episodes'))return fields.episodes;if(selector.includes('hours'))return fields.hours;if(selector.includes('retry'))return retry;return null;},querySelectorAll(){return [];}};

 const mock={from(table){const q={select(){return q;},eq(){return q;},abortSignal(){assert.equal(table,'komi_watched_episodes');const count=episodes;return Promise.resolve(fail?{error:new Error('offline')}:{count});}};return q;},rpc(name,p){assert.equal(name,'komi_read_profile_watch_seconds');assert.equal(p.p_owner,'uid');return {abortSignal:()=>Promise.resolve(fail||timeFail?{error:new Error('offline')}:{data:seconds})};}};
 const win={},ctx={window:win,document:{addEventListener(){},getElementById(){return profile;}},currentUser:{username:'owner',authUserId:'uid'},_supabase:mock,AbortController,setTimeout,clearTimeout,URL};
 vm.runInNewContext(source.replace('root.KomiProfileUI={guest,','root.KomiProfileUI={readViewingStats,guest,'),ctx);
 return {ui:win.KomiProfileUI,profile,fields,retry,ctx};
}
test('XP and all profile navigation sections',()=>{const {ui}=harness();assert.match(ui.summary({level:6,xp:85,canReadMetrics:true}),/До уровня 7: 415 XP/);assert.match(ui.summary({canReadMetrics:true}),/Загрузка…/);assert.match(ui.summary({canReadMetrics:false}),/Недоступно/);assert.equal(ui.viewingTime(0),'0 мин');assert.equal(ui.viewingTime(1),'1 сек');assert.equal(ui.viewingTime(60),'1 минута');assert.equal(ui.viewingTime(3660),'1 ч 1 мин');const owner=ui.navigation('overview',1,3,4,true,true);for(const id of ['overview','anime','history','friends','achievements','activity','comments'])assert.ok(owner.includes('data-profile-tab="'+id+'"'));assert.doesNotMatch(owner,/profile-more/);assert.doesNotMatch(ui.navigation('overview',null,null,null,false,false),/data-profile-tab="(?:history|activity)"/);});
test('verified statistics format actual zero and tracked time',async()=>{for(const opt of [{},{episodes:0,rewards:0,seconds:0}]){const x=harness(opt);await x.ui.readViewingStats(x.profile);assert.equal(x.fields.episodes.textContent,opt.episodes===0?'0':'12');assert.equal(x.fields.hours.textContent,opt.episodes===0?'0 мин':'41 мин');assert.equal(x.retry.hidden,true);}});
test('errors for either statistic never fabricate values',async()=>{const x=harness({fail:true});await x.ui.readViewingStats(x.profile);assert.equal(x.fields.episodes.textContent,'Недоступно');assert.equal(x.fields.hours.textContent,'Недоступно');assert.equal(x.retry.hidden,false);const y=harness({timeFail:true});await y.ui.readViewingStats(y.profile);assert.equal(y.fields.episodes.textContent,'12');assert.equal(y.fields.hours.textContent,'Недоступно');assert.equal(y.retry.hidden,false);});
test('preview never fetches or displays private metrics',async()=>{const x=harness();x.profile.dataset.profilePreview='true';await x.ui.readViewingStats(x.profile);assert.equal(x.fields.episodes.textContent,undefined);assert.doesNotMatch(x.ui.summary({preview:true}),/data-profile-field|500 XP/);});
