'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const vm=require('node:vm');
const {ENTRY_FILE,STARTUP_FILES,rewriteStartup,prepareStartup}=require('./build-startup.cjs');
const sourceRoot=path.join(__dirname,'..');
const tags=STARTUP_FILES.map((name,i)=>'<script src="/'+name+'?v=20261125-r'+(i+6)+'"></script>');
const fixture='<html><head><style>.guard{display:none}</style>\n'+tags.join('\n<!-- entry order -->\n')+
  '\n<script defer src="/app-main.js?v=fixture"></script></head><body>Native fallback</body></html>';

test('build preparation replaces only the three ordered head requests and inherits the boot version',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'komi-startup-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  fs.writeFileSync(path.join(root,'index.html'),fixture);
  const scripts=[
    'var sharedClassicName = 1; globalThis.order = ["boot"]; // boundary comment',
    '(function(){ sharedClassicName += 2; order.push("premium"); })()',
    '(function(){ sharedClassicName *= 3; order.push("shop"); })()'
  ];
  STARTUP_FILES.forEach((name,i)=>fs.writeFileSync(path.join(root,name),scripts[i]));
  const prepared=prepareStartup(root);
  const expected=fixture.replace(tags[0],'<script src="/komi-home-entry.js?v=20261125-r6"></script>')
    .replace(tags[1],'').replace(tags[2],'');
  assert.equal(prepared.name,ENTRY_FILE);
  assert.equal(prepared.html,expected);
  assert.equal(fs.readFileSync(path.join(root,'index.html'),'utf8'),fixture,'Preparation must not rewrite source HTML');
  STARTUP_FILES.forEach((name,i)=>assert.equal(fs.readFileSync(path.join(root,name),'utf8'),scripts[i]));
  assert.equal(fs.existsSync(path.join(root,ENTRY_FILE)),false,'Only minify emits the generated entry');
  const context=vm.createContext({});
  new vm.Script(prepared.source,{filename:ENTRY_FILE}).runInContext(context);
  assert.equal(context.sharedClassicName,9,'Classic-script globals must survive concatenation');
  assert.equal(JSON.stringify(context.order),'["boot","premium","shop"]');
});

test('the builder rejects missing, duplicate, reordered or changed execution boundaries',()=>{
  const cases=[
    [fixture.replace(tags[1],''),/exactly one premium-entry/],
    [fixture.replace(tags[2],tags[2]+tags[2]),/exactly one shop-first-paint/],
    [fixture.replace(tags[0],'SWAP').replace(tags[1],tags[0]).replace('SWAP',tags[1]),/expected script order/],
    [fixture.replace(tags[0],tags[0].replace('<script ','<script defer ')),/synchronous classic script/],
    [fixture.replace(tags[0],tags[0].replace('<script ','<script type="module" ')),/synchronous classic script/],
    [fixture.replace(tags[1],'<link rel="stylesheet" href="/intervening.css">'+tags[1]),/only comments and whitespace/],
    [fixture.replace(tags[2],'').replace('</body>',tags[2]+'</body>'),/must stay in the head/],
    [fixture.replace('?v=20261125-r6',''),/requires its versioned/]
  ];
  for(const [html,error] of cases)assert.throws(()=>rewriteStartup(html),error);
  assert.equal(rewriteStartup(fixture.replace('<head>','<head><!-- '+tags[0]+' -->')),
    rewriteStartup(fixture).replace('<head>','<head><!-- '+tags[0]+' -->'));
});

function browserFixture(url){
  const location=new URL(url),events=[],classes=new Set(),windowListeners=[],documentListeners=[];
  location.replace=value=>events.push(['replace',value]);
  location.assign=value=>events.push(['assign',value]);
  const document={readyState:'loading',documentElement:{dataset:{},classList:{
    add(...names){names.forEach(name=>classes.add(name));},remove(...names){names.forEach(name=>classes.delete(name));},
    contains(name){return classes.has(name);}
  }},head:{append(node){events.push(['preload',node.href]);}},
  addEventListener(name,callback){documentListeners.push({name,callback});},
  removeEventListener(){},querySelector(){return null;},getElementById(){return null;},
  createElement(tag){return {tagName:tag};}};
  const context={document,location,URLSearchParams,Intl,
    setTimeout(){return 1;},clearTimeout(){},
    MutationObserver:class{observe(){}disconnect(){}},
    addEventListener(name,callback){windowListeners.push({name,callback});}};
  context.window=context;
  return {context:vm.createContext(context),snapshot:()=>({
    classes:[...classes],shop:document.documentElement.dataset.komiShopRoute,
    daily:context.KomiHeroDaily?.first,events,
    windowEvents:windowListeners.map(listener=>listener.name),
    documentEvents:documentListeners.map(listener=>listener.name)
  })};
}

test('real startup IIFEs preserve home, premium, shop and watch entry behavior when combined',()=>{
  const combined=prepareStartup(sourceRoot).source;
  for(const route of ['/', '/#premium','/?ref=friend#premium','/shop','/#shop','/profile','/?anime=61316']){
    const separate=browserFixture('https://komianime.online'+route),bundled=browserFixture('https://komianime.online'+route);
    for(const name of STARTUP_FILES)new vm.Script(fs.readFileSync(path.join(sourceRoot,name),'utf8'),{filename:name}).runInContext(separate.context);
    new vm.Script(combined,{filename:ENTRY_FILE}).runInContext(bundled.context);
    assert.deepEqual(bundled.snapshot(),separate.snapshot(),route+' must keep the standalone entry behavior');
    if(route.includes('#premium'))assert.deepEqual(bundled.snapshot().events,
      [['replace','/premium.html'+(route.includes('?')?'?ref=friend':'')]]);
    if(route==='/shop'||route==='/#shop')assert.equal(bundled.snapshot().shop,'true');
    if(route.includes('?anime='))assert.ok(bundled.snapshot().classes.includes('komi-watch-entry'));
    if(route==='/')assert.equal(bundled.snapshot().events[0]?.[0],'preload');
  }
});
