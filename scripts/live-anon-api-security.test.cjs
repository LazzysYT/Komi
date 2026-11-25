'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {extractPublicConfig}=require('./live-anon-api-security.cjs');

const origin='https://fixture-project.supabase.co';
const key='sb_publishable_fixture_only';
const source="const SUPABASE_URL = '"+origin+"';\nconst SUPABASE_ANON_KEY = '"+key+"';";
// This is the quote/whitespace form emitted by the CI esbuild command.
const minified='const SUPABASE_URL='+JSON.stringify(origin)+';const SUPABASE_ANON_KEY='+JSON.stringify(key)+';';
function assertFixture(config){
 assert.ok(config.origin===origin,'Extracted origin must match the literal declaration');
 assert.ok(config.key===key,'Extracted publishable key must match the literal declaration');
}

test('public API canary extracts both original and minified browser configuration',()=>{
 assertFixture(extractPublicConfig(source));
 assertFixture(extractPublicConfig(minified));
 assertFixture(extractPublicConfig("const\nSUPABASE_URL='"+origin+"';\nconst SUPABASE_ANON_KEY=\""+key+"\";"));
});

test('current browser configuration survives normalized compact declarations without logging values',()=>{
 const current=extractPublicConfig(fs.readFileSync(path.join(__dirname,'../app-main.js'),'utf8'));
 const compact='const SUPABASE_URL='+JSON.stringify(current.origin)+';const SUPABASE_ANON_KEY='+JSON.stringify(current.key)+';';
 const restored=extractPublicConfig(compact);
 assert.ok(restored.origin===current.origin,'Origin changed after quote normalization');
 assert.ok(restored.key===current.key,'Public key changed after quote normalization');
});

test('configuration extraction rejects missing, mismatched and executable values',()=>{
 for(const invalid of [
   source.replace('SUPABASE_URL','UNRELATED_URL'),
   'const SUPABASE_URL=\"'+origin+"';const SUPABASE_ANON_KEY='"+key+"';",
   "const SUPABASE_URL='"+origin+"'+'.invalid';const SUPABASE_ANON_KEY='"+key+"';",
   "const SUPABASE_URL=(() => { throw Error('must not execute'); })();const SUPABASE_ANON_KEY='"+key+"';"
 ]) assert.throws(()=>extractPublicConfig(invalid),/Configured Supabase HTTPS origin is missing/);
});

test('origin and public-only key restrictions remain mandatory after extraction',()=>{
 for(const invalidOrigin of ['http://fixture-project.supabase.co','https://example.test','https://fixture-project.supabase.co.invalid'])
   assert.throws(()=>extractPublicConfig(source.replace(origin,invalidOrigin)),/Configured Supabase HTTPS origin is missing/);
 assert.throws(()=>extractPublicConfig(source.replace(key,'private_fixture_value')),/Expected only a public Supabase key/);
});

test('secret and service-role exposure assertions still inspect the whole browser source',()=>{
 assert.throws(()=>extractPublicConfig(minified+"const accidental='sb_secret_abcdefghijklmnop';"),/Server secret must never be embedded/);
 assert.throws(()=>extractPublicConfig(minified+'const accidental={"service_role":"eyJfixture"};'),/JWT service-role key in browser source/);
});
