const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const source=fs.readFileSync(path.join(root,'static-ui-events.js'),'utf8');
test('static HTML has no inline JS event attributes, including dormant admin template',()=>{
  assert.doesNotMatch(html,/\s+on(?:click|input|focus|submit|change|error|keydown|keyup|load)\s*=/i);
  const matches=[...html.matchAll(/\bdata-komi-(click|input|focus|submit|error)="([^"]+)"/g)];
  assert.ok(matches.length>=40,'Expected all legacy static handlers migrated');
  for(const [_,kind,action] of matches){
    assert.match(source,new RegExp("case '"+kind+":"+action+"'"), 'Unmapped '+kind+':'+action);
  }
  assert.match(html,/<script src="\.\/static-ui-events\.js"><\/script>/);
});
test('static event delegation uses explicit allowlist and no source evaluation',()=>{
  assert.match(source,/document\.addEventListener\(type, event=>delegate\(type,event\)/);
  assert.match(source,/case 'submit:login-submit'/);
  assert.match(source,/case 'click:profile'/);
  assert.match(source,/case 'error:poster-error'/);
  assert.doesNotMatch(source,/\beval\s*\(|new Function\b/);
});
