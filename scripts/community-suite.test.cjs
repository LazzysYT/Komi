const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const schema=read('supabase/migrations/20261120133000_community_suite.sql');
const quiz=read('supabase/migrations/20261120143000_party_opening_quiz.sql');
const awards=read('supabase/migrations/20261120145000_referral_auto_reward.sql');
const voteFix=read('supabase/migrations/20261120150000_review_votes_ownership_fix.sql');
const html=read('index.html');

test('community modules are loaded after app initialization without touching legacy scripts',()=>{
 for(const name of ['komi-community.js','komi-anime-social.js','komi-party-quiz.js'])
   assert.match(html,new RegExp('<script defer src="\\./'+name.replace('.','\\.')+'(?:\\?v=[\\w-]+)?"></script>'));
 assert.ok(html.indexOf('app-main.js')<html.indexOf('komi-community.js'));
 const hub=read('komi-community.js');
 for(const [name,file] of [['KomiImport','komi-import.js'],['KomiWrapped','komi-wrapped.js']]){
   assert.ok(!html.includes(file),'On-demand feature must not load at startup');
   assert.ok(hub.includes(name+":'/"+file+"'"));
   assert.ok(read(file).includes('window.'+name+'='));
 }
 assert.match(hub,/featureScripts.has\(name\)/);
 assert.match(hub,/owner\(\)===uid/);
});
test('new social writes respect per-user RLS and owner permissions',()=>{
 for(const table of ['komi_collections','komi_collection_items','komi_collection_likes','komi_reviews','komi_review_votes','komi_voice_follows'])
   assert.match(schema,new RegExp('alter table public\\.'+table+' enable row level security','i'));
 assert.match(schema,/with check\(user_id=\(select auth\.uid\(\)\)\)/);
 assert.match(schema,/on conflict|unique\(anime_id,user_id\)/);
 assert.match(voteFix,/r\.user_id <> komi_review_votes\.user_id/);
});
test('spoilers remain text-only and timecodes preserve native video control',()=>{
 const src=read('komi-comments.js');
 assert.match(src,/function appendSpoilerAware\(target, body\)/);
 assert.match(src,/const spoiler = \/\\\|\\\|/);
 assert.match(src,/appendTimecodes\(target, source\.slice\(/);
 assert.doesNotMatch(src,/body\.innerHTML\s*=/);
});
test('import never updates already present authenticated lists',()=>{
 const src=read('komi-import.js');
 assert.match(src,/const owned=new Set/);
 assert.match(src,/!owned\.has\(x\.anime_id\)/);
 assert.match(src,/ignoreDuplicates:true/);
 assert.match(src,/owner!==U\.owner\(\)/);
});
test('opening quiz never seeds copyrighted music and confines RPC to room membership',()=>{
 assert.match(quiz,/v_room\.host=v_user or v_user=any\(v_room\.guests\)/);
 assert.match(quiz,/v_room\.host<>v_user/);
 assert.match(quiz,/where enabled and not \(id=any\(v_quiz\.used_tracks\)\)/);
 assert.match(schema,/enabled boolean not null default false/);
 assert.doesNotMatch(schema,/insert into public\.komi_opening_tracks/i);
});
test('refer-a-friend coin credit is atomic and once per invitee',()=>{
 assert.match(schema,/invitee_id uuid primary key/);
 assert.match(awards,/for update/);
 assert.match(awards,/rewarded_at is null/);
 assert.match(awards,/on conflict \(user_id\) do update/);
 assert.match(awards,/when \(new\.reason='watch'\)/);
});
