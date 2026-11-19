'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
test('Premium webhook requires configured strong secret and authenticates each request',()=>{
 const s=read('supabase/functions/lava-premium-webhook/index.ts');
 assert.match(s,/LAVA_PREMIUM_WEBHOOK_KEY/);
 assert.match(s,/X-Api-Key/);
 assert.match(s,/secret\.length<32/);
 assert.match(s,/status:503/);
 assert.match(s,/status:401/);
 assert.match(s,/offerId/);
 assert.doesNotMatch(s,/raw_user_meta_data|user_metadata|localStorage/);
});
test('Premium contracts protected by RLS, only active badges readable publicly',()=>{
 const s=read('supabase/migrations/20261119130000_komi_premium_memberships.sql');
 assert.match(s,/ENABLE ROW LEVEL SECURITY/);
 assert.match(s,/GRANT SELECT\(user_id\)/);
 assert.match(s,/active_until > now\(\)/);
 assert.match(s,/REVOKE ALL ON public\.komi_premium_contracts FROM PUBLIC, anon, authenticated/);
 assert.match(s,/REVOKE ALL ON FUNCTION public\.komi_apply_lava_premium_event/);
 assert.match(s,/GRANT EXECUTE ON FUNCTION public\.komi_apply_lava_premium_event/);
 assert.match(s,/email_confirmed_at IS NOT NULL/);
 assert.match(s,/duplicate_event/);
});
