const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const sql=fs.readFileSync(path.join(__dirname,'../supabase/migrations/20261112105600_restrict_avatar_uploads.sql'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');

test('anonymous avatar upload path is removed while owner folder remains usable',()=>{
  assert.match(sql,/drop\s+policy\s+if\s+exists\s+"Komi public avatar uploads"\s+on\s+storage\.objects/i);
  assert.match(sql,/alter\s+policy\s+"Komi authenticated avatar uploads"\s+on\s+storage\.objects/i);
  assert.match(sql,/to\s+authenticated/i);
  assert.match(sql,/cardinality\(storage\.foldername\(name\)\)\s*=\s*1/i);
  assert.match(sql,/auth\.uid\(\)/i);
  assert.match(sql,/storage\.extension\(name\)\s*=\s*'jpg'/i);
});

test('avatar bucket MIME/size agrees with actual client JPEG upload',()=>{
  assert.match(sql,/allowed_mime_types\s*=\s*array\['image\/jpeg'\]/i);
  assert.match(sql,/file_size_limit\s*=\s*3145728/);
  assert.match(html,/const filename = owner \+ '\/' \+ crypto\.randomUUID\(\) \+ '\.jpg'/);
  assert.match(html,/contentType:\s*'image\/jpeg'/);
  assert.match(html,/canvas\.toBlob\([\s\S]*?'image\/jpeg',\s*\.78\)/);
  assert.doesNotMatch(sql,/\bdelete\s+from\s+storage\.objects\b/i);
  assert.doesNotMatch(sql,/\bupdate\s+storage\.objects\b/i);
});
