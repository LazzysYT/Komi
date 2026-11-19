const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../app-main.js'),'utf8');
const start=source.indexOf('function komiProfileQuests(');
const end=source.indexOf('function safeProfileText(',start);
assert.ok(start>=0&&end>start,'Quest helper missing');
const context=vm.createContext({});
vm.runInContext(source.slice(start,end),context);
function quests(statuses,favorites){
  context.__statuses=statuses;
  context.__favorites=favorites;
  return vm.runInContext('komiProfileQuests(__statuses,__favorites)',context);
}
test('free profile quests are based solely on real owned status and favorite counts',()=>{
 const initial=quests({},{});
 assert.equal(initial.length,4);
 assert.deepEqual(Array.from(initial,q=>q.value),[0,0,0,0]);
 const progress=quests({'1':'Смотрю','2':'Просмотрено','3':'В планах','4':'Отложено','5':'Брошено'}, {'2':'Любимые'});
 assert.deepEqual(Array.from(progress,q=>q.value),[1,5,1,1]);
 assert.deepEqual(Array.from(progress,q=>q.target),[1,5,1,1]);
});
test('unknown status and duplicate favorite categories cannot make fake milestones',()=>{
 const q=quests({'1':'Сломано','2':'Просмотрено','3':null}, {'2':'Любимые'});
 assert.equal(q[0].value,1);
 assert.equal(q[1].value,1);
 assert.equal(q[2].value,1);
 assert.equal(q[3].value,1);
});
test('quests are shown only for verified owner, without client XP or wallet grants',()=>{
 assert.match(source,/const profileQuests = isMe && currentUser\?\.authUserId \?/);
 assert.doesNotMatch(source,/data-komi-quests/, 'Duplicate quest row should be absent above profile tabs');
 const bento=fs.readFileSync(path.join(__dirname,'../profile-premium.js'),'utf8');
 assert.match(bento,/data-komi-quests/, 'Achievement progress now belongs inside Bento widget');
 assert.doesNotMatch(source.slice(start,end),/\.rpc\(|aniCoin|premium|xp\s*\+=|localStorage/);
});
