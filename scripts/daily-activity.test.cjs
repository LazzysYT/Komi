const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');

const root=path.join(__dirname,'..');
const script=fs.readFileSync(path.join(root,'app-main.js'),'utf8');
const actions=fs.readFileSync(path.join(root,'static-ui-events.js'),'utf8');
const migration=fs.readFileSync(path.join(root,'supabase/migrations/20261119173000_daily_activity_checkins.sql'),'utf8');
const a=script.indexOf('const komiDailyActivityState =');
const b=script.indexOf('function safeProfileText(',a);
assert.ok(a>=0&&b>a,'Activity helper block is present');
const helper=script.slice(a,b);
const utcDay=new Date().toISOString().slice(0,10);
const payload=(checked_today,streak_days,total_days)=>({server_day:utcDay,checked_today,streak_days,total_days});

function fixture(rpc) {
 let domOwner='user-a';
 const fields=Object.fromEntries(['[data-komi-daily-streak]','[data-komi-daily-total]',
   '[data-komi-daily-status]','[data-komi-click="daily-checkin"]'].map(key=>[key,{textContent:'',disabled:false}]));
 const panel={getAttribute:()=>domOwner,querySelector:key=>fields[key]||null};
 const context=vm.createContext({
   currentUser:{authUserId:'user-a'},_supabase:{rpc},
   document:{querySelector:key=>key==='[data-komi-daily-activity]'?panel:null},
   Date,Math,Number,String,Error,console:{warn(){}}
 });
 vm.runInContext(helper,context);
 return {context,fields,setPanelOwner:value=>{domOwner=value},
   read:()=>vm.runInContext('komiDailyActivityRead()',context),
   claim:()=>vm.runInContext('komiDailyActivityCheckin()',context),
   state:()=>vm.runInContext('({owner:komiDailyActivityState.owner,data:komiDailyActivityState.data,error:komiDailyActivityState.error})',context)};
}

test('daily check-in has owner-only storage, fixed actions and no client awards',()=>{
 assert.match(migration,/primary key \(user_id, activity_day\)/);
 assert.match(migration,/enable row level security/i);
 assert.match(migration,/revoke all on table komi_private\.daily_activity_checkins from public, anon, authenticated/i);
 assert.match(migration,/actor uuid := auth\.uid\(\)/);
 assert.match(migration,/values \(actor, today_utc\)/);
 assert.match(migration,/on conflict \(user_id, activity_day\) do nothing/);
 assert.match(migration,/p_action not in \('read','checkin'\)/);
 assert.match(migration,/revoke all on function public\.komi_daily_activity\(text\) from public, anon, authenticated/);
 assert.match(migration,/grant execute on function public\.komi_daily_activity\(text\) to authenticated/);
 assert.doesNotMatch(migration,/\b(insert into public\.komi_anicoin|update public\.komi_premium|grant.*anon.*execute)/i);
 assert.match(script,/data-komi-daily-activity=/);
 assert.match(actions,/case 'click:daily-checkin': return komiDailyActivityCheckin\(\)/);
});

test('optional daily activity is never requested without verified auth',async()=>{
 const calls=[];
 const x=fixture(async (...args)=>{calls.push(args);return {data:payload(false,0,0),error:null};});
 x.context.currentUser=null;
 await x.read(); await x.claim();
 assert.equal(calls.length,0);
});

test('successful read and mark use server-provided counts without duplicate claims',async()=>{
 const calls=[];
 const x=fixture(async (name,args)=>{
   calls.push([name,args.p_action]);
   return {data:args.p_action==='checkin'?payload(true,1,1):payload(false,0,0),error:null};
 });
 await x.read();
 assert.equal(x.fields['[data-komi-daily-total]'].textContent,'0');
 assert.equal(x.fields['[data-komi-click="daily-checkin"]'].disabled,false);
 await x.claim();
 assert.equal(x.fields['[data-komi-daily-total]'].textContent,'1');
 assert.equal(x.fields['[data-komi-daily-streak]'].textContent,'1');
 assert.equal(x.fields['[data-komi-click="daily-checkin"]'].disabled,true);
 await x.claim();
 assert.deepEqual(calls,[['komi_daily_activity','read'],['komi_daily_activity','checkin']]);
});

test('failed read cannot fabricate an activity or mark',async()=>{
 const x=fixture(async()=>({data:null,error:{message:'Offline'}}));
 await x.read();
 assert.equal(x.state().data,null);
 assert.match(x.fields['[data-komi-daily-status]'].textContent,/недоступна/i);
 assert.equal(x.fields['[data-komi-click="daily-checkin"]'].textContent,'Повторить');
});

test('a pending response from an old account never reaches the next user',async()=>{
 let resolveA;
 const deferredA=new Promise(resolve=>{resolveA=resolve});
 const x=fixture(async(name,args)=>{
   if(x.context.currentUser.authUserId==='user-a')return deferredA;
   return {data:payload(false,0,5),error:null};
 });
 const pending=x.read();
 x.context.currentUser={authUserId:'user-b'};
 x.setPanelOwner('user-b');
 await x.read();
 resolveA({data:payload(true,77,77),error:null});
 await pending;
 assert.equal(x.state().owner,'user-b');
 assert.equal(x.state().data.total_days,5);
 assert.equal(x.fields['[data-komi-daily-total]'].textContent,'5');
});
