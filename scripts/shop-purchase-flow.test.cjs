'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'..','anicoin.js'),'utf8');
const start=source.indexOf('async function aniCoinRunStoreAction(');
const end=source.indexOf("document.addEventListener('click'",start);
assert.ok(start>=0&&end>start,'direct shop action exists');
const actionSource=source.slice(start,end);
const cartStart=source.indexOf('window.komiShopCheckoutCart=async function(');
const cartEnd=source.indexOf('\nfunction renderAniCoinShop(',cartStart);
const cartSource=source.slice(cartStart,cartEnd);
const clone=value=>JSON.parse(JSON.stringify(value));
const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};};

function fixture(options={}){
 const calls=[];
 const confirmations=[];
 let product={id:'frame_moon',type:'frame',label:'Лунная рамка',cost:20};
 let store={balance:100,owned:[],frame_id:null,...options.store};
 let checkout=true;
 let authCalls=0;
 let readCalls=0;
 const ctx=vm.createContext({
   currentUser:{authUserId:'uid-a'},currentView:'shop',
   aniCoinShopOwner:'uid-a',aniCoinShopWallet:clone(store),
   aniCoinShopBusy:false,aniCoinShopPendingAction:null,aniCoinShopRetryApply:null,
   aniCoinShopStatus:'',aniCoinShopFailedFor:'',
   document:{getElementById:()=>null},
   renderAniCoinShop(){},aniCoinRequest:async()=>({balance:store.balance}),
   window:{
     KomiShopCatalog:{
       find:id=>id===product?.id?product:null,
       isPreview:()=>false,canCheckout:()=>checkout,checkPricing:async()=>checkout
     },
     KomiShopV3:{confirmPurchase:async details=>{
       confirmations.push(clone(details));
       return options.confirm?options.confirm(details,api):true;
     }},
     KomiPremiumStore:{refresh:async()=>{}}
   },
   _supabase:{
     auth:{getUser:async()=>{
       authCalls++;
       if(options.auth)return options.auth(authCalls,api);
       return {data:{user:{id:ctx.currentUser?.authUserId}},error:null};
     }},
     rpc:async(name,args)=>{
       assert.equal(name,'komi_premium_store');
       calls.push({...args});
       if(args.p_action==='read'){
         readCalls++;
         return options.read?options.read(readCalls,api):{data:clone(store),error:null};
       }
       if(options.mutate)return options.mutate(args,api);
       if(['buy','buy_equip'].includes(args.p_action)){
         store.balance-=product.cost;
         store.owned.push(product.id);
       }
       if(['equip','buy_equip'].includes(args.p_action))store.frame_id=product.id;
       if(args.p_action==='unequip')store.frame_id=null;
       return {data:clone(store),error:null};
     }
   }
 });
 const api={
   ctx,calls,confirmations,
   get store(){return store;},set store(value){store=value;},
   get product(){return product;},set product(value){product=value;},
   set checkout(value){checkout=value;},
   get mutations(){return calls.filter(call=>call.p_action!=='read');},
   run:operation=>vm.runInContext('aniCoinRunStoreAction("frame_moon",'+JSON.stringify(operation||'buy_equip')+')',ctx)
 };
 vm.runInContext(actionSource,ctx);
 return api;
}

test('direct purchase confirms the verified quote and sends one authoritative buy_equip transaction',async()=>{
 const x=fixture();
 await x.run();
 assert.equal(x.confirmations.length,1);
 assert.deepEqual(x.confirmations[0],{
   items:[{id:'frame_moon',type:'frame',label:'Лунная рамка',cost:20}],
   total:20,balance:100,owner:'uid-a',action:'buy_equip'
 });
 assert.deepEqual(x.mutations,[{p_action:'buy_equip',p_item:'frame_moon'}]);
 assert.equal(x.ctx.aniCoinShopWallet.balance,80);
 assert.equal(x.ctx.aniCoinShopWallet.frame_id,'frame_moon');
 assert.equal(x.ctx.aniCoinShopBusy,false);
 assert.equal(x.ctx.aniCoinShopPendingAction,null);
});

test('direct purchase restores a visible fitting target when hide-owned removes its card',async()=>{
 for(const {narrow,hideOwned,expected} of [
   {narrow:false,hideOwned:false,expected:'card'},
   {narrow:false,hideOwned:true,expected:'heading'},
   {narrow:true,hideOwned:true,expected:'sheet'}
 ]){
   const x=fixture(),focused=[];
   let cardVisible=true;
   const target=name=>({focus:options=>focused.push({name,preventScroll:options?.preventScroll})});
   const card=target('card'),heading=target('heading'),sheet=target('sheet');
   x.ctx.window.matchMedia=query=>({matches:query==='(max-width: 980px)'&&narrow});
   x.ctx.document.querySelector=selector=>{
     if(selector==='#shop [data-shop-item-action="frame_moon"]')return cardVisible?card:null;
     if(selector==='#shop .sv3-fitting-head h2')return heading;
     if(selector==='#shop [data-v3-sheet]')return sheet;
     return null;
   };
   x.ctx.renderAniCoinShop=()=>{
     cardVisible=!hideOwned||!x.ctx.aniCoinShopWallet.owned.includes('frame_moon');
   };
   await x.run();
   assert.equal(cardVisible,!hideOwned,'the final verified ownership determines the filtered card');
   assert.deepEqual(focused,[{name:expected,preventScroll:true}],expected);
   assert.deepEqual(x.mutations,[{p_action:'buy_equip',p_item:'frame_moon'}]);
   assert.equal(x.ctx.aniCoinShopWallet.balance,80);
 }
});

test('cancelling confirmation preserves the previous durable message and does not mutate',async()=>{
 const x=fixture({confirm:()=>false});
 x.ctx.aniCoinShopStatus='Предыдущий результат';
 await x.run();
 assert.deepEqual(x.mutations,[]);
 assert.equal(x.ctx.aniCoinShopStatus,'Предыдущий результат');
 assert.equal(x.ctx.aniCoinShopBusy,false);
});

test('an open asynchronous confirmation blocks duplicate direct actions and shared checkout',async()=>{
 const gate=deferred();
 const entered=deferred();
 const x=fixture({confirm:()=>{entered.resolve();return gate.promise;}});
 const pending=x.run();
 await entered.promise;
 assert.equal(x.ctx.aniCoinShopBusy,true);
 await x.run();
 assert.equal(x.confirmations.length,1);
 assert.equal(x.mutations.length,0);
 vm.runInContext(cartSource,x.ctx);
 await assert.rejects(x.ctx.window.komiShopCheckoutCart(['frame_moon'],'uid-a'),/Выбери от 1 до 12 предметов/);
 gate.resolve(true);
 await pending;
 assert.equal(x.mutations.length,1);
});

test('changing account while the confirmation is open cannot charge either account',async()=>{
 const x=fixture({confirm:(_details,api)=>{
   api.ctx.currentUser={authUserId:'uid-b'};return true;
 }});
 await x.run();
 assert.deepEqual(x.mutations,[]);
 assert.equal(x.ctx.aniCoinShopBusy,false);
 assert.equal(x.ctx.aniCoinShopWallet.balance,100);
});

test('an SDK owner change after confirmation is rejected even if displayed account is stale',async()=>{
 const x=fixture({auth:number=>({data:{user:{id:number>1?'uid-b':'uid-a'}},error:null})});
 await x.run();
 assert.equal(x.confirmations.length,1);
 assert.deepEqual(x.mutations,[]);
 assert.match(x.ctx.aniCoinShopStatus,/Войди в аккаунт повторно/);
});

test('changing account during final authentication prevents the pending RPC',async()=>{
 const x=fixture({auth:(number,api)=>{
   if(number===3)api.ctx.currentUser={authUserId:'uid-b'};
   return {data:{user:{id:'uid-a'}},error:null};
 }});
 await x.run();
 assert.deepEqual(x.mutations,[]);
 assert.equal(x.ctx.aniCoinShopBusy,false);
});

test('a reduced balance after confirmation is reported without a purchase attempt',async()=>{
 const x=fixture({confirm:(_details,api)=>{api.store.balance=12;return true;}});
 await x.run();
 assert.deepEqual(x.mutations,[]);
 assert.equal(x.ctx.aniCoinShopWallet.balance,12);
 assert.match(x.ctx.aniCoinShopStatus,/Баланс изменился.*8 AniCoin/);
});

test('a changed catalogue quote requires a fresh explicit confirmation',async()=>{
 const x=fixture({confirm:(_details,api)=>{api.product={...api.product,cost:25};return true;}});
 await x.run();
 assert.deepEqual(x.mutations,[]);
 assert.match(x.ctx.aniCoinShopStatus,/Цена или предмет изменились/);
});

test('a disabled catalogue checkout after confirmation fails closed',async()=>{
 const x=fixture({confirm:(_details,api)=>{api.checkout=false;return true;}});
 await x.run();
 assert.deepEqual(x.mutations,[]);
 assert.match(x.ctx.aniCoinShopStatus,/сервер ещё не подтвердил цены/);
});

test('an item received while confirming is applied without another purchase',async()=>{
 const x=fixture({confirm:(_details,api)=>{api.store.owned=['frame_moon'];return true;}});
 await x.run();
 assert.deepEqual(x.mutations,[{p_action:'equip',p_item:'frame_moon'}]);
 assert.equal(x.ctx.aniCoinShopWallet.balance,100);
});

test('a stale purchase card for an owned item only applies it and does not ask to pay',async()=>{
 const x=fixture({store:{owned:['frame_moon']}});
 await x.run();
 assert.equal(x.confirmations.length,0);
 assert.deepEqual(x.mutations,[{p_action:'equip',p_item:'frame_moon'}]);
 assert.equal(x.ctx.aniCoinShopWallet.balance,100);
});

test('without the shared accessible confirmation, the direct path never uses a browser confirm or charges',async()=>{
 const x=fixture();
 delete x.ctx.window.KomiShopV3.confirmPurchase;
 x.ctx.window.confirm=()=>{throw Error('native confirm must not run');};
 await x.run();
 assert.deepEqual(x.mutations,[]);
 assert.match(x.ctx.aniCoinShopStatus,/подтверждение покупки/);
});

test('a confirmed purchase without the equipped slot exposes an apply-only retry and persistent message',async()=>{
 let attempts=0;
 const x=fixture({mutate:(args,api)=>{
   attempts++;
   if(attempts===1){api.store.balance=80;api.store.owned=['frame_moon'];}
   else api.store.frame_id='frame_moon';
   return {data:clone(api.store),error:null};
 }});
 await x.run();
 assert.match(x.ctx.aniCoinShopStatus,/куплен, но не надет.*повторной оплаты не будет/);
 assert.deepEqual(clone(x.ctx.aniCoinShopRetryApply),{owner:'uid-a',item:'frame_moon',type:'frame'});
 assert.equal(x.ctx.aniCoinShopWallet.balance,80);
 await x.run('equip');
 assert.deepEqual(x.mutations.map(call=>call.p_action),['buy_equip','equip']);
 assert.equal(x.confirmations.length,1);
 assert.equal(x.ctx.aniCoinShopRetryApply,null);
 assert.equal(x.ctx.aniCoinShopWallet.balance,80);
});

test('a lost purchase response reconciles verified ownership and never retries the charge automatically',async()=>{
 const x=fixture({mutate:(_args,api)=>{
   api.store.balance=80;api.store.owned=['frame_moon'];
   return {data:null,error:Error('Network response lost')};
 }});
 await x.run();
 assert.equal(x.mutations.length,1);
 assert.equal(x.ctx.aniCoinShopWallet.balance,80);
 assert.deepEqual(Array.from(x.ctx.aniCoinShopWallet.owned),['frame_moon']);
 assert.match(x.ctx.aniCoinShopStatus,/остаётся в коллекции, но не надет/);
 assert.equal(x.ctx.aniCoinShopRetryApply.item,'frame_moon');
});

test('unverifiable mutation results show recovery instead of claiming a purchase or refund',async()=>{
 const x=fixture({
   mutate:()=>({data:null,error:Error('Network response lost')}),
   read:(number,api)=>number>=3?{data:null,error:Error('Offline')}:{data:clone(api.store),error:null}
 });
 await x.run();
 assert.equal(x.mutations.length,1);
 assert.equal(x.ctx.aniCoinShopFailedFor,'uid-a');
 assert.match(x.ctx.aniCoinShopStatus,/Не удалось проверить результат.*Обнови магазин/);
 assert.doesNotMatch(x.ctx.aniCoinShopStatus,/куплен|не списаны/);
});

test('cart rechecks the displayed owner after SDK authentication and sends no RPC for a switched account',async()=>{
 const mutations=[];
 const ctx=vm.createContext({
   currentUser:{authUserId:'uid-a'},currentView:'shop',aniCoinShopBusy:false,aniCoinShopOwner:'uid-a',
   aniCoinShopWallet:{balance:100,owned:[]},
   window:{KomiShopCatalog:{find:()=>({id:'frame_moon'}),canCheckout:()=>true,isPreview:()=>false}},
   _supabase:{
     auth:{getUser:async()=>{
       ctx.currentUser={authUserId:'uid-b'};
       return {data:{user:{id:'uid-a'}},error:null};
     }},
     rpc:async(...args)=>{mutations.push(args);return {data:{owned:[],balance:100}};}
   }
 });
 vm.runInContext(cartSource,ctx);
 await assert.rejects(ctx.window.komiShopCheckoutCart(['frame_moon'],'uid-a'),/Аккаунт изменился/);
 assert.deepEqual(mutations,[]);
 assert.equal(ctx.aniCoinShopBusy,false);
});

test('cart cannot submit after navigation away while authentication is pending',async()=>{
 const mutations=[];
 const ctx=vm.createContext({
   currentUser:{authUserId:'uid-a'},currentView:'shop',aniCoinShopBusy:false,aniCoinShopOwner:'uid-a',
   aniCoinShopWallet:{balance:100,owned:[]},
   window:{KomiShopCatalog:{find:()=>({id:'frame_moon'}),canCheckout:()=>true,isPreview:()=>false}},
   _supabase:{
     auth:{getUser:async()=>{
       ctx.currentView='catalog';
       return {data:{user:{id:'uid-a'}},error:null};
     }},
     rpc:async(...args)=>{mutations.push(args);return {data:{owned:[],balance:100}};}
   }
 });
 vm.runInContext(cartSource,ctx);
 await assert.rejects(ctx.window.komiShopCheckoutCart(['frame_moon'],'uid-a'),/Вернись в магазин/);
 assert.deepEqual(mutations,[]);
 assert.equal(ctx.aniCoinShopBusy,false);
});

test('an old inventory read releases the new account load without applying old data or errors',async()=>{
 const loadStart=source.indexOf('async function aniCoinLoadStore(');
 const loadEnd=source.indexOf('window.komiShopReloadStore=',loadStart);
 assert.ok(loadStart>=0&&loadEnd>loadStart);
 for(const oldRequestFails of [false,true]){
   const oldRead=deferred(),newRead=deferred();
   const reads=[],loads=[],renders=[],profiles=[];
   const ctx=vm.createContext({
     currentUser:{authUserId:'uid-a'},currentView:'shop',
     aniCoinShopLoading:false,aniCoinShopFailedFor:'',aniCoinShopStatus:'',
     aniCoinShopOwner:'',aniCoinShopWallet:null,aniCoinShopAvatar:'',
     aniCoinShopRegularAvatar:'',aniCoinShopDisplayName:'Пользователь Komi',
     window:{KomiShopCatalog:{checkPricing:async()=>true},KomiPremium:{refresh:async()=>{}}},
     document:{getElementById:()=>null},
     aniCoinCurrentProfileAvatar:(id,avatar)=>id===ctx.currentUser?.authUserId?avatar:'',
     renderAniCoinShop(){
       const owner=ctx.currentUser?.authUserId;
       const store=owner===ctx.aniCoinShopOwner?ctx.aniCoinShopWallet:null;
       renders.push({owner,loading:ctx.aniCoinShopLoading,store});
       // The production renderer starts a missing current-owner inventory once
       // the shared read flag is released, never while an old read is pending.
       if(owner&&!store&&!ctx.aniCoinShopLoading&&ctx.aniCoinShopFailedFor!==owner)
         loads.push(ctx.aniCoinLoadStore(owner));
     },
     _supabase:{
       rpc:async(name,args)=>{
         assert.equal(name,'komi_premium_store');assert.equal(args.p_action,'read');
         reads.push(ctx.currentUser.authUserId);
         return reads.length===1?oldRead.promise:newRead.promise;
       },
       from:()=>({select(){return this;},eq(_column,id){profiles.push(id);return this;},
         maybeSingle:async()=>({data:{display_name:'Второй зритель',avatar_url:'https://cdn.example.test/b.png'},error:null})})
     }
   });
   vm.runInContext(source.slice(loadStart,loadEnd),ctx);
   const first=ctx.aniCoinLoadStore('uid-a');
   assert.equal(ctx.aniCoinShopLoading,true);
   ctx.currentUser={authUserId:'uid-b'};
   ctx.renderAniCoinShop();
   assert.deepEqual(reads,['uid-a']);
   oldRead.resolve(oldRequestFails?{data:null,error:Error('Private old-account failure')}:
     {data:{balance:900,owned:['frame_shogun']},error:null});
   await first;
   assert.deepEqual(reads,['uid-a','uid-b'],'new account read starts after the old request settles');
   assert.equal(ctx.aniCoinShopWallet,null,'old inventory must never become visible');
   assert.equal(ctx.aniCoinShopOwner,'');
   assert.equal(ctx.aniCoinShopStatus,'','old account errors must not cross into the new account');
   newRead.resolve({data:{balance:15,owned:['title_cinema']},error:null});
   await Promise.all(loads);
   assert.equal(ctx.aniCoinShopOwner,'uid-b');
   assert.equal(ctx.aniCoinShopWallet.balance,15);
   assert.deepEqual(Array.from(ctx.aniCoinShopWallet.owned),['title_cinema']);
   assert.deepEqual(profiles,['uid-b']);
   assert.equal(ctx.aniCoinShopDisplayName,'Второй зритель');
   assert.equal(ctx.aniCoinShopLoading,false);
   assert.equal(renders.at(-1).store.balance,15);
 }
});
