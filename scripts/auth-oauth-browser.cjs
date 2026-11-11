const {chromium}=require('playwright');
const assert=require('node:assert/strict');

(async()=>{
 const browser=await chromium.launch({headless:true,
  ...(process.env.KOMI_CHROME?{executablePath:process.env.KOMI_CHROME}:{})});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:800}});
  await page.route('https://**/*',route=>route.fulfill({
   status:200,contentType:'application/json',body:'{}'
  }));
  await page.goto(process.env.KOMI_TEST_URL || 'http://127.0.0.1:8765',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>typeof openAuthModal==='function'&&typeof showGoogleAuthInfo==='function');
  await page.evaluate(()=>{
   window.__komiSignupCalls=[];
   window.__komiOAuthCalls=[];
   window.__komiAlertMessages=[];
   window.__originalKomiSupabase=_supabase;
   window.__originalAlert=window.alert;
   window.alert=message=>window.__komiAlertMessages.push(message);
   _supabase={auth:{
     signInWithOAuth:async payload=>{window.__komiOAuthCalls.push(payload);return {error:null}},
     signUp:async payload=>{window.__komiSignupCalls.push(payload);return {data:{session:null},error:null}}
   }};
   openAuthModal('login');
  });
  await page.locator('.komi-google-btn').click();
  await page.waitForFunction(()=>window.__komiOAuthCalls.length===1);
  const oauth=await page.evaluate(()=>window.__komiOAuthCalls[0]);
  assert.equal(oauth.provider,'google');
  assert.equal(oauth.options.redirectTo,'http://127.0.0.1:8765/');
  await page.evaluate(()=>switchAuthTab('register'));
  await page.locator('#regUsername').fill('Admin');
  await page.locator('#regEmail').fill('example@example.test');
  await page.locator('#regPassword').fill('valid-password-123');
  await page.locator('#registerFormContainer button[type="submit"]').click();
  await page.waitForFunction(()=>window.__komiAlertMessages.some(m=>m.includes('зарезервирован')));
  const state=await page.evaluate(()=>({
    oauthCount:window.__komiOAuthCalls.length,
    signupCount:window.__komiSignupCalls.length,
    errorText:window.__komiAlertMessages.at(-1)
  }));
  assert.equal(state.oauthCount,1);
  assert.equal(state.signupCount,0);
  assert.match(state.errorText,/зарезервирован/);

  await page.evaluate(() => {
   const user = {authUserId:'ci-sign-out',username:'ci_sign_out'};
   currentUser = user;
   window.__komiSignOutScopes = [];
   _supabase = {
    auth:{
     async getSession(){return {data:{session:{user:{id:user.authUserId}}},error:null};},
     async signOut({scope}){window.__komiSignOutScopes.push(scope);return {error:null};}
    },
    rpc(){return {abortSignal:async()=>({data:0})};}
   };
   closeAuthModal();
   openProfile(user.username);
  });
  await page.getByRole('button',{name:'Настройки',exact:true}).click();
  await page.getByRole('button',{name:'Выйти на всех устройствах'}).click();
  await page.waitForFunction(()=>currentUser===null);
  assert.deepEqual(await page.evaluate(()=>window.__komiSignOutScopes),['global']);
  console.log('PASS Google OAuth, reserved signup handle, and global sign-out button (mock, no credentials)');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
