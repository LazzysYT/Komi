'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const app=fs.readFileSync(path.join(root,'app-main.js'),'utf8');
const theme=fs.readFileSync(path.join(root,'komi-black-white.css'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');

const first=app.indexOf('function komiVisibleUsername(');
const last=app.indexOf('function renderHeaderUser(',first);
assert.ok(first>0 && last>first,'Visible nickname helper must precede header renderer');
const ctx=vm.createContext({});
vm.runInContext(app.slice(first,last),ctx);
const visible=ctx.komiVisibleUsername;
const technical='google_307c6306cdcb490d908646046af07c61';

test('header shows saved site nickname instead of a Google technical identity',()=>{
  assert.equal(visible(technical,{displayName:'KomiFan'},true),'KomiFan');
  assert.equal(visible(technical,{displayName:'  МойНик  '},true),'МойНик');
  assert.match(app,/name\.textContent = komiVisibleUsername\(username, p, true\)/);
  assert.match(app,/name\.className = 'komi-header-username'/);
});

test('missing nickname never exposes raw Google ID in user-facing views',()=>{
  assert.equal(visible(technical,{},true),'Мой профиль');
  assert.equal(visible(technical,{},false),'Пользователь Komi');
  assert.equal(visible(technical,{displayName:technical},true),'Мой профиль');
  assert.match(app,/safeProfileText\(komiVisibleUsername\(username, p, isMe\)\)/);
});

test('email accounts keep their usernames when no display name exists',()=>{
  assert.equal(visible('KomiUser_1',{},true),'KomiUser_1');
  assert.equal(visible('KomiUser_1',{displayName:'Ник'},true),'Ник');
  assert.equal(visible('',{},true),'Мой профиль');
});

test('public name stays display-only, never becomes an ownership key or HTML markup',()=>{
  assert.equal(visible(technical,{displayName:'<img src=x onerror=alert(1)>'},true),
               '<img src=x onerror=alert(1)>');
  // Header renders with textContent and profile markup escapes untrusted values.
  assert.match(app,/name\.textContent = komiVisibleUsername/);
  assert.match(app,/\$\{safeProfileText\(komiVisibleUsername\(username, p, isMe\)\)\}/);
  assert.match(app,/currentUser = \{ username, authProvider:/);
  assert.match(app,/komiSafeAccountUsername\(username, session\.user\.id\)/);
});

test('nickname strip truncates, and account actions do not wrap vertically',()=>{
  assert.equal(visible(technical,{displayName:'A'.repeat(50)},true).length,40);
  assert.match(theme,/\.komi-header-username[\s\S]*?text-overflow: ellipsis !important/);
  assert.match(theme,/\.user-pill > button[\s\S]*?white-space: nowrap !important/);
  assert.ok(/href="\/komi\.bundle\.css\?v=[A-Za-z0-9._-]+"/.test(html), 'Consolidated CSS must be linked');
  const bundle=fs.readFileSync(path.join(root,'komi.bundle.css'),'utf8');
  assert.ok(bundle.includes(theme.trim()),'Header nickname and logout styles must remain in the CSS bundle');
});
