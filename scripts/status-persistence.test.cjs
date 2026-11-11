const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const extract = (start, end) => {
  const from = html.indexOf(start);
  const to = html.indexOf(end, from);
  assert.ok(from >= 0 && to > from, `missing function range: ${start}`);
  return html.slice(from, to);
};
const statusSource = extract('async function persistAuthenticatedStatus(', '        const komiProgressWriter');
const favoriteSource = extract('async function persistAuthenticatedFavorite(', '        function addToCustomFolder(');

function sandbox(source, response) {
  const calls = [];
  const q = {
    upsert: (payload, opts) => { calls.push({action:'upsert',payload,opts}); return q; },
    delete: () => { calls.push({action:'delete'}); return q; },
    eq: (key, value) => { calls.push({action:'eq',key,value}); return q; },
    select: columns => { calls.push({action:'select',columns}); return q; },
    single: async () => response,
    then: (resolve, reject) => Promise.resolve(response).then(resolve,reject)
  };
  const context = vm.createContext({
    currentUser: { authUserId:'verified-user', username:'user' },
    _supabase: { from(table) { calls.push({action:'from',table});return q; } },
    Number, Error
  });
  vm.runInContext(source,context);
  return { context, calls };
}

test('status and favorites fail closed when session or database is unavailable', async () => {
  for (const [source, functionName] of [[statusSource,'persistAuthenticatedStatus'],[favoriteSource,'persistAuthenticatedFavorite']]) {
    const { context } = sandbox(source, {data:{}});
    context._supabase = null;
    await assert.rejects(vm.runInContext(`${functionName}('12','Просмотрено')`,context), /подтверждённого входа/i);
    context._supabase = {from(){throw Error('should not make query')}};
    for (const id of ['invalid','0','9007199254740999']) {
      await assert.rejects(vm.runInContext(`${functionName}('${id}','Просмотрено')`,context), /ID аниме/);
    }
  }
});

test('status saved notification requires matching returned row', async () => {
  const {context,calls} = sandbox(statusSource,{data:{anime_id:12,status:'Просмотрено'},error:null});
  assert.equal(await vm.runInContext("persistAuthenticatedStatus('12','Просмотрено')",context),true);
  const upsert=calls.find(c=>c.action==='upsert');
  assert.equal(upsert.payload.user_id,'verified-user');
  assert.equal(upsert.payload.anime_id,12);
  assert.equal(upsert.payload.status,'Просмотрено');
  assert.ok(calls.some(c=>c.action==='select' && c.columns==='anime_id,status'));
});

test('upsert that returns no row must not pretend status or favorite was saved', async () => {
  for (const [source,name] of [[statusSource,'persistAuthenticatedStatus'],[favoriteSource,'persistAuthenticatedFavorite']]) {
    const {context} = sandbox(source,{data:null,error:null});
    await assert.rejects(vm.runInContext(`${name}('12','Просмотрено')`,context), /не подтвердил/);
  }
});

test('server errors propagate instead of changing the local list silently', async () => {
  const { context } = sandbox(statusSource,{data:null,error:{message:'RLS denied'}});
  await assert.rejects(vm.runInContext("persistAuthenticatedStatus('12','Просмотрено')",context), error => error?.message === 'RLS denied');
});

test('deleting absent status is an idempotent successful operation', async () => {
  const {context,calls}=sandbox(statusSource,{data:[],error:null});
  assert.equal(await vm.runInContext("persistAuthenticatedStatus('12',null)",context),true);
  assert.ok(calls.some(c=>c.action==='delete'));
  assert.ok(calls.some(c=>c.action==='select'));
});

test('favorite upsert verifies the stored category and ID', async () => {
  const {context} = sandbox(favoriteSource,{data:{anime_id:12,category:'Любимые'},error:null});
  assert.equal(await vm.runInContext("persistAuthenticatedFavorite('12','Любимые')",context),true);
});

test('profile friend action uses data-bound name rather than inlined JS interpolation', () => {
  const source=extract('function renderProfileView(', '        function ');
  assert.match(source,/window\.komiViewedProfileName=username/);
  assert.match(source,/removeFriend\(window\.komiViewedProfileName\)/);
  assert.match(source,/sendFriendRequest\(window\.komiViewedProfileName\)/);
  assert.doesNotMatch(source, /(?:removeFriend|sendFriendRequest)\('(?:\$\{username\})'\)/);
});


test('favorites cannot claim success for a local-only account', async () => {
  const source=extract('const komiFavoritePending = new Set();','        async function persistAuthenticatedFavorite(');
  const messages=[];
  const favorites={legacy_user:{}};
  const context=vm.createContext({
    currentUser:{username:'legacy_user'}, userFavorites:favorites, _supabase:null,
    komiStatusFeedback:m=>messages.push(m), openAuthModal:()=>{throw Error('should show status instead')},
    Error, Set
  });
  vm.runInContext(source,context);
  await vm.runInContext("toggleFavorite('12','Любимые')",context);
  assert.equal(Object.keys(favorites.legacy_user).length,0);
  assert.match(messages.at(-1),/Не удалось сохранить избранное/);
  assert.equal(vm.runInContext('komiFavoritePending.size',context),0);
});
