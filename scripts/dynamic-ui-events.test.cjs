const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
test('no dynamic HTML template emits raw inline event handlers',()=>{
 const files=['app-main.js','watch-party.js','anicoin.js','anime-details.js'];
 let total=0;
 for(const file of files){
   const source=fs.readFileSync(path.join(root,file),'utf8');
   assert.doesNotMatch(source,/(?<!-)\bon(?:click|input|change|keydown|keyup|error|focus|submit)="[^"]/i,
     file+' still emits executable HTML attributes');
   total+=(source.match(/\bdata-komi-on(?:click|input|change|keydown|error)=/g)||[]).length;
 }
 assert.ok(total>=100,'All existing dynamic HTML event attributes should be replaced');
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 assert.match(html,/<script defer src="\.\/dynamic-ui-events\.js(?:\?v=[\w-]+)?"><\/script>/);
});
test('dynamic event routing uses finite allowlisted expressions, never general evaluation',()=>{
 const source=fs.readFileSync(path.join(root,'dynamic-ui-events.js'),'utf8');
 assert.match(source,/const allowedStatuses=new Set/);
 assert.match(source,/const isId=/);
 assert.match(source,/function resolve\(type,expression\)/);
 assert.match(source,/Unsupported Komi legacy UI action/);
 assert.doesNotMatch(source,/\beval\s*\(|new Function\b|\.innerHTML\s*=/);
});
test('profile session actions dispatch only their exact allowed logout scope',()=>{
 const listeners={},scopes=[];
 const context={document:{addEventListener:(type,handler)=>{listeners[type]=handler;}},
   logoutUser:scope=>{scopes.push(scope);}};
 vm.createContext(context);
 vm.runInContext(fs.readFileSync(path.join(root,'dynamic-ui-events.js'),'utf8'),context);
 const profileSource=fs.readFileSync(path.join(root,'app-main.js'),'utf8');
 for(const scope of ['local','global']){
   const expression="logoutUser('"+scope+"')";
   assert.ok(profileSource.includes('data-komi-onclick="'+expression+'"'),'profile renders '+scope+' session action');
   assert.equal(context.KomiDynamicEvents.supports('click',expression),true);
   const button={getAttribute:attribute=>attribute==='data-komi-onclick'?expression:null};
   listeners.click({target:{closest:selector=>selector==='[data-komi-onclick]'?button:null}});
 }
 assert.deepEqual(scopes,['local','global']);
 for(const expression of ["logoutUser('other')","logoutUser('local');openAniCoinShop()","logoutUser(window.scope)"])
   assert.equal(context.KomiDynamicEvents.supports('click',expression),false,expression);
 assert.equal(context.KomiDynamicEvents.supports('input',"logoutUser('local')"),false);
});
