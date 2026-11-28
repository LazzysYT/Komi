'use strict';
// Production negative control: two password sign-in requests for a nonexistent
// synthetic email. No signup, no real credentials, no state change, no retries.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{randomUUID}=require('node:crypto');
const s=fs.readFileSync(path.join(__dirname,'../app-main.js'),'utf8');
const url=s.match(/const SUPABASE_URL\s*=\s*['"]([^'"]+)['"]/)?.[1];
const key=s.match(/const SUPABASE_ANON_KEY\s*=\s*['"]([^'"]+)['"]/)?.[1];
assert.equal(url,'https://xebglnnpoutmdcgukbxf.supabase.co');
assert.ok(key,'Missing public key');
if(!key.startsWith('sb_publishable_')){
 const claims=JSON.parse(Buffer.from(key.split('.')[1],'base64url').toString('utf8'));
 assert.equal(claims.role,'anon','Only public anon key permitted');
}
async function main(){
 const email='qa-turnstile-'+randomUUID()+'@example.invalid',password='synthetic-fixture-'+randomUUID();
 for(const [label,captcha] of [['missing',null],['invalid','invalid-test-token']]){
  const body={email,password,...(captcha?{gotrue_meta_security:{captcha_token:captcha}}:{})};
  const r=await fetch(url+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(15000)});
  const j=await r.json();
  // Print only allowlisted status and error category, never credentials or tokens.
  const failed=j.error_code==='captcha_failed'||j.code==='captcha_failed'||/captcha verification process failed/i.test(String(j.msg||j.message||''));
  console.log(label+': HTTP '+r.status+', '+(failed?'CAPTCHA rejected':(j.error_code==='invalid_credentials'?'credentials rejected, CAPTCHA not confirmed':'unexpected result')));
  assert.ok(!r.ok&&failed,'Server did not demonstrate CAPTCHA rejection for '+label+' token');
 }
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
