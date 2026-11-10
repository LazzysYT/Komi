const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
function functionSource(name, next) {
 return html.slice(html.indexOf(name), html.indexOf(next, html.indexOf(name)));
}
test('initial document has skeletons, visible providers and no admin editor', () => {
 const body = html.slice(html.indexOf('<body'), html.indexOf('<script', html.indexOf('<body')));
 assert.match(body, /id="catalog"/);
 assert.match(body, /id="anime-grid"/);
 assert.equal((body.match(/class="anime-card komi-skeleton"/g)||[]).length, 7);
 assert.doesNotMatch(body, /id="animeForm"|id="addModal"/);
 assert.match(body, /Продолжить через Google/);
 const social = body.match(/<nav class="komi-social-links"[\s\S]*?<\/nav>/)[0];
 assert.equal((social.match(/<svg width="24" height="24"/g)||[]).length, 2);
 assert.doesNotMatch(html, /\.\/anime-artwork\.svg/);
 assert.match(body, /id="komiFriendsDrawer"[^>]*inert/);
});
test('presence timeout aborts requests, releases lock and recovers on next poll', async () => {
 let timeout, cleared = 0, blocked = true;
 const status = {textContent:'Онлайн: проверяем…', set innerText(v){this.textContent=v;}};
 const query = {
  upsert(){return this;}, delete(){return this;}, lt(){return this;}, select(){return this;},
  abortSignal(signal){
   if (!blocked) return Promise.resolve({data:2});
   return new Promise((resolve,reject)=>{
    if (signal.aborted) reject(Error('aborted'));
    else signal.addEventListener('abort',()=>reject(Error('aborted')), {once:true});
   });
  }
 };
 const context = vm.createContext({AbortController, Date, Map, Error,
  document:{hidden:false,getElementById:()=>status}, currentUser:null, myUniqueKey:'test',
  navigator:{onLine:true}, komiPresenceSession:'00000000-0000-4000-8000-000000000001', _supabase:{rpc:()=>query}, setTimeout(fn, ms){assert.equal(ms,3000); timeout=fn; return 1;}, clearTimeout(){cleared++;},
 });
 vm.runInContext('let presenceRequestInFlight=false; let presenceRequestEpoch=0; let globalAllOnlineUsersList=[];\n'+functionSource('async function updateOnlinePresence()', '        setInterval(updateOnlinePresence'),context);
 const pending=vm.runInContext('updateOnlinePresence()',context);
 timeout(); await pending;
 assert.equal(status.textContent,'Онлайн: —');
 assert.equal(vm.runInContext('presenceRequestInFlight',context),false);
 blocked=false; await vm.runInContext('updateOnlinePresence()',context);
 assert.equal(status.textContent,'Онлайн: 2'); assert.equal(cleared,2);
});
test('admin entry remains fail closed before importing editor',async()=>{
 let mounted=false;
 const context=vm.createContext({requireServerAdmin:()=>false,document:{getElementById(){mounted=true;}}});
 vm.runInContext(functionSource('async function openAddModal(', '        function closeAddModal'),context);
 await vm.runInContext('openAddModal()',context);
 assert.equal(mounted,false);
});
