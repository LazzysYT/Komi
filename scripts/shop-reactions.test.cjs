const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const context={window:{},location:{hostname:'preview.example'}};
vm.createContext(context);
for(const file of ['komi-shop-catalog.js','komi-shop-reactions.js'])
 vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
const {KomiShopCatalog:catalog,KomiShopReactions:reactions}=context.window;

test('all nine sold reactions have distinct local artwork without a font dependency',()=>{
 const entries=catalog.items.filter(item=>item.type==='reaction').flatMap(item=>item.reactions);
 assert.equal(entries.length,9);
 const drawings=entries.map(entry=>reactions.render(entry.emoji));
 assert.equal(new Set(drawings).size,entries.length);
 for(const svg of drawings){
  assert.match(svg,/^<svg class="komi-reaction-art"/);
  assert.match(svg,/aria-hidden="true" focusable="false"/);
  assert.match(svg,/viewBox="0 0 40 40"/);
  assert.doesNotMatch(svg,/<(?:text|image|foreignObject)|(?:href|style|on\w+)=/);
  assert.notEqual(svg,reactions.render('unknown'));
 }
});

test('reaction renderer only emits fixed artwork for unknown or untrusted input',()=>{
 const fallback=reactions.render('unknown');
 for(const value of [null,undefined,{},42,'<img src=x onerror=alert(1)>','🔥<script>bad</script>','__proto__','constructor'])
  assert.equal(reactions.render(value),fallback);
 assert.ok(Object.isFrozen(reactions));
});

test('optional emoji presentation selectors preserve the same reaction artwork',()=>{
 for(const item of catalog.items.filter(item=>item.type==='reaction'))
  for(const entry of item.reactions)
   assert.equal(reactions.render(entry.emoji+'\ufe0f'),reactions.render(entry.emoji));
});
