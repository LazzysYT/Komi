'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const script=fs.readFileSync(path.join(root,'hybrid-search.js'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'community-search.css'),'utf8');

function setup(rowsByColumn){
  class Element {
    constructor(tag='div'){
      this.tagName=tag;
      this.children=[];
      this.attributes={};
      this.listeners={};
      this.className='';
      this.textContent='';
      this.isConnected=true;
      this.classList={add(){},remove(){}};
    }
    append(...items){this.children.push(...items)}
    prepend(...items){this.children.unshift(...items)}
    replaceChildren(...items){this.children=[...items]}
    setAttribute(name,value){this.attributes[name]=value}
    addEventListener(name,callback){this.listeners[name]=callback}
    querySelector(){return null}
    remove(){}
    focus(){}
  }
  const field=new Element('input');
  const dropdown=new Element();
  const calls=[];
  const client={
    from(table){
      assert.equal(table,'komi_profiles');
      const query={column:'recent',count:0,pattern:null};
      const builder={
        select(columns){assert.equal(columns,'username,display_name,avatar_url');return this},
        ilike(column,pattern){query.column=column;query.pattern=pattern;return this},
        order(){return this},
        limit(count){
          query.count=count;
          calls.push({...query});
          return Promise.resolve({data:(rowsByColumn[query.column]||[]).slice(0,count),error:null});
        }
      };
      return builder;
    }
  };
  const document={
    createElement:tag=>new Element(tag),
    getElementById:id=>id==='searchInput'?field:id==='searchDropdown'?dropdown:null,
    querySelector(){return null},
    addEventListener(){}
  };
  const context={document,URL,console,setTimeout:fn=>{queueMicrotask(fn);return 1},clearTimeout(){}};
  context.globalThis=context;
  vm.runInNewContext(script,context,{timeout:2000});
  async function settle(){
    await new Promise(resolve=>setImmediate(resolve));
    await new Promise(resolve=>setImmediate(resolve));
  }
  return {api:context.KomiHybridSearch,field,dropdown,client,calls,settle};
}
const google='google_1234567890abcdef1234567890abcdef';
test('profile lookup searches Cyrillic display name and real username and opens the right account',async()=>{
  const account={username:google,display_name:'Ммонсейдар',avatar_url:''};
  const t=setup({display_name:[account],username:[],recent:[account]});
  const selected=[];
  const search={dropdown:t.dropdown,query:'@Ммон',client:t.client,user:{authUserId:'account-a'},onProfile:handle=>selected.push(handle)};
  assert.equal(t.api.showUsers(search),true);
  await t.settle();
  assert.deepEqual(t.calls.map(c=>c.column).sort(),['display_name','username']);
  assert.equal(t.calls[0].pattern,'%Ммон%');
  const cards=t.dropdown.children.filter(x=>x.className==='komi-search-user-result');
  assert.equal(cards.length,1);
  assert.equal(cards[0].children[1].children[0].textContent,'Ммонсейдар');
  assert.equal(cards[0].children[1].children[1].textContent,'Участник KomiAnime');
  cards[0].listeners.click();
  assert.deepEqual(selected,[google]);
});

test('random digits inside Google-generated identifiers do not match as nicknames',async()=>{
  const t=setup({display_name:[],username:[{username:google,display_name:'Другой человек'}]});
  t.api.showUsers({dropdown:t.dropdown,query:'67',client:t.client,user:{authUserId:'account-a'},onProfile(){}});
  await t.settle();
  assert.equal(t.dropdown.children.filter(x=>x.className==='komi-search-user-result').length,0);
});

test('empty user search browses available profiles and supports showing more',async()=>{
  const rows=Array.from({length:24},(_,n)=>({
    username:'person_'+n,display_name:'User '+n,avatar_url:''
  }));
  const t=setup({recent:rows});
  t.api.showUsers({dropdown:t.dropdown,query:'',client:t.client,user:{authUserId:'account-a'},onProfile(){}});
  await t.settle();
  assert.equal(t.calls.length,1);
  assert.equal(t.calls[0].column,'recent');
  assert.equal(t.dropdown.children.filter(x=>x.className==='komi-search-user-result').length,20);
  const more=t.dropdown.children.find(x=>x.className==='komi-search-user-more');
  assert.ok(more);
  more.listeners.click();
  await t.settle();
  assert.equal(t.dropdown.children.filter(x=>x.className==='komi-search-user-result').length,24);
});

test('anonymous users cannot browse and UI loads a separate monochrome stylesheet',async()=>{
  const t=setup({recent:[{username:'alice',display_name:'Alice'}]});
  t.api.showUsers({dropdown:t.dropdown,query:'',client:t.client,user:null,onProfile(){}});
  await t.settle();
  assert.equal(t.calls.length,0);
  assert.match(t.dropdown.children[1].textContent,/Войди/);
  assert.match(html,/komi\.production\.css\?v=20261125-v811-cinematic/);
  assert.match(html,/hybrid-search\.js\?v=20261122a/);
  assert.match(css,/komi-search-user-result/);
  assert.match(css,/aria-pressed="true"/);
});
