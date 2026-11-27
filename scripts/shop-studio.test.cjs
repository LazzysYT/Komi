'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};};
const sorted=values=>Array.from(values).sort();
const escapeRegex=text=>String(text).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');

function fixture(options={}){
 const handlers={},windowHandlers={},dialogs=[],focusHistory=[],scrollHistory=[],mutations=[],logins=[];
 const viewport={narrow:!!options.narrow,height:options.height??900,reducedMotion:!!options.reducedMotion};
 const collectionRail={scrollLeft:0};
 let previewRegion={scrollTop:0};
 const disclosureHandlers={};
 const disclosures={addEventListener(name,listener){disclosureHandlers[name]=listener;}};
 let focusables=new Map(),markup='',renders=0;
 let actor={owner:'',store:null,wallet:null,displayName:'Гость',avatar:'',...options.ctx};
 const location={};
 const setUrl=url=>{const parsed=new URL(url,location.href||'https://komianime.online/shop');
   Object.assign(location,{href:parsed.href,hostname:parsed.hostname,pathname:parsed.pathname,hash:parsed.hash,search:parsed.search});};
 setUrl(options.url||'https://komianime.online/shop');
 const makeFocus=label=>({isConnected:true,focus(){if(this.disabled||this.hidden)return;focusHistory.push(label);document.activeElement=this;},
   scrollIntoView(settings){scrollHistory.push({selector:label,...settings});},
   setSelectionRange(start,end,direction='none'){this.selection=[start,end];this.selectionStart=start;this.selectionEnd=end;this.selectionDirection=direction;}});
 function selectFocus(selector){
   const attr=selector.match(/\[([^=\]]+)(?:="([^"]*)")?\]/);
   if(attr&&!new RegExp('\\b'+escapeRegex(attr[1])+(attr[2]!==undefined?'="'+escapeRegex(attr[2])+'"':'(?:[\\s=>])')).test(markup))return null;
   if(selector==='#sv7Search'&&!markup.includes('id="sv7Search"'))return null;
   const key=selector==='#sv7Search'?'#shop [data-v7-search]':selector;
   if(!focusables.has(key))focusables.set(key,makeFocus(key));
   const node=focusables.get(key);
   if(attr){
     const attribute=new RegExp('\\b'+escapeRegex(attr[1])+(attr[2]!==undefined?'="'+escapeRegex(attr[2])+'"':'(?:[\\s=>])'));
     const tag=[...markup.matchAll(/<(?:button|input|select)\b[^>]*>/g)].find(match=>attribute.test(match[0]))?.[0]||'';
     node.disabled=/\sdisabled(?:[\s>])/.test(tag);node.hidden=/\shidden(?:[\s>])/.test(tag);
   }
   return node;
 }
 function createDialog(){
   const listeners={},controls={};
   const dialog={open:false,isConnected:false,innerHTML:'',attributes:{},
     setAttribute(name,value){this.attributes[name]=value;},
     addEventListener(name,listener){(listeners[name]??=[]).push(listener);},
     querySelector(selector){return controls[selector]??=makeFocus(selector);},
     showModal(){this.open=true;},
     close(){if(!this.open)return;this.open=false;for(const listener of listeners.close||[])listener({});},
     remove(){this.isConnected=false;const index=dialogs.indexOf(this);if(index>=0)dialogs.splice(index,1);},
     choose(accept){const name=accept?'[data-confirm-accept]':'[data-confirm-cancel]';
       for(const listener of listeners.click||[])listener({target:{closest:selector=>selector===name?{}:null}});},
     cancel(){for(const listener of listeners.cancel||[])listener({preventDefault(){}});}
   };
   return dialog;
 }
 const section={
   addEventListener(name,listener){handlers[name]=listener;},querySelectorAll:()=>[],
   querySelector(selector){return selector==='.sv7-collection-rail'?collectionRail:selector==='.sv7-fitting-scroll'?previewRegion:selector==='.sv7-collections'?disclosures:null;}
 };
 const container={
   get innerHTML(){return markup;},
   set innerHTML(value){for(const element of focusables.values())element.isConnected=false;
     if(document.activeElement&&!document.activeElement.isConnected)document.activeElement=document.body;
     focusables=new Map();previewRegion={scrollTop:0};markup=value;renders++;},
   querySelector(selector){return selector==='#shop.komi-shop-v3'?section:selector==='.sv7-collection-rail'?collectionRail:selector==='.sv7-fitting-scroll'?previewRegion:
     selector==='#shop [data-v7-search]'?selectFocus(selector):null;}
 };
 const document={
   title:'',getElementById:id=>id==='mainContainer'?container:null,
   querySelector:selectFocus,
   createElement(tag){assert.equal(tag,'dialog');return createDialog();},
   body:{isConnected:true,focus(){focusHistory.push('body');document.activeElement=this;},append(dialog){dialog.isConnected=true;dialogs.push(dialog);}}
 };
 document.activeElement=makeFocus('original-control');
 const window={location,
   history:{state:null,replaceState(_state,_title,url){setUrl(url);}},
   matchMedia:query=>({matches:query==='(max-width: 980px)'?viewport.narrow:
     query==='(max-height: 800px)'?viewport.height<=800:
     query==='(prefers-reduced-motion: reduce)'?viewport.reducedMotion:false}),
   addEventListener(name,listener){windowHandlers[name]=listener;},
   confirm(){throw Error('native confirmation must not be used');},
   komiShopCheckoutCart:async(ids,owner)=>{
     mutations.push({ids:Array.from(ids),owner});
     if(options.checkout)return options.checkout(ids,owner,api);
     return {balance:actor.store?.balance||0,owned:Array.from(ids),spent:0};
   }
 };
 const context=vm.createContext({window,document,URL,currentView:'shop',
   openAuthModal:mode=>logins.push(mode),
   renderAniCoinShop:()=>window.KomiShopV3.render(container,actor)
 });
 vm.runInContext(read('komi-shop-catalog.js'),context);
 vm.runInContext(read('komi-shop-icons.js'),context);
 vm.runInContext(read('komi-shop-reactions.js'),context);
 vm.runInContext(read('komi-shop-v3.js'),context);
 const api={context,window,document,container,dialogs,focusHistory,scrollHistory,mutations,logins,handlers,viewport,
   get ctx(){return actor;},get html(){return markup;},get renders(){return renders;},
   get url(){return new URL(location.href);},get products(){return Array.from(window.KomiShopCatalog.items);},
   get collections(){return Array.from(window.KomiShopCatalog.collections);},
   get ids(){return [...markup.matchAll(/data-item-id="([^"]+)"/g)].map(match=>match[1]);},
   get selected(){return Array.from(window.KomiShopV3.selected());},
   get previewScroll(){return previewRegion.scrollTop;},set previewScroll(value){previewRegion.scrollTop=value;},
   get status(){return markup.match(/<p class="sv3-status"[^>]*>([\s\S]*?)<\/p>/)?.[1]||'';},
   product:id=>window.KomiShopCatalog.find(id),
   render(next){if(next)actor={...actor,...next};window.KomiShopV3.render(container,actor);},
   toggleCollections(open){disclosureHandlers.toggle({currentTarget:{open}});api.render();},
   click(name,value,forced=false){
     const tag=[...markup.matchAll(/<button\b[^>]*>/g)].map(match=>match[0]).find(text=>
       new RegExp('\\b'+escapeRegex(name)+(value===undefined?'(?:[\\s=>])':'="'+escapeRegex(value)+'"')).test(text));
     assert.ok(tag,'visible control '+name+(value===undefined?'':'='+value));
     const key=name.replace(/^data-/,'').replace(/-([a-z])/g,(_,letter)=>letter.toUpperCase());
     const button={dataset:{[key]:value??''},disabled:!forced&&/\sdisabled(?:[\s>])/.test(tag),hasAttribute:attribute=>attribute===name};
     return handlers.click({target:{closest:selector=>selector==='button'?button:null}});
   },
   change(name,value){handlers.change({target:{value,checked:value,matches:selector=>selector==='['+name+']'}});},
   input(value,{composing=false,event='input'}={}){
     handlers[event]({isComposing:composing,target:{value,selectionStart:value.length,matches:selector=>selector==='[data-v7-search]'}});
   },
   async enablePricing(){await window.KomiShopCatalog.checkPricing({rpc:async()=>({data:window.KomiShopCatalog.revision})});api.render();},
   setRoute(url){setUrl(url);},
   navigate(url,{view,event='popstate'}={}){setUrl(url);if(view)context.currentView=view;windowHandlers[event]?.();}
 };
 api.render();
 return api;
}

test('pagination exposes each title and new cosmetic once, without retired products',async()=>{
 const f=fixture();assert.equal(f.ids.length,24);const first=f.ids;
 await f.click('data-v7-more');assert.equal(f.ids.length,44);
 assert.deepEqual(f.ids.slice(0,24),first);
 assert.equal(new Set(f.ids).size,44);
 assert.deepEqual(f.ids.filter(id=>f.product(id).type!=='title').sort(),['frame_ghoul_seal','name_mangaka_ink','showcase_personal_cinema','xp_story_rhythm']);
 assert.match(f.html,/data-v7-category-select/);
});

test('local search is case-insensitive, retains fitting choices, and clear restores focus and results',async()=>{
 const f=fixture();
 f.window.KomiShopV3.tryItem('title_collector');
 f.input('кОлЛеКцИоНеР');
 assert.deepEqual(f.ids,['title_collector']);
 assert.equal(f.url.searchParams.get('shop_q'),'кОлЛеКцИоНеР');
 assert.match(f.html,/data-v7-clear-search aria-label="Очистить поиск"/);
 assert.deepEqual(f.selected,['title_collector']);
 await f.click('data-v7-clear-search');
 assert.equal(f.ids.length,24);
 assert.equal(f.url.searchParams.has('shop_q'),false);
 assert.deepEqual(f.selected,['title_collector']);
 assert.equal(f.focusHistory.at(-1),'#shop [data-v7-search]');
});

test('late same-owner hydration preserves cleared-search focus and the current input selection',async()=>{
 const f=fixture();
 f.input('кОлЛеКцИоНеР');
 f.window.KomiShopV3.tryItem('title_collector');
 await f.click('data-v7-clear-search');
 const cleared=f.document.querySelector('#shop [data-v7-search]');
 assert.equal(f.document.activeElement,cleared);
 await Promise.resolve();
 f.render(); // A guest session or catalogue load may finish after the clear click.
 const restored=f.document.querySelector('#shop [data-v7-search]');
 assert.notEqual(restored,cleared,'the full renderer replaced the old input');
 assert.equal(f.document.activeElement,restored,'a later rerender must not send focus to body');
 assert.equal(f.ids.length,24);
 assert.deepEqual(f.selected,['title_collector']);
 f.input('Коллекционер');
 f.document.querySelector('#shop [data-v7-search]').setSelectionRange(2,6,'backward');
 f.render();
 const selectedInput=f.document.querySelector('#shop [data-v7-search]');
 assert.equal(f.document.activeElement,selectedInput);
 assert.deepEqual(selectedInput.selection,[2,6]);
 assert.equal(selectedInput.selectionDirection,'backward');
});

test('hydration does not restore search focus across owners or steal it from an open confirmation',async()=>{
 const f=fixture();
 f.input('Коллекционер');
 f.render({owner:'uid-a',store:{balance:100,owned:[]}});
 assert.equal(f.document.activeElement,f.document.body,'owner change must not reuse the old focus state');
 f.document.querySelector('#shop [data-v7-search]').focus();
 const item=f.product('title_collector');
 const pending=f.window.KomiShopV3.confirmPurchase({items:[item],total:item.cost,balance:100,owner:'uid-a',action:'buy_equip'});
 const cancel=f.document.activeElement;
 assert.equal(f.focusHistory.at(-1),'[data-confirm-cancel]');
 f.render();
 assert.equal(f.document.activeElement,cancel,'body-owned modal keeps focus through shop refresh');
 f.dialogs[0].choose(false);
 await pending;
});

test('search waits for IME composition to finish and escapes the entered query',()=>{
 const f=fixture();
 const before=f.renders;
 f.input('Коллекционер',{composing:true});
 assert.equal(f.renders,before);
 assert.equal(f.ids.length,24);
 f.input('Коллекционер',{event:'compositionend'});
 assert.deepEqual(f.ids,['title_collector']);
 f.input('<img src=x onerror=alert(1)>');
 assert.equal(f.ids.length,0);
 assert.match(f.html,/value="&lt;img src=x onerror=alert\(1\)&gt;"/);
 assert.doesNotMatch(f.html,/<img src=x/);
});

test('empty search offers recovery without discarding a chosen profile look',async()=>{
 const f=fixture();
 f.window.KomiShopV3.tryItem('title_nocturne');
 f.input('zz-no-such-cosmetic');
 assert.equal(f.ids.length,0);
 assert.match(f.html,/Таких предметов пока нет/);
 await f.click('data-v7-browse');
 assert.equal(f.ids.length,24);
 assert.deepEqual(f.selected,['title_nocturne']);
});

test('affordability checks only titles and retains owned high-price titles',async()=>{
 const owned=['title_veteran'],f=fixture({ctx:{owner:'uid-a',store:{balance:15,owned}}});
 f.change('data-v7-affordable',true);
 assert.ok(f.ids.includes('title_veteran'));
 assert.deepEqual(sorted(f.ids),sorted(f.products.filter(p=>p.type==='title'&&f.window.KomiShopCatalog.isOnSale(p.id)&&(p.cost<=15||owned.includes(p.id))).map(p=>p.id)));
 assert.equal(f.url.searchParams.get('shop_available'),'1');
});

test('owned inventory shows exactly server-owned catalogue items and labels equipped items separately',async()=>{
 const f=fixture({ctx:{owner:'uid-a',store:{balance:50,owned:['frame_moon','title_cinema','unknown_retired_item'],frame_id:'frame_moon'}}});
 f.change('data-v3-hide-owned',true);
 await f.click('data-v7-view','owned');
 assert.deepEqual(sorted(f.ids),['frame_moon','title_cinema']);
 assert.match(f.html,/data-shop-item-action="frame_moon" data-shop-operation="unequip"/);
 assert.match(f.html,/data-shop-item-action="title_cinema" data-shop-operation="equip"/);
 assert.match(f.html,/data-v3-hide-owned disabled/);
 assert.doesNotMatch(f.html,/data-item-id="unknown_retired_item"/);
});

test('guest inventory gives an explicit sign-in action without inventing a balance or owned products',async()=>{
 const f=fixture();
 await f.click('data-v7-view','owned');
 assert.equal(f.ids.length,0);
 assert.match(f.html,/Войди, чтобы увидеть свои предметы/);
 assert.match(f.html,/class="sv3-tabular">— <span>AniCoin/);
 await f.click('data-v7-login');
 assert.deepEqual(f.logins,['login']);
 assert.equal(f.mutations.length,0);
});

test('owned inventory distinguishes pending hydration, a failed load, and a verified empty collection',async()=>{
 const f=fixture({ctx:{owner:'uid-a',store:null,loading:true}});
 await f.click('data-v7-view','owned');
 const heading=()=>f.html.match(/class="sv3-no-results"[\s\S]*?<h3>(.*?)<\/h3>/)?.[1];
 assert.match(heading(),/Загружаем твои предметы/);
 assert.doesNotMatch(heading(),/Не удалось/);
 f.render({loading:false,failedFor:'uid-a'});
 assert.match(heading(),/Не удалось загрузить твои предметы/);
 assert.match(f.html,/data-shop-retry/);
 f.render({store:{balance:0,owned:[]},failedFor:''});
 assert.match(heading(),/Здесь появятся твои покупки/);
 assert.doesNotMatch(f.html,/data-shop-retry/);
});

test('legacy collection links still show the current assortment instead of an empty catalog',()=>{
 const f=fixture({url:'https://komianime.online/shop?shop_collection=cinema&shop_category=frame'});
 assert.equal(f.ids.length,24);
 assert.ok(f.ids.every(id=>f.window.KomiShopCatalog.isOnSale(id)));
 assert.doesNotMatch(f.html,/data-v7-collection=|data-v7-look=/);
});

test('editorial title gallery only appears with the title category',()=>{
 assert.doesNotMatch(fixture().html,/sv12-gallery/);
 const f=fixture({url:'https://komianime.online/shop?shop_category=title'});
 assert.match(f.html,/sv12-gallery/);
 assert.doesNotMatch(f.html,/sv7-collections|sv7-starter|sv10-station/);
});

test('previously owned comment plates can still be tried in their real context',()=>{
 const f=fixture({ctx:{owner:'uid-a',store:{balance:0,owned:['plate_manga']}}});
 f.window.KomiShopV3.tryItem('plate_manga');
 assert.deepEqual(f.selected,['plate_manga']);
 assert.match(f.html,/id="sv7CommentPreview">/);
 assert.match(f.html,/sv3-comment komi-store-plate-manga/);
 assert.deepEqual(f.mutations,[]);
});

test('catalogue refresh preserves preview scroll while a new example and account change reset it',async()=>{
 const f=fixture();
 f.window.KomiShopV3.tryItem('title_collector');
 f.previewScroll=160;f.input('Рамка');
 assert.equal(f.previewScroll,160,'search must not jump the independent preview scrollport');
 await f.click('data-v7-preview','comment');
 assert.equal(f.previewScroll,0);
 f.previewScroll=90;f.window.KomiShopV3.tryItem('title_cinema');
 assert.equal(f.previewScroll,0,'the newly selected example starts in view');
 f.previewScroll=80;f.render({owner:'uid-other',store:{balance:100,owned:[]}});
 assert.equal(f.previewScroll,0);
});

test('removing the last trial and reset never send focus to disabled or hidden checkout controls',async()=>{
 for(const narrow of [false,true]){
   const f=fixture({narrow});
   f.window.KomiShopV3.tryItem('title_collector');
   await f.click('data-v3-remove','title');
   assert.deepEqual(f.selected,[]);
   assert.equal(f.focusHistory.at(-1),narrow?'#shop [data-v7-search]':'#shop .sv3-fitting-head h2');
   assert.match(f.html,/data-fitting-active="false"/);
   assert.match(f.html,/data-v3-checkout hidden/);
   f.window.KomiShopV3.tryItem('title_collector');
   await f.click('data-v3-reset');
   assert.equal(f.focusHistory.at(-1),narrow?'#shop [data-v7-search]':'#shop [data-v7-preview="profile"]');
   assert.match(f.html,/data-fitting-active="false"/);
   assert.equal(f.document.activeElement.hidden,false);
   assert.equal(f.document.activeElement.disabled,false);
 }
});

test('trying a featured title does not scroll the storefront automatically',async()=>{
 const f=fixture();
 await f.click('data-v3-try','title_crimson_hunter');
 assert.deepEqual(f.selected,['title_crimson_hunter']);
 assert.deepEqual(f.scrollHistory,[]);
});

test('a different title replaces the first, but an unowned old effect cannot enter the cart',()=>{
 const f=fixture();
 f.window.KomiShopV3.tryItem('title_crimson_hunter');
 f.window.KomiShopV3.tryItem('title_moon_ronin');
 f.window.KomiShopV3.tryItem('frame_moon');
 assert.deepEqual(f.selected,['title_moon_ronin']);
});

test('title catalogue sorts by price and restores the URL page limit',()=>{
 const f=fixture({url:'https://komianime.online/shop?shop_category=title&shop_page=2&shop_sort=price-down'});
 const expected=f.products.filter(p=>p.type==='title'&&f.window.KomiShopCatalog.isOnSale(p.id)).sort((a,b)=>b.cost-a.cost||a.label.localeCompare(b.label,'ru')).map(p=>p.id);
 assert.deepEqual(f.ids,expected);
});

test('returning through SPA navigation reads the provided title search',()=>{
 const f=fixture();
 f.navigate('https://komianime.online/shop?shop_q=Алый+охотник',{view:'shop'});
 assert.deepEqual(f.ids,['title_crimson_hunter']);
});

test('mobile fitting-room toggle and Escape preserve selections while changing the expanded state',async()=>{
 const f=fixture({narrow:true});
 assert.match(f.html,/aria-controls="sv7FittingBody" aria-expanded="false"/);
 f.window.KomiShopV3.tryItem('title_collector');
 assert.match(f.html,/aria-controls="sv7FittingBody" aria-expanded="true"/);
 f.handlers.keydown({key:'Escape'});
 assert.match(f.html,/aria-controls="sv7FittingBody" aria-expanded="false"/);
 assert.deepEqual(f.selected,['title_collector']);
 await f.click('data-v3-sheet');
 assert.match(f.html,/aria-controls="sv7FittingBody" aria-expanded="true"/);
});

test('owner changes clear the previous account trial and pending confirmation',async()=>{
 const f=fixture({ctx:{owner:'uid-a',store:{balance:100,owned:[]}}});
 await f.enablePricing();
 f.window.KomiShopV3.tryItem('title_collector');
 const pending=f.click('data-v3-checkout');
 assert.equal(f.dialogs.length,1);
 f.render({owner:'uid-b',store:{balance:40,owned:[]},displayName:'Другой зритель'});
 await pending;
 assert.equal(f.dialogs.length,0);
 assert.deepEqual(f.selected,[]);
 assert.equal(f.mutations.length,0);
 assert.doesNotMatch(f.status,/Списано|сохранён/);
});

test('checkout cancellation and Escape preserve the trial and never call a paid operation',async()=>{
 const f=fixture({ctx:{owner:'uid-a',store:{balance:100,owned:[]}}});
 await f.enablePricing();
 f.window.KomiShopV3.tryItem('title_collector');
 let pending=f.click('data-v3-checkout');
 const dialog=f.dialogs[0];
 assert.equal(dialog.open,true);
 assert.equal(dialog.attributes['aria-labelledby'],'sv7PurchaseTitle');
 assert.match(dialog.innerHTML,/Баланс: 100 → 80 AniCoin/);
 assert.equal(f.focusHistory.at(-1),'[data-confirm-cancel]');
 dialog.choose(false);
 await pending;
 assert.deepEqual(f.selected,['title_collector']);
 assert.equal(f.mutations.length,0);
 pending=f.click('data-v3-checkout');
 f.dialogs[0].cancel();
 await pending;
 assert.deepEqual(f.selected,['title_collector']);
 assert.equal(f.mutations.length,0);
});

test('Back or hash navigation cancels the body-owned purchase dialog and cannot submit the old cart',async()=>{
 for(const event of ['popstate','hashchange']){
   const f=fixture({ctx:{owner:'uid-a',store:{balance:100,owned:[]}}});
   await f.enablePricing();
   f.window.KomiShopV3.tryItem('title_collector');
   const pending=f.click('data-v3-checkout');
   assert.equal(f.dialogs.length,1);
   f.navigate(event==='hashchange'?'/#catalog':'/catalog',{view:'catalog',event});
   await pending;
   assert.equal(f.dialogs.length,0,event);
   assert.equal(f.mutations.length,0,event);
 }
});

test('confirmation acceptance rechecks the active shop even when a route change emits no browser event',async()=>{
 const f=fixture({ctx:{owner:'uid-a',store:{balance:100,owned:[]}}});
 await f.enablePricing();
 f.window.KomiShopV3.tryItem('title_collector');
 const pending=f.click('data-v3-checkout');
 f.setRoute('/catalog');
 f.context.currentView='catalog';
 f.dialogs[0].choose(true);
 await pending;
 assert.equal(f.mutations.length,0);
 assert.equal(f.dialogs.length,0);
});

test('a changed quotation or balance while confirming prevents checkout and preserves the trial',async()=>{
 for(const changed of ['price','balance']){
   const f=fixture({ctx:{owner:'uid-a',store:{balance:100,owned:[]}}});
   await f.enablePricing();
   f.window.KomiShopV3.tryItem('title_collector');
   const pending=f.click('data-v3-checkout');
   if(changed==='price'){
     const catalog=f.window.KomiShopCatalog;
     f.window.KomiShopCatalog={...catalog,find:id=>id==='title_collector'?{...catalog.find(id),cost:25}:catalog.find(id)};
   }else f.render({store:{balance:12,owned:[]}});
   f.dialogs[0].choose(true);
   await pending;
   assert.equal(f.mutations.length,0,changed);
   assert.deepEqual(f.selected,['title_collector']);
   assert.match(f.status,changed==='price'?/стоимость обновились/:/Баланс изменился/);
 }
});

test('owned-only checkout skips payment confirmation and submits the exact selected IDs',async()=>{
 const f=fixture({ctx:{owner:'uid-a',store:{balance:0,owned:['frame_moon','title_cinema']}}});
 f.window.KomiShopV3.tryItem('frame_moon');
 f.window.KomiShopV3.tryItem('title_cinema');
 await f.click('data-v3-checkout');
 assert.equal(f.dialogs.length,0);
 assert.deepEqual(f.mutations,[{ids:['frame_moon','title_cinema'],owner:'uid-a'}]);
 assert.deepEqual(f.selected,[]);
 assert.match(f.status,/Предметы надеты бесплатно/);
});

test('a failed cart keeps every selected item available for explicit retry without claiming success',async()=>{
 const f=fixture({ctx:{owner:'uid-a',store:{balance:100,owned:[]}},checkout:async()=>{throw Error('Не удалось связаться с сервером.');}});
 await f.enablePricing();
 f.window.KomiShopV3.tryItem('title_collector');
 const pending=f.click('data-v3-checkout');
 f.dialogs[0].choose(true);
 await pending;
 assert.deepEqual(f.selected,['title_collector']);
 assert.equal(f.mutations.length,1);
 assert.equal(f.status,'Не удалось связаться с сервером.');
 assert.doesNotMatch(f.status,/сохранён|не списаны/);
 const retry=f.click('data-v3-checkout');
 assert.equal(f.dialogs.length,1,'a second attempt requires a fresh explicit confirmation');
 f.dialogs[0].choose(false);
 await retry;
 assert.equal(f.mutations.length,1);
});

test('an inflight cart freezes trial controls and submits only its confirmed snapshot',async()=>{
 const gate=deferred(),started=deferred();
 const f=fixture({ctx:{owner:'uid-a',store:{balance:100,owned:[]}},checkout:()=>{started.resolve();return gate.promise;}});
 await f.enablePricing();
 f.window.KomiShopV3.tryItem('title_collector');
 const pending=f.click('data-v3-checkout');
 f.dialogs[0].choose(true);
 await started.promise;
 f.window.KomiShopV3.tryItem('title_cinema');
 await f.click('data-v3-reset',undefined,true);
 await f.click('data-v3-remove','title',true);
 await f.click('data-v3-try','title_yokai_whisper',true);
 assert.deepEqual(f.selected,['title_collector']);
 assert.deepEqual(f.mutations,[{ids:['title_collector'],owner:'uid-a'}]);
 gate.resolve({balance:80,owned:['title_collector'],title_id:'title_collector',spent:20});
 await pending;
 assert.deepEqual(f.selected,[]);
 assert.match(f.status,/Списано 20 AniCoin/);
});

test('direct-item results remain visible after a free preview',async()=>{
 const f=fixture({ctx:{owner:'uid-a',store:{balance:100,owned:[]}}});
 await f.enablePricing();
 const id=f.ids[0];
 f.window.KomiShopV3.tryItem(id);
 assert.equal(f.status,'');
 await f.click('data-shop-item-action',id);
 f.render({shopStatus:'Не удалось выполнить покупку. Проверь соединение.'});
 assert.equal(f.status,'Не удалось выполнить покупку. Проверь соединение.');
});

test('direct mobile action exposes operation errors and retry without requiring a separate preview',async()=>{
 const f=fixture({narrow:true,ctx:{owner:'uid-a',store:{balance:100,owned:[]}}});
 await f.enablePricing();
 assert.match(f.html,/aria-controls="sv7FittingBody" aria-expanded="false"/);
 const id=f.ids[0];
 await f.click('data-shop-item-action',id);
 f.render({shopStatus:'Не удалось применить предмет. Повторная оплата не нужна.',retryApplyItem:id});
 assert.match(f.html,/aria-controls="sv7FittingBody" aria-expanded="true"/);
 assert.equal(f.status,'Не удалось применить предмет. Повторная оплата не нужна.');
 assert.match(f.html,new RegExp('data-shop-item-action="'+id+'" data-shop-operation="equip">Применить купленный предмет'));
});

test('cancelling a direct purchase restores the card when the fitting room is empty',async()=>{
 for(const narrow of [false,true]){
 const f=fixture({narrow,ctx:{owner:'uid-a',store:{balance:100,owned:[]}}});
 await f.enablePricing();
 const id=f.ids[0],selector='#shop [data-shop-item-action="'+id+'"]';
 const core=read('anicoin.js'),start=core.indexOf('async function aniCoinRunStoreAction(');
 const end=core.indexOf("document.addEventListener('click'",start);
 Object.assign(f.context,{
   currentUser:{authUserId:'uid-a'},aniCoinShopOwner:'uid-a',aniCoinShopWallet:f.ctx.store,
   aniCoinShopBusy:false,aniCoinShopPendingAction:null,aniCoinShopRetryApply:null,
   aniCoinShopStatus:'',aniCoinShopFailedFor:'',aniCoinRequest:async()=>{},
   _supabase:{auth:{getUser:async()=>({data:{user:{id:'uid-a'}},error:null})},rpc:async(_name,args)=>{
     assert.equal(args.p_action,'read','cancellation must never send a paid operation');
     return {data:{balance:100,owned:[]},error:null};
   }},
   renderAniCoinShop:()=>f.render({store:f.context.aniCoinShopWallet,busy:f.context.aniCoinShopBusy,shopStatus:f.context.aniCoinShopStatus})
 });
 vm.runInContext(core.slice(start,end),f.context);
 f.document.querySelector(selector).focus();
 await f.click('data-shop-item-action',id);
 const pending=f.context.aniCoinRunStoreAction(id,'buy_equip');
 for(let turn=0;turn<20&&!f.dialogs.length;turn++)await Promise.resolve();
 assert.equal(f.dialogs.length,1);
 assert.equal(f.focusHistory.at(-1),'[data-confirm-cancel]','native confirmation keeps its own focus');
 f.dialogs[0].cancel();
 await pending;
 assert.equal(f.dialogs.length,0);
 assert.equal(f.focusHistory.at(-1),selector);
 assert.equal(f.document.activeElement.isConnected,true);
 if(narrow){assert.match(f.html,/aria-controls="sv7FittingBody" aria-expanded="false"/);assert.match(f.html,/data-fitting-active="false"/);}
 }
});

test('shared confirmation refuses invalid quotes and prevents overlapping purchase dialogs',async()=>{
 const f=fixture({ctx:{owner:'uid-a',store:{balance:100,owned:[]}}});
 const quote={items:[f.product('frame_moon')],total:20,balance:100,owner:'uid-a',action:'buy_equip'};
 assert.equal(await f.window.KomiShopV3.confirmPurchase({...quote,owner:'uid-b'}),false);
 assert.equal(await f.window.KomiShopV3.confirmPurchase({...quote,balance:10}),false);
 assert.equal(f.dialogs.length,0);
 const pending=f.window.KomiShopV3.confirmPurchase(quote);
 assert.equal(await f.window.KomiShopV3.confirmPurchase(quote),false);
 assert.equal(f.dialogs.length,1);
 f.dialogs[0].choose(false);
 assert.equal(await pending,false);
});
