const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8') + '\n' + fs.readFileSync(path.join(__dirname,'../app-main.js'),'utf8');
function extract(a,b) {
 const start=html.indexOf(a),end=html.indexOf(b,start);
 assert.ok(start>=0&&end>start,'missing: '+a);return html.slice(start,end);
}
const escapeSource=extract('function escapeFriendHtml(', '        function toggleFriendsDrawer(');
const section=extract('function handleFriendSearchInput(', '        let accountNotifications');
function fixture({friends=[]}={}) {
 const malicious='X"><img src=x onerror=alert(1)>';
 const results={innerHTML:'',style:{display:''}};
 const sidebar={innerHTML:''};
 const win={};
 const ctx=vm.createContext({
  document:{getElementById(id){if(id==='dynamicFriendSearchResults')return results;
    if(id==='sidebarFriendsListContainer')return sidebar;return null;}},
  window:win,
  currentUser:{username:'owner',authUserId:'owner-id'},
  userProfiles:{[malicious]:{avatar:'" onerror="alert(2)'}},
  friendsFor:()=>friends,
  encodeURIComponent,
  String
 });
 vm.runInContext(escapeSource+section,ctx);
 return {ctx,win,results,sidebar,malicious};
}
test('found names are escaped and handlers resolve names only from indexed data',()=>{
 const f=fixture();
 f.ctx.__query='X';
 vm.runInContext('handleFriendSearchInput(__query)',f.ctx);
 assert.equal(f.win.komiSidebarSearchNames[0],f.malicious);
 assert.match(f.results.innerHTML,/&lt;img src=x/);
 assert.doesNotMatch(f.results.innerHTML,/<img src=x onerror=alert/);
 assert.doesNotMatch(f.results.innerHTML,/src="" onerror="alert/);
 assert.match(f.results.innerHTML,/window\.komiSidebarSearchNames\[0\]/);
 assert.doesNotMatch(f.results.innerHTML,/openProfile\('X/);
 assert.doesNotMatch(f.results.innerHTML,/sendFriendRequest\('X/);
});
test('friends sidebar also escapes nickname and avatar without inline string injection',()=>{
 const malicious='X"><img src=x onerror=alert(1)>';
 const f=fixture({friends:[malicious]});
 vm.runInContext('renderSidebarFriendsList()',f.ctx);
 assert.equal(f.win.komiSidebarFriendNames[0],malicious);
 assert.match(f.sidebar.innerHTML,/&lt;img src=x/);
 assert.match(f.sidebar.innerHTML,/window\.komiSidebarFriendNames\[0\]/);
 assert.doesNotMatch(f.sidebar.innerHTML,/openProfile\('X/);
});
test('closing search resets stale indexed results',()=>{
 const f=fixture();
 vm.runInContext("handleFriendSearchInput('X')",f.ctx);
 vm.runInContext("handleFriendSearchInput('')",f.ctx);
 assert.equal(f.win.komiSidebarSearchNames.length,0);
 assert.equal(f.results.innerHTML,'');
 assert.equal(f.results.style.display,'none');
});
