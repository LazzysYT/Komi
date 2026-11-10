const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const test=require('node:test');
const assert=require('node:assert/strict');

const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const start=html.indexOf('function googleProfileName(');
const end=html.indexOf('        function applySavedKomiProfile(',start);
assert.ok(start>=0&&end>start);
const ctx=vm.createContext({});
vm.runInContext(html.slice(start,end),ctx);

const id='abcdef12-3456-4def-890a-aabbccddeeff';
const user=(provider,requested)=>({
 id,app_metadata:{provider},user_metadata:{username:requested}
});

test('Google fallback matches the exact safe username stored by profile creation',()=>{
 const username=ctx.googleProfileName(user('google','not-the-identity'));
 assert.equal(username,'google_abcdef1234564def890aaabbccddeeff');
 assert.equal(ctx.komiSafeAccountUsername(username,id),username);
 assert.match(username,/^[A-Za-z0-9_]{3,48}$/);
});

test('Google cannot change identity by editing provider nickname',()=>{
 assert.equal(ctx.googleProfileName(user('google','Admin')),ctx.googleProfileName(user('google','anything')));
 assert.equal(ctx.googleProfileName(user('google','Admin')),ctx.googleProfileName(user('google','')));
});

test('Email usernames are retained unless reserved or invalid',()=>{
 assert.equal(ctx.googleProfileName(user('email','KomiUser_1')),'KomiUser_1');
 assert.equal(ctx.googleProfileName(user('email','Admin')),'google_abcdef1234564def890aaabbccddeeff');
 assert.equal(ctx.googleProfileName(user('email','google_fake')),'google_abcdef1234564def890aaabbccddeeff');
 assert.equal(ctx.googleProfileName(user('email','name-with-dashes')),'google_abcdef1234564def890aaabbccddeeff');
});
