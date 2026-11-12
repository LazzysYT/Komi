const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
test('no dynamic HTML template emits raw inline event handlers',()=>{
 const files=['app-main.js','watch-party.js','anicoin.js','anime-details.js'];
 let total=0;
 for(const file of files){
   const source=fs.readFileSync(path.join(root,file),'utf8');
   assert.doesNotMatch(source,/\bon(?:click|input|change|keydown|keyup|error|focus|submit)="[^"]/i,
     file+' still emits executable HTML attributes');
   total+=(source.match(/\bdata-komi-on(?:click|input|change|keydown|error)=/g)||[]).length;
 }
 assert.ok(total>=100,'All existing dynamic HTML event attributes should be replaced');
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 assert.match(html,/<script src="\.\/dynamic-ui-events\.js"><\/script>/);
});
test('dynamic event routing uses finite allowlisted expressions, never general evaluation',()=>{
 const source=fs.readFileSync(path.join(root,'dynamic-ui-events.js'),'utf8');
 assert.match(source,/const allowedStatuses=new Set/);
 assert.match(source,/const isId=/);
 assert.match(source,/function resolve\(type,expression\)/);
 assert.match(source,/Unsupported Komi legacy UI action/);
 assert.doesNotMatch(source,/\beval\s*\(|new Function\b|\.innerHTML\s*=/);
});
