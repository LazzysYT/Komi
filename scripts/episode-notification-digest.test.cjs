const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const app=fs.readFileSync(path.join(__dirname,'../app-main.js'),'utf8');
const from=app.indexOf('function komiRecentEpisodeDigest(');
const to=app.indexOf('function updateNotificationsUI()',from);
assert.ok(from>=0&&to>from,'Recent watched-anime digest function missing');
const ctx=vm.createContext({Date,Number,String,Set});
vm.runInContext(app.slice(from,to),ctx);
function digest(statuses,catalog,now){
 ctx.__statuses=statuses;ctx.__catalog=catalog;ctx.__now=now;
 return Array.from(vm.runInContext('komiRecentEpisodeDigest(__statuses,__catalog,__now)',ctx),x=>({
   id:x.id,title:x.title,episodeCount:x.episodeCount,updated:x.updated
 }));
}
const now=Date.parse('2026-11-19T15:00:00Z');
const record=(id,title,daysAgo,episodeCount=12)=>({
 id:String(id),title,episodeCount,
 lastEpisodeAddedAt:new Date(now-daysAgo*86400000).toISOString()
});
test('recent show updates include only saved watched/planned anime with actual episode data',()=>{
 const rows=[record(101,'Серия из списка',1,8),record(102,'Другой релиз',4,5),
   record(103,'Не в списке',1),record(104,'Слишком старый',30),
   record(105,'Нет серии',1,0),record(106,'Будущий',-1),record(107,'Неверный статус',2)];
 const found=digest({'101':'Смотрю','102':'В планах','104':'Смотрю','105':'Смотрю','106':'Смотрю','107':'Брошено'},rows,now);
 assert.deepEqual(found.map(x=>x.id),['101','102']);
 assert.deepEqual(found.map(x=>x.episodeCount),[8,5]);
});
test('digest deduplicates cards, validates IDs and never invents missing poster/title/episode records',()=>{
 const rows=[record(11,'Дублирован',3),record(11,'Повтор',1),record('abc','Bad',2),
   record(20,'',1),record(30,'Нет даты',2)];
 delete rows[4].lastEpisodeAddedAt;
 const found=digest({'11':'Смотрю','20':'Смотрю','30':'Смотрю'},rows,now);
 assert.equal(found.length,1);
 assert.equal(found[0].title,'Дублирован');
});
test('digest uses only the authenticated owner list without creating unread notifications',()=>{
 assert.match(app,/komiRecentEpisodeDigest\(userAnimeStatuses\[currentUser\.username\] \|\| \{\}, animeList\)/);
 assert.match(app,/requestMarkup \+ noticeMarkup \+ digestMarkup/);
 assert.match(app,/href="\/anime\/' \+ entry\.id/);
 assert.match(app,/escapeFriendHtml\(entry\.title\)/);
 assert.doesNotMatch(app.slice(from,to),/\.from\(|\.rpc\(|\.insert\(|aniCoin|premium/i);
});
