/*
 * Read-only public API security canary against the real Supabase project.
 * Uses the same PUBLISHABLE key that the browser already receives.
 * Does not create accounts, call mutating RPCs, or change user data.
 */
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const source=fs.readFileSync(path.join(__dirname,'../app-main.js'),'utf8');
const match=(name)=>source.match(new RegExp("const "+name+"\\s*=\\s*'([^']+)'"))?.[1];
const origin=match('SUPABASE_URL');
const key=match('SUPABASE_ANON_KEY');
assert.ok(/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(origin||''),'Configured Supabase HTTPS origin is missing');
assert.ok(key?.startsWith('sb_publishable_'),'Expected only a public Supabase key in browser code');
assert.ok(!/sb_secret_[a-z0-9_-]{12,}/i.test(source),'Server secret must never be embedded in public JS');
assert.ok(!/['"]service_role['"]\s*:\s*['"]eyJ/.test(source),'JWT service-role key in browser source');

async function get(table,fields){
 const url=new URL(origin+'/rest/v1/'+table);
 url.searchParams.set('select',fields);
 url.searchParams.set('limit','1');
 const response=await fetch(url,{method:'GET',headers:{
   apikey:key,Accept:'application/json','Cache-Control':'no-cache'
 },signal:AbortSignal.timeout(25000)});
 const body=await response.text();
 let json;
 try{json=JSON.parse(body);}catch{
   throw Error(table+': expected PostgREST JSON; HTTP '+response.status);
 }
 return {status:response.status,body:json};
}
(async()=>{
 // Required public data. This catches accidental revocation that would break
 // the catalog and comments for anonymous visitors.
 for(const [table,fields] of [
   ['anime_catalog','shikimori_id'],
   ['komi_catalog_cards','shikimori_id'],
   ['komi_comments','id']
 ]){
   const result=await get(table,fields);
   assert.equal(result.status,200,table+' should be publicly readable');
   assert.ok(Array.isArray(result.body),table+' must return an array');
   console.log('PASS public read:',table);
 }
 // For private data, permission-denied responses or an empty RLS-filtered
 // array are both safe. Any returned row is an actionable security failure.
 for(const [table,fields] of [
   ['animes','id'],
   ['komi_admin_members','user_id'],
   ['komi_anicoin_wallets','user_id'],
   ['komi_anicoin_ledger','user_id'],
   ['komi_anime_lists','user_id'],
   ['komi_favorites','user_id'],
   ['komi_watch_progress','user_id'],
   ['komi_custom_folders','user_id'],
   ['komi_folder_items','user_id'],
   ['komi_notifications','recipient_id'],
   ['komi_friend_requests','id'],
   ['komi_friendships','user_a'],
   ['komi_profiles','user_id']
 ]){
   const result=await get(table,fields);
   assert.ok([200,401,403,404].includes(result.status),
     table+': unexpected HTTP '+result.status);
   if(result.status===200){
     assert.ok(Array.isArray(result.body),table+': 200 must contain rows array');
     assert.equal(result.body.length,0,
       table+': SECURITY FAILURE — anonymous visitor can read private rows');
   }
   console.log('PASS anonymous access denied or empty:',table);
 }
 console.log('PASS: live Supabase anonymous read-only exposure audit');
})().catch(error=>{console.error(error.message);process.exitCode=1;});
