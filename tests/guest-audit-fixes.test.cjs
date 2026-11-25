'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const test=require('node:test'),assert=require('node:assert/strict');
const read=pathName=>fs.readFileSync(path.join(__dirname,'..',pathName),'utf8');
const between=(name,start,end)=>{const s=read(name);return s.slice(s.indexOf(start),s.indexOf(end,s.indexOf(start)+start.length));};
test('SEO handoff retains the episode even without its season',()=>{
 const links=[];
 const context=vm.createContext({URLSearchParams,document:{querySelector:()=>({content:'62696'}),getElementById:()=>null},
   location:{hash:'#player',search:'?episode=8',replace:value=>links.push(value)},window:{addEventListener(){}}});
 context.window.location=context.location;
 vm.runInContext(read('anime-watch-bridge.js'),context);
 assert.deepEqual(links,['/?anime=62696&episode=8']);
});
test('Watch Party guest sees the existing modal directly with a clear explanation',()=>{
 const calls=[];
 const c=vm.createContext({currentUser:null,_supabase:{},openAuthModal:(...args)=>calls.push(args),alert:()=>assert.fail('unexpected second dialog')});
 vm.runInContext(between('watch-party.js','function partySignedIn()','function partyPanel('),c);
 assert.equal(c.partySignedIn(),false);
 assert.equal(calls.length,1);
 assert.equal(calls[0][0],'login');assert.match(calls[0][1],/смотреть аниме вместе/);
 c.currentUser={authUserId:'member'};
 assert.equal(c.partySignedIn(),true);
 assert.equal(calls.length,1);
});
test('shop guest label describes entering the account, not an immediate purchase',()=>{
 const c=vm.createContext({state:{trial:{}},previewOnly:()=>false,canCheckout:()=>true,fmt:String,esc:String,
   rarityLabels:{common:'Обычный'},visual:()=>'',icon:()=>'',categoryName:()=>''});
 vm.runInContext(between('komi-shop-v3.js','function card(','function collectionCard('),c);
 const item={id:'frame',type:'frame',label:'Ночной бархат',cost:20};
 assert.match(c.card(item,{owner:null},'', ''),/aria-label="Войти, чтобы купить: Ночной бархат">Войти<\/button>/);
 assert.match(c.card(item,{owner:'member',store:{balance:30}},'', ''),/aria-label="Купить: Ночной бархат">Купить<\/button>/);
});
test('header keyboard navigation uses actual focused buttons and returns to search on Escape',()=>{
 let active,closed=0,submits=0;
 const element=(value='')=>({value,focus(){active=this;}});
 const input=element('аниме'),first=element(),second=element(),all=element();
 const results=[first,second,all],dropdown={classList:{contains:()=>true},contains:n=>results.includes(n),querySelectorAll:()=>results};
 const c=vm.createContext({document:{getElementById:key=>key==='searchInput'?input:dropdown},window:{},
   closeSearchDropdown(){closed++;},submitKomiHeaderSearch(){submits++;}});
 vm.runInContext(between('app-main.js','function handleKomiHeaderSearchKeys(',"document.querySelector('#searchInput')"),c);
 function press(key,target){let handled=false;c.handleKomiHeaderSearchKeys({key,target,preventDefault(){handled=true;}});return handled;}
 assert.equal(press('ArrowDown',input),true);assert.equal(active,first);
 assert.equal(press('ArrowDown',first),true);assert.equal(active,second);
 assert.equal(press('ArrowUp',first),true);assert.equal(active,input);
 assert.equal(press('ArrowUp',input),true);assert.equal(active,all);
 assert.equal(press('Enter',all),false,'native focussed button activates itself');
 assert.equal(press('Escape',all),true);assert.equal(active,input);assert.equal(closed,1);
 assert.equal(press('Enter',input),true);assert.equal(submits,1);
});
