'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
function setup(){
 const output={textContent:''},status={textContent:''},streak={textContent:''};
 const shell={dataset:{profileWeekOwner:'owner-a'},getAttribute:()=>null,querySelector:key=>({
   '[data-profile-week-episodes]':output,'[data-profile-week-status]':status,'[data-profile-week-streak]':streak
 }[key]||null)};
 const requests=[],replies=[];
 const from=table=>{
   const payload={table,filters:{}}; requests.push(payload);
   const chain={select(fields,options){Object.assign(payload,{fields,options});return chain;},
     eq(k,v){payload.filters[k]=v;return chain;},gte(k,v){payload.filters['from:'+k]=v;return chain;},
     lte(k,v){payload.filters['through:'+k]=v;return chain;},order(){return chain;},
     limit(v){payload.limit=v;return chain;},abortSignal(){return replies.shift();}};
   return chain;
 };
 const c=vm.createContext({URL,location:{origin:'https://komianime.online'},AbortController,setTimeout,clearTimeout,
   currentUser:{authUserId:'owner-a',username:'owner'},userAnimeStatuses:{owner:{1:'Просмотрено',2:'В планах'}},
   userFavorites:{},userProfiles:{},_supabase:{from},
   document:{addEventListener(){},querySelector:k=>k==='[data-profile-week-owner]'?shell:null}});
 c.window=c;
 vm.runInContext(read('profile-premium.js'),c);
 const src=read('app-main.js');
 vm.runInContext(src.slice(src.indexOf('const komiProfileOverviewWatch'),src.indexOf('// Quest XP always comes')),c);
 return {c,output,status,shell,requests,replies};
}
const clean=x=>JSON.parse(JSON.stringify(x));
const animeById=new Map([['1',{genres:['Фэнтези','фэнтези',{russian:'Драма'}]}],
 ['2',{genres:['Комедия']}],['3',{genres:['Драма']}]]);
test('genres count distinct viewed titles or explicit completed list items, not plans or duplicated tags',()=>{
 const {c}=setup();
 const r=c.komiProfileOverviewGenres({1:'Просмотрено',2:'В планах'},animeById,['3','3','1']);
 assert.deepEqual(clean(r),[['Драма',2],['Фэнтези',1]]);
});
test('overview keeps status shortcuts, empty state and only shows activity to its verified owner',()=>{
 const {c}=setup();
 const base={username:'owner',isMe:true,activityOwner:'owner-a',canSeeProfileActivity:true,section:'overview',
   statsCounts:{},profileAnimeById:animeById,myFriends:[],topGenres:[]};
 const owner=c.KomiProfileUI.content(base);
 assert.equal((owner.match(/class="profile-list-shortcut"/g)||[]).length,5);
 assert.match(owner,/data-profile-list="Отложено"/);
 assert.match(owner,/data-profile-week-owner="owner-a"/);
 assert.match(owner,/Появятся после первых просмотренных серий/);
 assert.doesNotMatch(owner,/0% коллекции|Оценки/);
 const publicView=c.KomiProfileUI.content({...base,isMe:false,topGenres:[['Драма',3]]});
 assert.match(publicView,/data-profile-genre="Драма"/);
 assert.doesNotMatch(publicView,/owner-a|data-profile-week-episodes|Задания и награды/);
});
test('weekly read is owner-filtered, counts precisely, caches, and uses the UTC week boundary',async()=>{
 const {c,shell,output,requests,replies}=setup();
 assert.equal(c.komiProfileWeekStart(new Date('2026-11-29T23:59:59Z')),'2026-11-23T00:00:00.000Z');
 await c.komiProfileOverviewRead('wrong-owner',animeById);assert.equal(requests.length,0);
 shell.dataset.profileWeekOwner='wrong-owner';
 await c.komiProfileOverviewRead('owner-a',animeById);assert.equal(requests.length,0);
 shell.dataset.profileWeekOwner='owner-a';
 replies.push(Promise.resolve({count:0}),Promise.resolve({data:[{anime_id:3},{anime_id:3}]}));
 await c.komiProfileOverviewRead('owner-a',animeById);
 assert.equal(output.textContent,'0');
 assert.equal(requests.length,2);
 assert.ok(requests.every(q=>q.table==='komi_watched_episodes'&&q.filters.user_id==='owner-a'));
 assert.equal(requests[0].options.head,true);assert.equal(requests[0].options.count,'exact');
 assert.equal(requests[1].limit,200);
 await c.komiProfileOverviewRead('owner-a',animeById);
 assert.equal(requests.length,2,'no duplicate request while cache is fresh');
});
test('pending private results cannot repaint after switching the authenticated account',async()=>{
 const {c,shell,output,replies}=setup();
 let release;
 replies.push(new Promise(resolve=>{release=resolve;}),Promise.resolve({data:[]}));
 const pending=c.komiProfileOverviewRead('owner-a',animeById);
 assert.equal(output.textContent,'—');
 c.currentUser={authUserId:'owner-b',username:'someone'};
 shell.dataset.profileWeekOwner='owner-b';
 release({count:99});await pending;
 assert.equal(output.textContent,'—');
});

test('an owner can retry a failed weekly request without pretending the count is zero',async()=>{
 const {c,output,status,replies,requests}=setup();
 replies.push(Promise.reject(new Error('offline')),Promise.resolve({data:[]}));
 await c.komiProfileOverviewRead('owner-a',animeById);
 assert.equal(output.textContent,'—');
 assert.match(status.textContent,/Не удалось/);
 replies.push(Promise.resolve({count:8}),Promise.resolve({data:[]}));
 await c.komiProfileOverviewRead('owner-a',animeById,true);
 assert.equal(output.textContent,'8');assert.equal(status.textContent,'');
 assert.equal(requests.length,4);
});
