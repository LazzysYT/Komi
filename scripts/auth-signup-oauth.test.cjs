const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
function slice(a,b){const i=html.indexOf(a),j=html.indexOf(b,i);assert.ok(i>=0&&j>i,a);return html.slice(i,j)}
const helpers=slice('function komiReservedAccountName(', '        function applySavedKomiProfile(');
const register=slice('async function handleRegisterSubmit(', '        const komiFavoritePending = new Set();');
const google=slice('async function showGoogleAuthInfo(', '        function komiReservedAccountName(');

function scenario(handle='Admin'){
 const messages=[],signups=[],oauth=[],fields={
  regUsername:{value:handle},regEmail:{value:'qa-user@example.test'},regPassword:{value:'good-password-123'}
 };
 let closed=0,restored=0;
 const context=vm.createContext({
  document:{getElementById:id=>fields[id]},
  _supabase:{auth:{
   async signUp(payload){signups.push(payload);return {data:{session:null},error:null}},
   async signInWithOAuth(payload){oauth.push(payload);return {error:null}}
  }},
  window:{location:{origin:'https://komianime.online',pathname:'/'}},
  alert:message=>messages.push(message),console:{error(){}},
  closeAuthModal(){closed++},async queueKomiSessionRestore(){restored++},
  currentUser:null,Error
 });
 vm.runInContext(helpers+register+google,context);
 const event={preventDefault(){}};
 return {context,messages,signups,oauth,fields,runSignup:()=>{context.__event=event;return vm.runInContext('handleRegisterSubmit(__event)',context)},
  runOAuth:()=>vm.runInContext('showGoogleAuthInfo()',context),state:()=>({closed,restored})};
}
test('reserved email handle is rejected before signup network request',async()=>{
 for(const nickname of ['Admin','MOD','system','owner','google_other','KomiAnime']){
  const x=scenario(nickname);
  await x.runSignup();
  assert.equal(x.signups.length,0,nickname);
  assert.match(x.messages.at(-1),/зарезервирован/);
 }
});
test('normal signup only sends explicit email, password and requested nickname',async()=>{
 const x=scenario('NormalNickname');
 await x.runSignup();
 assert.equal(x.signups.length,1);
 assert.equal(x.signups[0].email,'qa-user@example.test');
 assert.equal(x.signups[0].options.data.username,'NormalNickname');
 assert.equal(x.signups[0].options.emailRedirectTo,'https://komianime.online/');
 assert.equal(x.state().closed,1);
 assert.equal(x.state().restored,0);
});
test('Google button invokes provider OAuth with first-party redirect and no password data',async()=>{
 const x=scenario();
 await x.runOAuth();
 assert.equal(x.oauth.length,1);
 assert.deepEqual(Object.keys(x.oauth[0]),['provider','options']);
 assert.equal(x.oauth[0].provider,'google');
 assert.equal(x.oauth[0].options.redirectTo,'https://komianime.online/');
 assert.equal(JSON.stringify(x.oauth[0]).includes('password'),false);
});
