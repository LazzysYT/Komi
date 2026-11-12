const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const sql=fs.readFileSync(path.join(__dirname,'../supabase/migrations/20261112111500_social_tables_minimal_grants.sql'),'utf8');

test('social tables revoke obsolete browser privileges before selective regrant',()=>{
  for (const table of ['komi_comments','komi_favorites']) {
    assert.match(sql,new RegExp('revoke all privileges on table public\\.'+table+'\\s+from public, anon, authenticated','i'));
  }
  assert.match(sql,/grant select on table public\.komi_comments to anon, authenticated/i);
  assert.match(sql,/grant insert, delete on table public\.komi_comments to authenticated/i);
  assert.match(sql,/grant select, insert, update, delete on table public\.komi_favorites\s+to authenticated/i);
  assert.doesNotMatch(sql,/grant\s+(?:all|truncate|trigger|references)\s+on/i);
  assert.doesNotMatch(sql,/grant\s+\w*[ ,]\s*insert\s+on\s+table\s+public\.komi_favorites\s+to\s+anon/i);
  assert.doesNotMatch(sql,/\bdelete\s+from\b|\btruncate\s+table\b|\bdrop\s+table\b/i);
});
