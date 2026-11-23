const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const test=require('node:test');
const assert=require('node:assert/strict');

const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8') + '\n' + fs.readFileSync(path.join(__dirname,'../app-main.js'),'utf8');
const from=html.indexOf('function renderProfileView(');
const to=html.indexOf('        let avatarDraft = null;',from);
assert.ok(from>=0&&to>from,'profile renderer not found');
const source=html.slice(from,to);
test('profile buttons never splice a user nickname into executable handler source',()=>{
 assert.match(source,/removeFriend\(window\.komiViewedProfileName\)/);
 assert.match(source,/sendFriendRequest\(window\.komiViewedProfileName\)/);
 assert.match(source,/postToProfileWall\(window\.komiWallProfileName\)/);
 const premium=fs.readFileSync(path.join(__dirname,'../profile-premium.js'),'utf8');
 assert.ok(source.includes('KomiProfileUI.fullFriendRows(myFriends)'));
 assert.ok(premium.includes("openProfile(window.komiProfileFriendNames['+i+'])"),
  'friend links must resolve via an indexed name, never a user-authored handler');
 assert.doesNotMatch(source,/openProfile\('\$\{friend\}'\)/);
 assert.doesNotMatch(source,/(?:removeFriend|sendFriendRequest|postToProfileWall)\('\$\{username\}'\)/);
});
test('profile folders, genres, friends and avatars escape untrusted fields',()=>{
 for(const piece of [
  'safeProfileText(fname)',
  'komiSafeUrl(senderAvatar)',
  'window.komiProfileFolderNames[\u0024{i}]'
 ])assert.ok(source.includes(piece),piece);
 const premium=fs.readFileSync(path.join(__dirname,'../profile-premium.js'),'utf8');
 assert.ok(premium.includes('escapeText(label)'), 'Friend cards must escape public display names');
 assert.ok(premium.includes('escapeText(avatar)'), 'Friend avatars must escape URL attributes');
 assert.ok(premium.includes('escapeText(name)'), 'Genre names are escaped in the premium dashboard');
 assert.ok(premium.includes('escapeText(anime.title)'), 'Anime titles are escaped in the premium dashboard');
 assert.doesNotMatch(source,/profileActiveTab='\$\{fname\}'/);
 assert.doesNotMatch(source,/<img src="\$\{senderAvatar\}"/);
});
test('HTML escaping prevents attributes and fake tags from being introduced',()=>{
 const escaping=html.match(/function safeProfileText\(value\) \{[^\n]+\}/)?.[0];
 assert.ok(escaping);
 const context=vm.createContext({});
 vm.runInContext(escaping,context);
 const evil='X"><img src=x onerror="alert(1)">';
 const escaped=vm.runInContext('safeProfileText(__evil)',Object.assign(context,{__evil:evil}));
 assert.ok(escaped.includes('&lt;img'));
 assert.ok(escaped.includes('&quot;'));
 assert.equal(escaped.includes('<img'),false);
});
