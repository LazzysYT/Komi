/* Komi Shop V3 — semantic HTML + Vanilla JS, retaining existing Supabase purchase handlers. */
(function(root){
'use strict';
const state={owner:null,category:'all',sort:'default',hideOwned:false,trial:Object.create(null),sheetOpen:false,reactionPreview:null,busy:false,status:'',timer:null};
const catalog=()=>root.KomiShopCatalog?.items||[];
const find=id=>root.KomiShopCatalog?.find(id)||null;
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=x=>Number(x||0).toLocaleString('ru-RU');
const icon=(name,size=18)=>root.KomiShopIcons?.solid?.(name,size)||root.KomiShopIcons?.svg(name,size)||'✧';
const rarityLabels={common:'Обычный',rare:'Редкий',epic:'Эпический',legendary:'Легендарный'};
const rarityOrder={legendary:0,epic:1,rare:2,common:3};
const categories=[['all','Все'],['frame','Рамки'],['shape','Формы аватара'],['title','Титулы'],
 ['banner','Обложки'],['overlay','Эффекты профиля'],['showcase','Топ-3'],['card','Карточки'],['icon','Иконки'],
 ['plate','Комментарии'],['mascot','Маскоты'],['xp','XP-полоски'],['name','Ники'],['reaction','Watch Party'],['owned','Мои покупки']];
const canCheckout=()=>root.KomiShopCatalog?.canCheckout?.()===true;
const previewOnly=()=>root.KomiShopCatalog?.isPreview?.()===true;
function focusCurrent(selector){
 document.querySelector?.('#shop '+selector)?.focus({preventScroll:true});
}
function safeAvatar(url){
 try{const parsed=new URL(url);return parsed.protocol==='https:'?esc(parsed.href):'';}catch{return '';}
}
function initialAvatar(avatar,name){
 return avatar?'<img src="'+avatar+'" alt="" loading="lazy" data-sv3-user-avatar><span hidden>'+esc((name||'K').charAt(0).toUpperCase())+'</span>':
 '<span aria-hidden="true">'+esc((name||'K').charAt(0).toUpperCase())+'</span>';
}
function visual(product,avatar,name){
 const cls=esc(product.cosmeticClass||'');
 if(product.type==='frame')return '<span class="komi-coin-frame komi-store-'+esc(product.frameClass)+'">'+initialAvatar(avatar,name)+'</span>';
 if(product.type==='shape')return '<span class="sv3-shape komi-store-'+cls+'">'+initialAvatar(avatar,name)+'</span>';
 if(product.type==='title')return '<span class="sv3-title-sample">'+esc(product.title||product.label)+'</span>';
 if(product.type==='banner')return '<span class="store-banner-swatch '+esc(product.bannerClass)+'">KOMI</span>';
 if(product.type==='overlay')return '<span class="sv3-overlay-sample komi-preview-cover"><span class="komi-shop-overlay-layer '+cls+'"></span>ANIME</span>';
 if(product.type==='reaction')return '<span class="komi-shop-reaction-swatch">'+(product.reactions||[]).map(x=>'<span>'+esc(x.emoji)+'</span>').join('')+'</span>';
 if(product.type==='showcase')return '<span class="komi-shop-showcase-demo komi-store-'+cls+'"><i></i><i></i><i></i></span>';
 if(product.type==='icon')return '<span class="komi-shop-icon-swatch komi-store-'+cls+'">'+esc(product.symbol||'✧')+'</span>';
 if(product.type==='card')return '<span class="komi-shop-mini-swatch komi-store-'+cls+'">KOMI</span>';
 if(product.type==='name')return '<span class="sv3-name-sample komi-store-'+cls+'">'+esc(name)+'</span>';
 if(product.type==='plate')return '<span class="sv3-plate-sample komi-store-'+cls+'">Пример комментария</span>';
 if(product.type==='mascot')return '<span class="sv3-mascot-sample"><i class="komi-profile-mascot komi-store-'+cls+'"></i></span>';
 if(product.type==='xp')return '<span class="sv3-xp-sample komi-store-'+cls+'"><progress max="100" value="65">65%</progress></span>';
 return '<span>KOMI</span>';
}
function weekEnd(){
 const d=new Date(),weekday=(d.getUTCDay()+6)%7;
 return Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()+7-weekday);
}
function remaining(){
 const minutes=Math.max(0,Math.ceil((weekEnd()-Date.now())/60000));
 return Math.floor(minutes/1440)+'д '+Math.floor((minutes%1440)/60)+'ч';
}
function selected(){
 return Object.entries(state.trial).map(([type,id])=>find(id)).filter(p=>p&&p.type!=='reaction');
}
function priceOf(items,store){
 const owned=new Set(store?.owned||[]);
 return items.reduce((n,p)=>n+(owned.has(p.id)?0:Number(p.cost)),0);
}
function selectedList(store){
 const items=selected(),owned=new Set(store?.owned||[]);
 if(!items.length)return '<p class="sv3-empty-selection">Нажми на превью карточки: можно сочетать рамку, форму, титул и эффект.</p>';
 return '<div class="sv3-selection-list">'+items.map(p=>
 '<span class="sv3-selection-chip">'+esc(p.label)+(owned.has(p.id)?' · куплено':' · '+fmt(p.cost)+' ♧')+
 '<button type="button" data-v3-remove="'+esc(p.type)+'" aria-label="Убрать '+esc(p.label)+'">×</button></span>').join('')+'</div>';
}
function preview(store,avatar,name){
 const current=type=>find(state.trial[type]||store?.[type+'_id'])||null;
 const frame=current('frame'),shape=current('shape'),title=current('title'),
 banner=current('banner'),overlay=current('overlay'),plate=current('plate'),nameStyle=current('name');
 const selectedIcon=current('icon'),xp=current('xp'),mascot=current('mascot'),
 showcase=current('showcase'),cardStyle=current('card');
 const sets=root.KomiShopCatalog?.activeSets?.(Object.fromEntries(
   ['frame','shape','title','plate','mascot'].map(t=>[t+'_id',current(t)?.id||null])
 ))||[];
 return '<div class="sv3-profile">'+
 '<div class="sv3-profile-cover '+(banner?'komi-store-'+esc(banner.bannerClass):'')+'">'+
 (overlay?'<span class="komi-shop-overlay-layer '+esc(overlay.cosmeticClass)+'"></span>':'')+
 '<span class="sv3-cover-word">KOMI ANIME</span></div>'+
 '<div class="sv3-profile-details">'+
 '<span class="sv3-profile-avatar '+(frame?'komi-store-'+esc(frame.frameClass):'')+'">'+
 '<span class="sv3-avatar-cut '+(shape?'komi-store-'+esc(shape.cosmeticClass):'')+'">'+initialAvatar(avatar,name)+'</span></span>'+
 (mascot?'<span class="sv3-profile-mascot komi-profile-mascot komi-store-'+esc(mascot.cosmeticClass)+'"></span>':'')+
 '<div class="sv3-profile-name"><strong class="'+(nameStyle?'komi-store-'+esc(nameStyle.cosmeticClass):'')+'">'+esc(name)+'</strong>'+
 (selectedIcon?' <span>'+esc(selectedIcon.symbol||'✧')+'</span>':'')+'</div>'+
 '<div class="sv3-profile-title">'+(title?esc(title.title||title.label):'Участник сообщества Komi')+'</div>'+
 '<div class="sv3-profile-level '+(xp?'komi-store-'+esc(xp.cosmeticClass):'')+'"><span>УРОВЕНЬ 5</span><progress value="64" max="100">64%</progress></div>'+
 (sets.length?'<p class="sv3-set-active">✦ Сет: '+sets.map(x=>esc(x.label)).join(', ')+'</p>':'')+
 ((showcase||cardStyle)?'<div class="sv3-extra-samples">'+(showcase?'<div><small>Витрина топ-3</small>'+visual(showcase,avatar,name)+'</div>':'')+
 (cardStyle?'<div><small>Карточка профиля</small>'+visual(cardStyle,avatar,name)+'</div>':'')+'</div>':'')+
 '</div></div>'+
 '<div class="sv3-comment '+(plate?'komi-store-'+esc(plate.cosmeticClass):'')+'">'+
 '<span class="sv3-comment-label">'+icon('movie',13)+' ПРЕДПРОСМОТР КОММЕНТАРИЯ</span>'+
 '<div class="sv3-comment-row"><span class="sv3-comment-avatar '+(shape?'komi-store-'+esc(shape.cosmeticClass):'')+'">'+initialAvatar(avatar,name)+'</span>'+
 '<span><strong class="'+(nameStyle?'komi-store-'+esc(nameStyle.cosmeticClass):'')+'">'+esc(name)+'</strong>'+
 '<small>Эта серия просто невероятная!</small></span></div></div>';
}
function card(p,ctx,avatar,name){
 const store=ctx.store,owner=ctx.owner,owned=!!store?.owned?.includes(p.id);
 const equipped=owned&&store?.[p.type+'_id']===p.id;
 const isReaction=p.type==='reaction';
 const chosen=isReaction?state.reactionPreview===p.id:state.trial[p.type]===p.id;
 const affordable=Number(store?.balance)>=Number(p.cost);
 const diff=Math.max(0,Number(p.cost)-Number(store?.balance||0));
 const operation=isReaction?(owned?'owned':'buy'):equipped?'unequip':owned?'equip':'buy_equip';
 const locked=previewOnly()||(!owned&&!!owner&&!!store&&!canCheckout());
 const label=locked?'Только примерка':!owner?'Войти для покупки':!store?'Загрузка…':isReaction&&owned?'Куплено ✓':
  equipped?'Надето ✓':owned?'Надеть':affordable?'Купить':'Нужно ещё '+fmt(diff)+' AniCoin';
 const disabled=locked||(!!owner&&(!store||ctx.busy||state.busy||(isReaction&&owned)||(!owned&&!affordable)));
 const ariaAction=equipped?'Снять «'+p.label+'»':owned?'Надеть «'+p.label+'»':'Купить «'+p.label+'»';
 return '<article class="komi-coin-card sv3-item '+(equipped?'is-equipped ':'')+(chosen?'is-trying':'')+'" data-rarity="'+esc(p.rarity||'common')+'">'+
 '<div class="sv3-item-badges"><span class="komi-shop-rarity">'+esc(rarityLabels[p.rarity]||rarityLabels.common)+'</span>'+
 (equipped?'<span class="sv3-owned">Надето</span>':owned?'<span class="sv3-owned">Куплено</span>':'')+'</div>'+
 '<button type="button" class="komi-coin-sample sv3-item-scene sv5-preview-button" data-v3-try="'+esc(p.id)+'" aria-pressed="'+String(chosen)+'" aria-label="Примерить '+esc(p.label)+'">'+
 '<span class="sv4-scene-halo" aria-hidden="true"></span>'+visual(p,avatar,name)+'</button>'+
 '<div class="sv3-item-copy"><h3>'+esc(p.label)+'</h3><p class="sv3-unit-price">'+fmt(p.cost)+' AniCoin</p></div>'+
 '<div class="komi-coin-actions sv3-item-actions"><button type="button" class="sv3-primary-buy'+(!owned&&!affordable&&store?' is-insufficient':'')+'" data-shop-item-action="'+esc(p.id)+'" data-shop-operation="'+operation+'" aria-label="'+esc(ariaAction)+'"'+(equipped?' title="Нажми, чтобы снять"':'')+(disabled?' disabled':'')+'>'+label+'</button></div>'+
 '</article>';
}
function currentItems(ctx){
 const owned=new Set(ctx.store?.owned||[]);
 const items=catalog().filter(p=>
    (state.category==='all'||(state.category==='owned'&&owned.has(p.id))||p.type===state.category)
    &&(state.category==='owned'||!state.hideOwned||!owned.has(p.id))
 );
 return items.sort((a,b)=>{
   if(state.sort==='price-up')return a.cost-b.cost||a.label.localeCompare(b.label,'ru');
   if(state.sort==='price-down')return b.cost-a.cost||a.label.localeCompare(b.label,'ru');
   if(state.sort==='rarity')return (rarityOrder[a.rarity]??4)-(rarityOrder[b.rarity]??4)||a.cost-b.cost;
   return 0; // stable sort preserves the configured catalogue order
 });
}
function layout(ctx){
 const owner=ctx.owner||'',store=ctx.store,avatar=safeAvatar(ctx.avatar),name=String(ctx.displayName||'Пользователь Komi').slice(0,54);
 const products=currentItems(ctx),items=selected(),total=priceOf(items,store);
 const bundle=['frame_moon','title_cinema'].map(find).filter(Boolean);
 const bundleTotal=priceOf(bundle,store);
 const premium=!!owner&&root.KomiPremium?.isActiveId?.(owner)===true;
 const all=catalog().length;
 const balance=store?.balance??ctx.wallet?.balance;
 const balanceText=owner?(Number.isFinite(Number(balance))?fmt(balance):'—'):'—';
 const info=owner?(premium?'✦ Premium активен':'Premium · узнать больше'):'Войди, чтобы покупать';
 const tabs=categories.map(([id,label])=>'<button type="button" data-v3-category="'+id+'" aria-pressed="'+String(state.category===id)+'">'+esc(label)+'</button>').join('');
 const sortTabs=[['default','Все'],['rarity','По редкости'],['price-up','Дешевле'],['price-down','Дороже']].map(([id,label])=>'<button type="button" data-v3-sort="'+id+'" aria-pressed="'+String(state.sort===id)+'">'+label+'</button>').join('');
 const reaction=state.reactionPreview?find(state.reactionPreview):null;
 const reactionVisual=reaction&&reaction.type==='reaction'?'<div class="sv5-reaction-preview"><strong>Примерка реакций Watch Party</strong>'+visual(reaction,avatar,name)+'</div>':'';
 const checkoutLocked=previewOnly()||(total>0&&!!owner&&!!store&&!canCheckout());
 const selectionAction=checkoutLocked?'Только примерка':!owner?'Войти, чтобы купить':!store?'Загружаем баланс…':
 items.length===0?'Выбери товары':total>Number(store.balance)?'Недостаточно AniCoin':
 total===0?'Надеть выбранное':'Купить и надеть · '+fmt(total)+' AniCoin';
 const cartDisabled=checkoutLocked||!!owner&&(!store||!items.length||state.busy||ctx.busy||total>Number(store.balance));
 const checkoutNotice=previewOnly()?'Предпросмотр: показаны новые цены. Покупки и подарки отключены.':
   !!owner&&!!store&&!canCheckout()?'Новые цены ещё не подтверждены сервером. Покупки временно недоступны.':'';
 const emptyMessage=state.category==='owned'&&!owner?'Войди, чтобы открыть свои покупки.':
  state.category==='owned'&&!!store?'У тебя пока нет купленных предметов.':'По выбранным фильтрам ничего не найдено.';
 return '<section id="shop" class="anicoin-shop komi-shop-v3 komi-shop-v4 komi-shop-v5" aria-labelledby="anicoin-title">'+
 '<header class="sv3-topbar"><div class="sv3-heading"><p class="sv3-overline">KOMI ANIME / ANI COIN</p><h1 id="anicoin-title">Магазин KomiAnime</h1>'+
 '<p>Укрась профиль, собери свой стиль и примерь предметы до покупки.</p>'+
 '</div>'+ 
 '<div class="sv3-top-actions"><span class="sv3-balance" aria-label="Баланс AniCoin">♧ <strong class="sv3-tabular">'+balanceText+'</strong> AniCoin</span>'+
 '<details class="sv3-earn"><summary>'+icon('plus',16)+' Как получить</summary><div class="sv3-earn-pop"><strong>Как заработать AniCoin</strong>'+
 '<p>1 AniCoin за каждые 20 минут подтверждённого просмотра, награды ежедневных квестов и разовые +500 при активации Premium.</p>'+
 '<a href="/premium.html">Возможности Premium</a></div></details>'+
 '<button type="button" class="sv3-outline-btn" data-v3-promo>'+icon('tag',16)+' Промокод</button></div></header>'+
 (checkoutNotice?'<p class="sv3-price-notice" role="status">'+esc(checkoutNotice)+'</p>':'')+
 '<section class="sv5-weekly" aria-label="Подборка недели"><div class="sv5-weekly-copy">'+
 '<div class="sv5-weekly-overline"><span class="sv3-mini-kicker">ПОДБОРКА НЕДЕЛИ</span>'+
 '<span class="sv3-countdown">'+icon('clock',13)+' <b id="sv3-week-time">'+remaining()+'</b></span></div>'+
 '<h2>Коллекция Komi</h2><p>Лунная рамка и титул «Киноман». Примерка бесплатная.</p>'+
 '<p class="sv5-weekly-price">Набор: '+fmt(bundleTotal)+' AniCoin</p></div>'+
 '<div class="sv5-weekly-items" aria-label="Предпросмотр предметов набора">'+
 bundle.map(p=>'<span class="sv5-weekly-item" title="'+esc(p.label)+'">'+visual(p,avatar,name)+'</span>').join('')+
 '</div><button type="button" class="sv3-featured-try sv5-bundle-btn" data-v3-bundle>'+icon('eye',17)+' Примерить набор</button></section>'+
 '<div class="sv3-filters" aria-label="Категории и фильтры магазина"><div class="sv3-category-tabs" role="group" aria-label="Категории">'+tabs+'</div>'+
 '<div class="sv3-filter-actions"><div class="sv5-sort-segments" role="group" aria-label="Сортировка">'+sortTabs+'</div>'+
 '<label class="sv3-hide-toggle"><input type="checkbox" data-v3-hide-owned'+(state.category==='owned'?' disabled':state.hideOwned?' checked':'')+'><span>Скрыть купленные</span></label></div></div>'+
 '<div class="sv3-layout"><div class="sv3-market"><div class="sv3-market-caption">'+products.length+' из '+all+' товаров'+(state.category==='owned'?' · Мои покупки':'')+'</div>'+
 '<div class="komi-coin-grid sv3-product-grid">'+(products.length?products.map(p=>card(p,ctx,avatar,name)).join(''):
 '<div class="sv3-no-results">'+esc(emptyMessage)+' <button type="button" data-v3-reset-filters>Показать все товары</button></div>')+'</div></div>'+
 '<aside class="sv3-fitting'+(state.sheetOpen?' is-open':'')+'" aria-label="Живая примерочная">'+
 '<button type="button" class="sv3-sheet-toggle" aria-expanded="'+String(state.sheetOpen)+'" data-v3-sheet>'+
 '<span>'+icon('palette',18)+' Живая примерочная <small>'+items.length+' выбрано · '+fmt(total)+' ♧</small></span><span class="sv3-sheet-chevron">'+icon('chevron',18)+'</span></button>'+
 '<div class="sv3-fitting-body"><div class="sv3-fitting-head"><div><span class="sv3-mini-kicker">КОМБИНИРУЙ ДО ПОКУПКИ</span><h2>Живая примерочная</h2></div>'+
 '<button type="button" class="sv3-reset" data-v3-reset>'+icon('reset',15)+' Сбросить</button></div>'+
 preview(store,avatar,name)+reactionVisual+
 '<div class="sv3-selection"><strong>Выбрано для примерки</strong>'+selectedList(store)+'</div>'+
 '<div class="sv3-checkout-info"><span>К оплате <small>Купленные предметы — 0 ♧</small></span><strong class="sv3-tabular">'+fmt(total)+' ♧</strong></div>'+
 '<button class="sv3-checkout" type="button" data-v3-checkout'+(cartDisabled?' disabled':'')+'>'+icon('bag',18)+' '+selectionAction+'</button>'+
 '<p class="sv3-checkout-note">Примерка ничего не списывает. '+esc(info)+'.</p>'+
 '</div></aside></div>'+
 '<div class="sv3-shop-extras"><div id="komiShopSocialArea" class="komi-shop-social"></div></div>'+
 '<p class="sv3-status" role="status" aria-live="polite">'+esc(state.status||ctx.shopStatus||'')+'</p>'+
 (ctx.failedFor?'<button type="button" data-shop-retry class="sv3-retry">Повторить загрузку товаров</button>':'')+
 '<dialog id="sv3PromoDialog" class="sv3-promo-dialog" aria-labelledby="sv3PromoTitle">'+
 '<div class="sv3-promo-content"><h2 id="sv3PromoTitle">Промокоды Komi</h2>'+
 '<p>Промокоды на скидку применяются к подписке Komi Premium, а не к покупкам за AniCoin.</p>'+
 '<a href="/premium.html">Перейти к Premium</a><button type="button" data-v3-promo-close>Закрыть</button></div></dialog>'+
 '</section>';
}
function refresh(){
 if(typeof renderAniCoinShop==='function'&&typeof currentView!=='undefined'&&currentView==='shop')
   renderAniCoinShop(document.getElementById('mainContainer'));
}
function mount(section,ctx){
 for(const img of section.querySelectorAll('[data-sv3-user-avatar]')){
   img.addEventListener('error',()=>{
     img.hidden=true;
     if(img.nextElementSibling)img.nextElementSibling.hidden=false;
   },{once:true});
 }
 section.addEventListener('click',async e=>{
  const t=e.target.closest('button');if(!t)return;
  if(t.hasAttribute('data-v3-category')){
   if(!categories.some(([id])=>id===t.dataset.v3Category))return;
   state.category=t.dataset.v3Category;refresh();
   focusCurrent('[data-v3-category="'+state.category+'"]');return;
  }
  if(t.hasAttribute('data-v3-sort')){
   state.sort=t.dataset.v3Sort;refresh();return;
  }
  if(t.hasAttribute('data-v3-try')){
   const p=find(t.dataset.v3Try);if(!p)return;
   if(p.type==='reaction'){
    state.reactionPreview=state.reactionPreview===p.id?null:p.id;
    state.status='Реакции показаны в примерочной. Покупка выполняется отдельно.';
   }else{
    state.trial[p.type]=state.trial[p.type]===p.id?null:p.id;
    state.status=state.trial[p.type]?'Предмет добавлен в примерочную.':'Предмет убран из примерочной.';
   }
   state.sheetOpen=true;
   refresh();return;
  }
  if(t.hasAttribute('data-v3-bundle')){
   for(const id of ['frame_moon','title_cinema']){const p=find(id);if(p)state.trial[p.type]=id;}
   state.sheetOpen=true;state.status='Состав комплекта добавлен в примерочную. Монеты не списаны.';
   refresh();return;
  }
  if(t.hasAttribute('data-v3-remove')){
   delete state.trial[t.dataset.v3Remove];refresh();return;
  }
  if(t.hasAttribute('data-v3-reset')){
   state.trial=Object.create(null);state.reactionPreview=null;state.status='Примерка очищена.';refresh();return;
  }
  if(t.hasAttribute('data-v3-reset-filters')){
   state.category='all';state.sort='default';state.hideOwned=false;refresh();return;
  }
  if(t.hasAttribute('data-v3-sheet')){
   state.sheetOpen=!state.sheetOpen;refresh();return;
  }
  if(t.hasAttribute('data-v3-promo')){
   section.querySelector('#sv3PromoDialog')?.showModal();return;
  }
  if(t.hasAttribute('data-v3-promo-close')){
   section.querySelector('#sv3PromoDialog')?.close();return;
  }
  if(!t.hasAttribute('data-v3-checkout')||previewOnly())return;
  if(!ctx.owner){if(typeof openAuthModal==='function')openAuthModal('login');return;}
  const items=selected(),total=priceOf(items,ctx.store);
  if(!items.length||!ctx.store||state.busy)return;
  if(total>0&&!canCheckout()){state.status='Сервер ещё не подтвердил новые цены.';refresh();return;}
  if(total>Number(ctx.store.balance)){state.status='Недостаточно AniCoin.';refresh();return;}
  if(!root.komiShopCheckoutCart){state.status='Покупка набора временно недоступна.';refresh();return;}
  if(!root.confirm('Купить и надеть '+items.length+' предмет(ов) за '+total+' AniCoin? Уже купленные предметы будут надеты бесплатно.'))return;
  state.busy=true;state.status='Подтверждаем комплект на сервере…';refresh();
  try{
   const result=await root.komiShopCheckoutCart(items.map(p=>p.id),ctx.owner);
   if(result){
    state.trial=Object.create(null);
    state.status='Готово! Предметы надеты. Списано '+fmt(result.spent)+' AniCoin.';
   }
  }catch(error){state.status=error?.message||'Покупка не прошла. Проверка баланса на сервере.';}
  finally{state.busy=false;refresh();}
 });
 section.addEventListener('change',e=>{
  const t=e.target;
  if(t.matches('[data-v3-sort]')){state.sort=t.value;refresh();}
  else if(t.matches('[data-v3-hide-owned]')){state.hideOwned=t.checked;refresh();focusCurrent('[data-v3-hide-owned]');}
 });
}
function render(container,ctx){
 if(!container)return;
 const owner=ctx.owner||'';
 if(state.owner!==owner){
   state.owner=owner;state.trial=Object.create(null);state.reactionPreview=null;state.sheetOpen=false;state.status='';
 }
 container.innerHTML=layout(ctx);
 const section=container.querySelector('#shop.komi-shop-v3');
 if(section)mount(section,ctx);
 if(!state.timer)state.timer=root.setInterval(()=>{
   const counter=document.getElementById('sv3-week-time');
   if(counter)counter.textContent=remaining();
 },60000);
}
root.KomiShopV3={render,priceOf,selected:()=>selected().map(p=>p.id),reset(){state.trial=Object.create(null);refresh();}};
})(window);
