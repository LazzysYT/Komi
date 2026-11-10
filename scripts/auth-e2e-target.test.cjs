const test=require('node:test');
const assert=require('node:assert/strict');
const {validateE2EUrl}=require('./auth-e2e-target.cjs');
test('accept only reviewed Komi production or Ukiyo Preview origins',()=>{
 assert.equal(validateE2EUrl('https://komianime.online/'),'https://komianime.online/');
 assert.equal(validateE2EUrl('https://komi-3a92tl7t2-ukiyo6.vercel.app/'),'https://komi-3a92tl7t2-ukiyo6.vercel.app/');
});
test('reject missing target rather than contacting an outdated deployment',()=>{
 for(const target of [undefined,'',' ','https://komi-six.vercel.app/']) {
  assert.throws(()=>validateE2EUrl(target), /KOMI_TEST_URL/);
 }
});
test('reject credential exfiltration targets, redirects and insecure URLs',()=>{
 for(const target of [
  'http://komianime.online/',
  'https://evil.example/',
  'https://komi.example.vercel.app/',
  'https://komi-demo-ukiyo6.vercel.app.evil.example/',
  'https://user:password@komianime.online/',
  'https://komianime.online:8443/',
  'https://komianime.online/login',
  'https://komianime.online/?redirect=https://evil.example',
  'https://komianime.online/#login'
 ]) {
  assert.throws(()=>validateE2EUrl(target),/KOMI_TEST_URL/);
 }
});
