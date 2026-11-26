/* Komi shop studio. Catalog, ownership and purchase RPCs retain their existing owners. */
(function(root){
'use strict';
const PAGE_SIZE=24;
const STARTER_IDS=Object.freeze(['frame_matte','title_cinema']);
const state={owner:null,view:'catalog',category:'all',sort:'default',query:'',collection:'',affordableOnly:false,hideOwned:false,limit:PAGE_SIZE,trial:Object.create(null),sheetOpen:false,previewMode:'profile',reactionPreview:null,busy:false,status:'',routeRead:false,routeSignature:'',collectionsOpen:null};
let latestCtx=null,pendingConfirmation=null,resetPreviewScroll=false;
const catalog=()=>root.KomiShopCatalog?.items||[];
const find=id=>root.KomiShopCatalog?.find(id)||null;
const collections=()=>root.KomiShopCatalog?.collections||[];
const isArchived=id=>root.KomiShopCatalog?.isArchived?.(id)===true;
const forSale=()=>catalog().filter(p=>!isArchived(p.id));
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=x=>Number(x||0).toLocaleString('ru-RU');
const icon=(name,size=18)=>root.KomiShopIcons?.solid?.(name,size)||root.KomiShopIcons?.svg(name,size)||'';
const rarityLabels={common:'Обычный',rare:'Редкий',epic:'Эпический',legendary:'Легендарный'};
const rarityOrder={legendary:0,epic:1,rare:2,common:3};
const categories=[['all','Всё'],['frame','Рамки'],['banner','Обложки'],['name','Ники'],['title','Титулы'],['overlay','Эффекты'],['shape','Формы аватара'],['plate','Комментарии'],['icon','Значки'],['xp','Полоски XP'],['mascot','Маскоты'],['showcase','Витрины топ-3'],['card','Карточки'],['reaction','Реакции']];
const sorts=[['default','Подборка Komi'],['new','Сначала новые'],['price-up','Сначала недорогие'],['price-down','Сначала дорогие'],['rarity','По редкости']];
const categoryName=type=>categories.find(c=>c[0]===type)?.[1]||'Оформление';
const canCheckout=()=>root.KomiShopCatalog?.canCheckout?.()===true;
const previewOnly=()=>root.KomiShopCatalog?.isPreview?.()===true;
const narrow=()=>root.matchMedia?.('(max-width: 980px)')?.matches===true;
const normalized=text=>String(text||'').normalize('NFKC').toLocaleLowerCase('ru-RU').replace(/ё/g,'е');
function focusCurrent(selector){
 let target=document.querySelector?.('#shop '+selector);
 const unavailable=node=>!node||node.disabled||node.hidden||node.closest?.('[hidden]')||(narrow()&&node.closest?.('.sv3-fitting:not(.has-content)'));
 if(unavailable(target))target=document.querySelector?.('#shop '+(narrow()?'.sv3-fitting.has-content [data-v3-sheet]':'.sv3-fitting-head h2'));
 if(unavailable(target))target=document.querySelector?.('#shop [data-v7-search]');
 target?.focus?.({preventScroll:true});
}
function selected(){return Object.values(state.trial).map(find).filter(p=>p&&p.type!=='reaction');}
function priceOf(items,store){const owned=new Set(store?.owned||[]);return items.reduce((sum,p)=>sum+(owned.has(p.id)?0:Number(p.cost)),0);}
function inShop(){return (typeof currentView==='undefined'||currentView==='shop')&&(!root.location?.href||root.location.pathname==='/shop'||String(root.location.hash||'').toLowerCase()==='#shop');}
function route(read=false){
 try{
  if(!root.location?.href||!root.history?.replaceState)return;
  const url=new URL(root.location.href);
  state.routeSignature=url.href;
  if(url.pathname!=='/shop'&&url.hash.toLowerCase()!=='#shop')return;
  if(read){
   const q=url.searchParams;
   state.view=q.get('shop_owned')==='1'?'owned':'catalog';
   state.category=categories.some(x=>x[0]===q.get('shop_category'))?q.get('shop_category'):'all';
   state.sort=sorts.some(x=>x[0]===q.get('shop_sort'))?q.get('shop_sort'):'default';
   state.query=(q.get('shop_q')||'').slice(0,100);
   state.collection=collections().some(x=>x.id===q.get('shop_collection'))?q.get('shop_collection'):'';
   state.affordableOnly=q.get('shop_available')==='1';state.hideOwned=q.get('shop_hide_owned')==='1';
   state.limit=Math.min(240,Math.max(1,Number(q.get('shop_page'))||1))*PAGE_SIZE;
   return;
  }
  const values={shop_owned:state.view==='owned'?'1':'',shop_category:state.category==='all'?'':state.category,shop_sort:state.sort==='default'?'':state.sort,shop_q:state.query,shop_collection:state.collection,shop_available:state.affordableOnly?'1':'',shop_hide_owned:state.hideOwned?'1':'',shop_page:state.limit>PAGE_SIZE?String(Math.ceil(state.limit/PAGE_SIZE)):''};
  for(const [key,value] of Object.entries(values)){if(value)url.searchParams.set(key,value);else url.searchParams.delete(key);}
  root.history.replaceState(root.history.state,'',url.pathname+url.search+url.hash);
  state.routeSignature=url.href;
 }catch{/* A restricted history surface must not prevent browsing. */}
}
function resetFilters(){state.category='all';state.sort='default';state.query='';state.collection='';state.affordableOnly=false;state.hideOwned=false;state.limit=PAGE_SIZE;}
function currentItems(ctx){
 const owned=new Set(ctx.store?.owned||[]),query=normalized(state.query.trim());
 let items=catalog().filter(p=>(state.category==='all'||p.type===state.category)&&
  (state.view==='owned'?owned.has(p.id):!isArchived(p.id))&&(!state.collection||p.collection===state.collection)&&
  (state.view==='owned'||!state.hideOwned||!owned.has(p.id))&&
  (!state.affordableOnly||(!!ctx.owner&&!!ctx.store&&(owned.has(p.id)||Number(p.cost)<=Number(ctx.store.balance))))&&
  (!query||normalized([p.label,p.title,p.description,categoryName(p.type),collections().find(c=>c.id===p.collection)?.label].join(' ')).includes(query)));
 if(state.sort==='price-up')return items.sort((a,b)=>a.cost-b.cost||a.label.localeCompare(b.label,'ru'));
 if(state.sort==='price-down')return items.sort((a,b)=>b.cost-a.cost||a.label.localeCompare(b.label,'ru'));
 if(state.sort==='rarity')return items.sort((a,b)=>(rarityOrder[a.rarity]??4)-(rarityOrder[b.rarity]??4)||a.cost-b.cost);
 if(state.sort==='new')return items.sort((a,b)=>String(b.introducedAt||'').localeCompare(String(a.introducedAt||'')));
 // Alternate supported slots so the first page shows complete looks, not only frames.
 const ordered=[],groups=categories.slice(1).map(([type])=>items.filter(p=>p.type===type).sort((a,b)=>String(b.introducedAt||'').localeCompare(String(a.introducedAt||''))));
 for(let row=0;groups.some(group=>group.length>row);row++)for(const group of groups)if(group[row])ordered.push(group[row]);
 return ordered;
}
function selectedList(store,busy=false){
 const items=selected(),owned=new Set(store?.owned||[]);
 if(!items.length)return '';
 return '<div class="sv3-selection-list">'+items.map(p=>'<div class="sv3-selection-chip"><span><small>'+esc(categoryName(p.type))+'</small>'+esc(p.label)+'</span><span>'+ (owned.has(p.id)?'Куплено':fmt(p.cost)+' AC')+'</span><button type="button" data-v3-remove="'+esc(p.type)+'" aria-label="Убрать '+esc(p.label)+'"'+(busy?' disabled':'')+'>×</button></div>').join('')+'</div>';
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
 if(product.type==='banner')return '<span class="sv8-banner-context"><span class="store-banner-swatch '+esc(product.bannerClass)+'">KOMI</span><span class="sv8-banner-profile"><span class="sv7-card-avatar">'+initialAvatar(avatar,name)+'</span><span>Твой профиль</span></span></span>';
 if(product.type==='overlay')return '<span class="sv3-overlay-sample komi-preview-cover'+(product.id==='overlay_station_rain'?' sv10-station-rain-sample':'')+'"><span class="sv7-cover-motif" aria-hidden="true"></span><span class="komi-shop-overlay-layer '+cls+'"></span><span class="sv7-cover-title">KOMI ANIME</span></span>';
 if(product.type==='reaction')return '<span class="komi-shop-reaction-swatch">'+(product.reactions||[]).map(x=>'<span role="img" aria-label="'+esc(x.label||x.id||'Реакция')+'">'+(root.KomiShopReactions?.render(x.emoji)||esc(x.label||'Реакция'))+'</span>').join('')+'</span>';
 if(product.type==='showcase')return '<span class="komi-shop-showcase-demo komi-store-'+cls+'"><i><b>01</b></i><i><b>02</b></i><i><b>03</b></i></span>';
 if(product.type==='icon')return '<span class="sv7-icon-example"><span>Твой ник</span><span class="komi-shop-icon-swatch komi-store-'+cls+'">'+esc(product.symbol||'✧')+'</span></span>';
 if(product.type==='card')return '<span class="komi-shop-mini-swatch sv7-card-example komi-store-'+cls+'"><span class="sv7-card-avatar">'+initialAvatar(avatar,name)+'</span><span><strong>Твой профиль</strong><small>Участник Komi</small></span></span>';
 if(product.type==='name')return '<span class="sv3-name-sample komi-store-'+cls+'">Твой никнейм</span>';
 if(product.type==='plate')return '<span class="sv3-plate-sample komi-store-'+cls+'"><strong>Твой ник</strong><span>Ещё одну серию?</span></span>';
 if(product.type==='mascot')return '<span class="sv3-mascot-sample"><i class="komi-profile-mascot komi-store-'+cls+'"></i></span>';
 if(product.type==='xp')return '<span class="sv3-xp-sample komi-store-'+cls+'"><span class="sv7-xp-caption">Полоска опыта <small>65%</small></span><progress aria-label="Пример оформления XP" max="100" value="65">65%</progress></span>';
 return '<span>KOMI</span>';
}
// The same renderer still owns card actions and purchase confirmation.
const sceneLabels=Object.freeze({
 frame:'Профиль · рамка аватара',banner:'Профиль · обложка',name:'Профиль · стиль ника',
 title:'Профиль · титул',overlay:'Профиль · эффект обложки',shape:'Профиль · форма аватара',
 plate:'Под аниме · комментарий',icon:'Профиль · значок рядом с ником',xp:'Профиль · полоска XP',
 mascot:'Профиль · маскот',showcase:'Профиль · витрина избранного',card:'Профиль · карточка при наведении',
 reaction:'Watch Party · реакции'
});
function portrait(avatar,name){
 return '<span class="sv7-card-avatar">'+initialAvatar(avatar,name)+'</span>';
}
function contextStrip(avatar,name,caption){
 return '<span class="sv9-context-strip">'+portrait(avatar,name)+'<span><b>Твой профиль</b><small>'+esc(caption)+'</small></span></span>';
}
function cardArtwork(p,avatar,name){
 const artwork=visual(p,avatar,name),cls='komi-store-'+esc(p.cosmeticClass||'');
 let content;
 switch(p.type){
  case 'frame':
  case 'shape':
   content='<span class="sv9-headshot">'+artwork+'<span class="sv9-mini-id">Твой аватар</span></span>';break;
  case 'banner':
   content=artwork;break;
  case 'overlay':
   content='<span class="sv9-cover-shot">'+artwork+contextStrip(avatar,name,'Обложка с эффектом')+'</span>';break;
  case 'title':
   content='<span class="sv9-profile-panel">'+contextStrip(avatar,name,'Титул под ником')+artwork+'</span>';break;
  case 'name':
   content='<span class="sv9-name-shot">'+portrait(avatar,name)+artwork+'</span>';break;
  case 'icon':
   content='<span class="sv9-name-shot">'+portrait(avatar,name)+artwork+'</span>';break;
  case 'xp':
   content='<span class="sv9-profile-panel sv9-level-panel"><span class="sv9-level-top"><b>Уровень 8</b><small>Пример</small></span>'+artwork+'</span>';break;
  case 'mascot':
   content='<span class="sv9-mascot-shot">'+contextStrip(avatar,name,'Шапка профиля')+artwork+'</span>';break;
  case 'plate':
   content='<span class="sv9-comment-shot '+cls+'">'+portrait(avatar,name)+'<span><b>Твой ник</b><small>Ещё одну серию?</small></span></span>';break;
  case 'showcase':
   content='<span class="sv9-showcase-shot"><b>Топ избранного</b>'+artwork+'</span>';break;
  case 'card':
   content='<span class="sv9-hover-shot">'+artwork+'</span>';break;
  case 'reaction':
   content='<span class="sv9-party-shot"><span class="sv9-screen-mark">'+icon('movie',13)+' Watch Party</span>'+artwork+'</span>';break;
  default:content=artwork;
 }
 return '<span class="sv9-plate" data-sv9-kind="'+esc(p.type)+'" aria-hidden="true">'+content+'</span>';
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
 return '<div class="sv7-preview-panel" id="sv7ProfilePreview"'+(state.previewMode==='profile'?'':' hidden')+'><div class="sv3-profile">'+
 '<div class="sv3-profile-cover '+(banner?'komi-store-'+esc(banner.bannerClass):'')+'">'+
 (overlay?'<span class="komi-shop-overlay-layer '+esc(overlay.cosmeticClass)+'"></span>':'')+
 '<span class="sv3-cover-word">KOMI ANIME</span></div>'+
 '<div class="sv3-profile-details">'+
 '<span class="sv3-profile-avatar '+(frame?'komi-store-'+esc(frame.frameClass):'')+'">'+
 '<span class="sv3-avatar-cut '+(shape?'komi-store-'+esc(shape.cosmeticClass):'')+'">'+initialAvatar(avatar,name)+'</span></span>'+
 (mascot?'<span class="sv3-profile-mascot komi-profile-mascot komi-store-'+esc(mascot.cosmeticClass)+'"></span>':'')+
 '<div class="sv3-profile-name"><strong class="'+(nameStyle?'komi-store-'+esc(nameStyle.cosmeticClass):'')+'">'+esc(name)+'</strong>'+
 (selectedIcon?' <span class="komi-store-'+esc(selectedIcon.cosmeticClass)+'">'+esc(selectedIcon.symbol||'✧')+'</span>':'')+'</div>'+
 '<div class="sv3-profile-title">'+(title?esc(title.title||title.label):'Участник сообщества Komi')+'</div>'+
 (xp?'<div class="sv3-profile-level komi-store-'+esc(xp.cosmeticClass)+'"><span>Пример полоски опыта</span><progress aria-label="Пример оформления XP" value="65" max="100">65%</progress></div>':'')+
 (sets.length?'<p class="sv3-set-active">✦ Сет: '+sets.map(x=>esc(x.label)).join(', ')+'</p>':'')+
 ((showcase||cardStyle)?'<div class="sv3-extra-samples">'+(showcase?'<div><small>Витрина топ-3</small>'+visual(showcase,avatar,name)+'</div>':'')+
 (cardStyle?'<div><small>Карточка профиля</small>'+visual(cardStyle,avatar,name)+'</div>':'')+'</div>':'')+
 '</div></div></div>'+
 '<div class="sv7-preview-panel" id="sv7CommentPreview"'+(state.previewMode==='comment'?'':' hidden')+'><div class="sv3-comment '+(plate?'komi-store-'+esc(plate.cosmeticClass):'')+'">'+
 '<span class="sv3-comment-label">'+icon('movie',13)+' В обсуждении аниме</span>'+
 '<div class="sv3-comment-row"><span class="sv3-comment-avatar '+(shape?'komi-store-'+esc(shape.cosmeticClass):'')+'">'+initialAvatar(avatar,name)+'</span>'+
 '<span><strong class="'+(nameStyle?'komi-store-'+esc(nameStyle.cosmeticClass):'')+'">'+esc(name)+'</strong>'+
 '<small>Эта серия просто невероятная!</small></span></div></div><p class="sv7-context-note">Так будут выглядеть твои сообщения под аниме.</p></div>';
}

function card(p,ctx,avatar,name){
 const store=ctx.store,owner=ctx.owner,owned=!!store?.owned?.includes(p.id),equipped=owned&&store?.[p.type+'_id']===p.id;
 const reaction=p.type==='reaction',chosen=reaction?state.reactionPreview===p.id:state.trial[p.type]===p.id;
 const affordable=!!store&&Number(store.balance)>=Number(p.cost),diff=Math.max(0,Number(p.cost)-Number(store?.balance||0));
 const operation=reaction?(owned?'owned':'buy'):equipped?'unequip':owned?'equip':'buy_equip';
 const locked=previewOnly()||(!owned&&!!owner&&!!store&&!canCheckout());
 const label=locked?'Только примерка':!owner?'Войти':!store?(ctx.failedFor?'Нет данных':'Загрузка…'):ctx.busy||state.busy?'Подождите…':reaction&&owned?'Куплено':equipped?'Снять':owned?'Надеть':affordable?(reaction?'Купить':'Купить и надеть'):'Не хватает '+fmt(diff)+' AniCoin';
 const disabled=locked||!!owner&&(!store||ctx.busy||state.busy||reaction&&owned||!owned&&!affordable);
 const action=label+(owner||locked?': ':', чтобы купить: ')+p.label;
 const badge=equipped?'<span class="sv3-owned">Надето</span>':owned?'<span class="sv3-owned">Куплено</span>':p.rarity&&p.rarity!=='common'?'<span class="komi-shop-rarity">'+esc(rarityLabels[p.rarity]||rarityLabels.common)+'</span>':p.introducedAt?'<span class="sv7-new">Новое</span>':'';
 const context=(sceneLabels[p.type]||'Профиль')+(isArchived(p.id)?' · Архив':'');
 return '<article class="komi-coin-card sv3-item '+(equipped?'is-equipped ':'')+(chosen?'is-trying':'')+'" data-rarity="'+esc(p.rarity||'common')+'" data-item-id="'+esc(p.id)+'" data-item-type="'+esc(p.type)+'">'+
 (badge?'<div class="sv3-item-badges">'+badge+'</div>':'')+
 '<button type="button" class="komi-coin-sample sv3-item-scene sv5-preview-button" data-v3-try="'+esc(p.id)+'" aria-pressed="'+String(chosen)+'" aria-label="Примерить '+esc(p.label)+'"'+(state.busy||ctx.busy?' disabled':'')+'>'+cardArtwork(p,avatar,name)+
 '<span class="sv7-try-label">'+icon(chosen?'check':'eye',14)+' '+(chosen?'В примерочной':'Примерить')+'</span></button>'+
 '<div class="sv3-item-copy"><h3>'+esc(p.label)+'</h3><p class="sv7-item-kind">'+esc(context)+'</p>'+
 '<p class="sv7-item-description">'+esc(p.description||descriptionFor(p.type))+'</p><p class="sv3-unit-price">'+icon('coins',16)+' <strong>'+fmt(p.cost)+'</strong> <span>AniCoin</span></p></div>'+
 '<div class="komi-coin-actions sv3-item-actions"><button type="button" class="sv3-primary-buy'+(!owned&&!affordable&&store?' is-insufficient':'')+(owned?' is-owned-action':'')+'" data-shop-item-action="'+esc(p.id)+'" data-shop-operation="'+operation+'" aria-label="'+esc(action)+'"'+(disabled?' disabled':'')+'>'+esc(label)+'</button></div></article>';
}
function descriptionFor(type){return {frame:'Обрамление твоей аватарки.',banner:'Фон шапки твоего профиля.',name:'Оформление имени в профиле.',title:'Небольшая подпись под именем.',shape:'Новый силуэт твоей аватарки.',overlay:'Атмосфера поверх обложки.',plate:'Оформление твоих комментариев.',icon:'Значок рядом с именем.',xp:'Оформление полоски опыта.',mascot:'Компаньон в твоём профиле.',showcase:'Оформление любимой тройки аниме.',card:'Стиль карточки профиля.',reaction:'Реакции для совместного просмотра.'}[type]||'Предмет для твоего профиля.';}
function offerPrice(picks,store){
 const total=priceOf(picks,store),full=picks.reduce((sum,p)=>sum+Number(p.cost),0);
 return total===0?'Уже куплено':(total<full?'К оплате ':'')+fmt(total)+' AniCoin';
}
function collectionCard(collection,store,avatar,name){
 const picks=(collection.preview||[]).map(find).filter(p=>p&&p.type!=='reaction'),frame=picks.find(p=>p.type==='frame'),banner=picks.find(p=>p.type==='banner');
 return '<article class="sv7-collection sv8-ticket '+(state.collection===collection.id?'is-selected':'')+'">'+
 '<div class="sv7-collection-art sv8-ticket-art '+(banner?'komi-store-'+esc(banner.bannerClass):'')+'"><span class="sv7-collection-avatar '+(frame?'komi-store-'+esc(frame.frameClass):'')+'">'+initialAvatar(avatar,name)+'</span></div>'+
 '<div class="sv8-ticket-copy"><button type="button" class="sv7-collection-browse" data-v7-collection="'+esc(collection.id)+'" aria-pressed="'+String(state.collection===collection.id)+'" aria-label="Товары коллекции '+esc(collection.label)+'"><span class="sv7-collection-name">'+esc(collection.label)+'</span><small>'+String((collection.items||[]).length)+' предметов в коллекции '+icon('chevron',12)+'</small></button>'+
 '<p class="sv8-ticket-composition">'+picks.map(p=>esc(p.label)).join(' · ')+'</p><strong class="sv8-ticket-price">'+esc(offerPrice(picks,store))+'</strong>'+
 '<button class="sv7-collection-try" type="button" data-v7-look="'+esc(collection.id)+'" aria-label="Примерить образ '+esc(collection.label)+'"'+(!picks.length||state.busy||latestCtx?.busy?' disabled':'')+'>'+icon('eye',14)+' Примерить образ</button></div></article>';
}
function featuredStation(store,busy){
 const drop=collections().find(c=>c.id==='station-0017');
 if(!drop)return '';
 const picks=drop.preview.map(find).filter(Boolean);
 return '<article class="sv10-station"><span class="sv10-station-art" aria-hidden="true"></span>'+
 '<div class="sv10-station-copy"><p>НОВАЯ КОЛЛЕКЦИЯ</p><h2>Станция 00:17</h2><span>Последний поезд. Мокрый перрон. Ни души.</span>'+
 '<div class="sv10-station-actions"><button type="button" data-v7-collection="station-0017" aria-pressed="'+String(state.collection===drop.id)+'">Смотреть 5 предметов</button><button type="button" data-v7-look="station-0017"'+(busy?' disabled':'')+'>Примерить образ</button></div>'+
 '<small>Образ из 3 предметов · '+esc(offerPrice(picks,store))+'</small></div></article>';
}
function starterCard(store,avatar,name,busy){
 const picks=STARTER_IDS.map(find).filter(Boolean);
 if(picks.length!==STARTER_IDS.length)return '';
 const frame=picks[0],title=picks[1];
 return '<article class="sv7-starter sv8-ticket"><div class="sv8-ticket-art"><span class="sv8-ticket-kicker">'+icon('movie',14)+' ПЕРВЫЙ СЕАНС</span><span class="sv7-starter-avatar komi-store-'+esc(frame.frameClass)+'">'+initialAvatar(avatar,name)+'</span><span class="sv8-ticket-title-sample">'+esc(title.title||title.label)+'</span></div><div class="sv7-starter-copy sv8-ticket-copy"><h3>Первый сеанс</h3><p class="sv8-ticket-composition">'+picks.map(p=>esc(p.label)).join(' · ')+'</p><div class="sv7-starter-action"><strong class="sv8-ticket-price">'+esc(offerPrice(picks,store))+'</strong><button type="button" data-v3-bundle="first-session"'+(busy?' disabled':'')+'>'+icon('eye',14)+' Примерить образ</button></div></div></article>';
}
function layout(ctx){
 const owner=ctx.owner||'',store=ctx.store,avatar=safeAvatar(ctx.avatar),name=String(ctx.displayName||(owner?'Пользователь Komi':'Твой ник')).slice(0,54);
 const products=currentItems(ctx),visible=products.slice(0,state.limit),items=selected(),total=priceOf(items,store),balance=store?.balance??ctx.wallet?.balance;
 const balanceText=owner&&balance!=null&&Number.isFinite(Number(balance))?fmt(balance):'—';
 const ownedCount=catalog().filter(p=>store?.owned?.includes(p.id)).length;
 const checkoutLocked=previewOnly()||total>0&&!!owner&&!!store&&!canCheckout();
 const action=checkoutLocked?'Только примерка':state.busy||ctx.busy?'Подтверждаем…':!owner?'Войти, чтобы купить':!store?(ctx.failedFor?'Баланс недоступен':'Загружаем баланс…'):!items.length?'Выбери предметы':total>Number(store.balance)?'Не хватает '+fmt(total-Number(store.balance))+' AniCoin':total===0?'Надеть выбранное':'Купить и надеть';
 const disabled=checkoutLocked||state.busy||ctx.busy||!!owner&&(!store||!items.length||total>Number(store.balance));
 const notice=previewOnly()?'Предпросмотр оформления. Покупки и подарки здесь отключены.':owner&&store&&!canCheckout()?'Каталог обновляется. Примерка доступна; покупки откроются после подтверждения цен.':'';
 const collection=collections().find(c=>c.id===state.collection);
 const empty=state.view==='owned'&&!owner?'Войди, чтобы увидеть свои предметы.':state.view==='owned'&&!store?(ctx.failedFor?'Не удалось загрузить твои предметы.':'Загружаем твои предметы…'):state.view==='owned'&&!ownedCount?'Здесь появятся твои покупки.':state.affordableOnly&&!owner?'Войди, чтобы подобрать товары по балансу.':'Таких предметов пока нет.';
 const countable=state.view==='owned'?catalog().filter(p=>store?.owned?.includes(p.id)):forSale();
 const counts=Object.fromEntries(categories.map(([id])=>[id,countable.filter(p=>id==='all'||p.type===id).length]));
 const options=categories.map(([id,label])=>'<option value="'+id+'"'+(state.category===id?' selected':'')+'>'+esc(label)+' · '+counts[id]+'</option>').join('');
 const openCollections=state.collectionsOpen===true;
 const reaction=find(state.reactionPreview);
 const hasContent=!!(items.length||reaction||(state.sheetOpen&&(state.busy||ctx.busy||state.status||ctx.shopStatus||ctx.retryApplyItem)));
 const starterVisible=state.view==='catalog'&&state.category==='all'&&!state.collection&&!state.query&&!state.affordableOnly&&!state.hideOwned&&state.sort==='default';
 const sheetSummary=reaction?(items.length?items.length+' выбрано · '+fmt(total)+' AC + реакции':'Реакции · отдельно'):items.length+' выбрано · '+fmt(total)+' AC';
 return '<section id="shop" class="anicoin-shop komi-shop-v3 komi-shop-v4 komi-shop-v5 komi-shop-studio" data-fitting-active="'+String(hasContent)+'" aria-labelledby="anicoin-title">'+
 '<header class="sv3-topbar"><div class="sv3-heading"><h1 id="anicoin-title">Магазин оформления</h1><p>Рамки, обложки и другие украшения для профиля.</p></div>'+
 '<div class="sv3-top-actions"><span class="sv3-balance" aria-label="Баланс AniCoin">'+icon('coins',22)+'<span><small>Твой баланс</small><strong class="sv3-tabular">'+balanceText+' <span>AniCoin</span></strong></span></span>'+
 '<details class="sv3-earn"><summary>'+icon('plus',16)+' Как заработать</summary><div class="sv3-earn-pop"><strong>Как получить AniCoin</strong><p>За каждые 20 минут подтверждённого просмотра — 1 AniCoin. Ежедневные задания тоже приносят награды.</p><p>При активации Premium начисляется разовый бонус 500 AniCoin.</p><a href="/premium.html">Возможности Premium</a><button type="button" data-v3-promo>Есть промокод?</button></div></details></div></header>'+
 (notice?'<p class="sv3-price-notice" role="status">'+esc(notice)+'</p>':'')+
 '<div class="sv7-toolbar" role="search" aria-label="Поиск товаров"><div class="sv7-browse-head"><div class="sv7-view-tabs" role="group" aria-label="Раздел магазина"><button type="button" data-v7-view="catalog" aria-pressed="'+String(state.view==='catalog')+'">Каталог <span>'+forSale().length+'</span></button><button type="button" data-v7-view="owned" aria-pressed="'+String(state.view==='owned')+'">Мои предметы <span>'+ownedCount+'</span></button></div>'+
 '<div class="sv7-search"><svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/></svg><label class="sv7-sr-only" for="sv7Search">Найти оформление</label><input type="search" id="sv7Search" data-v7-search placeholder="Поиск предметов" maxlength="100" autocomplete="off" value="'+esc(state.query)+'">'+(state.query?'<button type="button" data-v7-clear-search aria-label="Очистить поиск">×</button>':'')+'</div></div>'+
 '<div class="sv7-filter-row"><label class="sv7-select sv7-category-select"><span class="sv7-sr-only">Все категории</span><select data-v7-category-select aria-label="Все категории">'+options+'</select>'+icon('chevron',14)+'</label>'+
 '<label class="sv7-select sv7-sort-select"><span class="sv7-sr-only">Сортировка</span><select data-v3-sort aria-label="Сортировка">'+sorts.map(([id,label])=>'<option value="'+id+'"'+(state.sort===id?' selected':'')+'>'+label+'</option>').join('')+'</select>'+icon('chevron',14)+'</label>'+
 '<div class="sv7-toggles"><label class="sv3-hide-toggle"><input type="checkbox" data-v7-affordable'+(state.affordableOnly?' checked':'')+(!owner||!store?' disabled':'')+'><span>По моему балансу</span></label><label class="sv3-hide-toggle"><input type="checkbox" data-v3-hide-owned'+(state.hideOwned&&state.view!=='owned'?' checked':'')+(!owner||!store||state.view==='owned'?' disabled':'')+'><span>Скрыть купленные</span></label></div></div></div>'+
 (starterVisible?featuredStation(store,ctx.busy||state.busy):'')+
 '<div class="sv7-shop-discovery'+(starterVisible?' has-starter':'')+'">'+
 (collections().length?'<details class="sv7-collections"'+(openCollections?' open':'')+'><summary><span>'+icon('layers',16)+' Коллекции <small>'+collections().length+' готовых образов</small></span>'+icon('chevron',14)+'</summary><div class="sv7-collection-rail">'+collections().map(c=>collectionCard(c,store,avatar,name)).join('')+'</div></details>':'')+
 (starterVisible?starterCard(store,avatar,name,state.busy||ctx.busy):'')+'</div>'+
 '<div class="sv3-layout"><div class="sv3-market"><div class="sv3-market-caption"><h2>'+(state.view==='owned'?'Твои предметы':collection?esc(collection.label):state.query?'Результаты поиска':state.category==='all'?'Все товары':esc(categoryName(state.category)))+'</h2><span role="status" aria-live="polite">'+(state.view==='owned'?products.length+' в коллекции':'Товаров: '+products.length)+'</span>'+
 (state.collection||state.query||state.category!=='all'||state.affordableOnly||state.hideOwned?'<button type="button" data-v3-reset-filters>Сбросить фильтры</button>':'')+'</div>'+
 '<div class="komi-coin-grid sv3-product-grid">'+(visible.length?visible.map(p=>card(p,ctx,avatar,name)).join(''):'<div class="sv3-no-results">'+icon('palette',28)+'<h3>'+esc(empty)+'</h3><p>'+(state.view==='owned'?'Посмотри, что есть в каталоге.':'Попробуй другое название или убери фильтры.')+'</p><button type="button" '+(state.view==='owned'&&!owner?'data-v7-login':'data-v7-browse')+'>'+(state.view==='owned'&&!owner?'Войти':'Открыть весь каталог')+'</button></div>')+'</div>'+
 (products.length>visible.length?'<div class="sv7-load-more"><button type="button" data-v7-more>Показать ещё '+Math.min(PAGE_SIZE,products.length-visible.length)+'</button><span>Показано '+visible.length+' из '+products.length+'</span></div>':'')+'</div>'+
 '<aside class="sv3-fitting'+(hasContent?' has-content':'')+(state.sheetOpen&&hasContent?' is-open':'')+'" aria-label="Примерочная"><button type="button" class="sv3-sheet-toggle" aria-controls="sv7FittingBody" aria-expanded="'+String(state.sheetOpen&&hasContent)+'" data-v3-sheet><span>'+icon('palette',20)+' Примерочная <small>'+esc(sheetSummary)+'</small></span><span class="sv3-sheet-chevron">'+icon('chevron',18)+'</span></button>'+
 '<div class="sv3-fitting-body" id="sv7FittingBody"><div class="sv7-fitting-header"><div class="sv3-fitting-head"><h2 tabindex="-1">Примерочная</h2><button type="button" class="sv3-reset" data-v3-reset aria-label="Сбросить примерку"'+(!items.length&&!reaction||state.busy||ctx.busy?' disabled':'')+'>'+icon('reset',16)+'</button></div>'+
 '<div class="sv7-preview-tabs" role="group" aria-label="Где посмотреть оформление"><button type="button" data-v7-preview="profile" aria-controls="sv7ProfilePreview" aria-pressed="'+String(state.previewMode==='profile')+'">Профиль</button><button type="button" data-v7-preview="comment" aria-controls="sv7CommentPreview" aria-pressed="'+String(state.previewMode==='comment')+'">Комментарий</button>'+(reaction?'<button type="button" data-v7-preview="reaction" aria-controls="sv7ReactionPreview" aria-pressed="'+String(state.previewMode==='reaction')+'">Реакции</button>':'')+'</div></div>'+
 '<div class="sv7-fitting-scroll" tabindex="0" role="region" aria-label="Предпросмотр и выбранные предметы"><p class="sv7-preview-note">Примерка не меняет твой профиль.</p>'+preview(store,avatar,name)+(reaction?'<div class="sv7-preview-panel" id="sv7ReactionPreview"'+(state.previewMode==='reaction'?'':' hidden')+'><div class="sv5-reaction-preview"><strong>Реакции Watch Party</strong><div class="sv8-party-context"><span class="sv8-party-screen">'+icon('movie',25)+'<small>Совместный просмотр</small></span><span class="sv8-party-chat"><strong>'+esc(name)+'</strong><small>Вот это момент!</small></span>'+visual(reaction,avatar,name)+'</div><small>'+(store?.owned?.includes(reaction.id)?'Набор уже в коллекции.':fmt(reaction.cost)+' AC · Покупаются отдельно на карточке.')+'</small></div></div>':'')+
 (items.length?'<div class="sv3-selection"><strong>В образе <span>'+items.length+'</span></strong>'+selectedList(store,state.busy||ctx.busy)+'</div>':'')+'</div><div class="sv7-checkout-footer">'+'<p class="sv3-status" role="status" aria-live="polite">'+esc(state.status||ctx.shopStatus||'')+'</p>'+(ctx.retryApplyItem?'<button type="button" class="sv3-retry" data-shop-item-action="'+esc(ctx.retryApplyItem)+'" data-shop-operation="equip">Применить купленный предмет</button>':'')+
 (items.length?'<div class="sv3-checkout-info"><span>'+(total===0?'Уже в коллекции':'К оплате')+'</span><strong class="sv3-tabular">'+fmt(total)+' <small>AniCoin</small></strong></div>':'<p class="sv3-empty-selection">Нажми «Примерить» на понравившемся товаре.</p>')+
 '<button class="sv3-checkout" type="button" data-v3-checkout'+(!items.length?' hidden':'')+(disabled?' disabled':'')+'>'+icon('bag',18)+' '+esc(action)+'</button>'+(items.length?'<p class="sv3-checkout-note">'+(owner&&store&&total<=Number(store.balance)?'Останется '+fmt(Number(store.balance)-total)+' AniCoin · списание после подтверждения':'Списание только после подтверждения.')+'</p>':'')+'</div></div></aside></div>'+
 (ctx.failedFor?'<button type="button" data-shop-retry class="sv3-retry">Повторить загрузку баланса и покупок</button>':'')+
 '<details class="sv7-extras"><summary>'+icon('gift',18)+' Подарки и дополнительные возможности '+icon('chevron',16)+'</summary><div class="sv3-shop-extras"><div id="komiShopSocialArea" class="komi-shop-social"></div></div></details>'+
 '<dialog id="sv3PromoDialog" class="sv3-promo-dialog" aria-labelledby="sv3PromoTitle"><div class="sv3-promo-content"><h2 id="sv3PromoTitle">Промокоды Komi</h2><p>Промокоды на скидку применяются к подписке Komi Premium. Предметы в этом магазине покупаются за AniCoin.</p><a href="/premium.html">Перейти к Premium</a><button type="button" data-v3-promo-close>Закрыть</button></div></dialog></section>';
}
function refresh(selector){
 if(typeof renderAniCoinShop==='function'&&typeof currentView!=='undefined'&&currentView==='shop')renderAniCoinShop(document.getElementById('mainContainer'));
 if(selector)focusCurrent(selector);
}
function filterChanged(selector){state.limit=PAGE_SIZE;route();refresh(selector);}
function tryItem(id){
 if(state.busy||latestCtx?.busy)return;
 const p=find(id);if(!p||(isArchived(id)&&!latestCtx?.store?.owned?.includes(id)))return;
 if(p.type==='reaction'){state.reactionPreview=state.reactionPreview===id?null:id;}
 else{state.trial[p.type]=state.trial[p.type]===id?null:id;}
 const chosen=p.type==='reaction'?state.reactionPreview===id:state.trial[p.type]===id;
 state.previewMode=chosen?(p.type==='reaction'?'reaction':p.type==='plate'?'comment':'profile'):(state.reactionPreview?'reaction':state.trial.plate?'comment':'profile');
 state.status='';resetPreviewScroll=true;
 state.sheetOpen=!!(selected().length||state.reactionPreview);
 refresh(narrow()&&state.sheetOpen?'[data-v3-sheet]':'[data-v3-try="'+id+'"]');
}
function confirmPurchase(quote){
 if(pendingConfirmation||!quote?.items?.length||!Number.isSafeInteger(quote.total)||quote.total<0||!Number.isSafeInteger(quote.balance)||quote.balance<quote.total||quote.owner!==latestCtx?.owner)return Promise.resolve(false);
 if(!document.createElement||!document.body)return Promise.resolve(false);
 const dialog=document.createElement('dialog');dialog.className='sv7-purchase-dialog';
 dialog.setAttribute('aria-labelledby','sv7PurchaseTitle');dialog.setAttribute('aria-describedby','sv7PurchaseNote');
 const focusBefore=document.activeElement,owned=new Set(latestCtx?.store?.owned||[]);
 const focusSelector=focusBefore?.matches?.('[data-v7-search]')?'[data-v7-search]':'[data-v3-checkout]';
 dialog.innerHTML='<div class="sv7-confirm-heading"><span>'+icon('bag',22)+'</span><h2 id="sv7PurchaseTitle">Подтвердить покупку</h2></div><p id="sv7PurchaseNote">'+(quote.action==='buy'?'Предмет останется в твоей коллекции.':'Предметы останутся в твоей коллекции и будут надеты на профиль.')+'</p><ul class="sv7-confirm-items">'+quote.items.map(p=>'<li><span>'+esc(p.label)+'</span><strong>'+ (owned.has(p.id)?'Куплено':fmt(p.cost)+' AC')+'</strong></li>').join('')+'</ul><div class="sv7-confirm-total"><span>К оплате</span><strong>'+fmt(quote.total)+' AniCoin</strong></div><p class="sv7-confirm-balance">Баланс: '+fmt(quote.balance)+' → '+fmt(quote.balance-quote.total)+' AniCoin</p><div class="sv7-confirm-actions"><button type="button" data-confirm-cancel>Отмена</button><button type="button" data-confirm-accept>Купить за '+fmt(quote.total)+' AniCoin</button></div>';
 return new Promise(resolve=>{
  let settled=false;
  const finish=answer=>{if(settled)return;answer=!!answer&&inShop()&&quote.owner===latestCtx?.owner;settled=true;pendingConfirmation=null;if(dialog.open)dialog.close();dialog.remove();if(focusBefore?.isConnected&&!focusBefore.disabled&&!focusBefore.hidden&&!focusBefore.closest?.('[hidden]'))focusBefore.focus({preventScroll:true});else if(inShop()&&quote.owner===latestCtx?.owner)focusCurrent(focusSelector);resolve(answer);};
  pendingConfirmation={owner:quote.owner,cancel:()=>finish(false)};
  dialog.addEventListener('cancel',event=>{event.preventDefault();finish(false);});
  dialog.addEventListener('close',()=>finish(false));
  dialog.addEventListener('click',event=>{if(event.target.closest('[data-confirm-cancel]'))finish(false);if(event.target.closest('[data-confirm-accept]'))finish(true);});
  document.body.append(dialog);
  try{dialog.showModal();dialog.querySelector('[data-confirm-cancel]').focus();}catch{finish(false);}
 });
}
async function checkout(ctx){
 if(previewOnly()||state.busy||ctx.busy||!inShop())return;
 if(!ctx.owner){if(typeof openAuthModal==='function')openAuthModal('login');return;}
 const items=selected().map(p=>({...p})),total=priceOf(items,ctx.store),owner=ctx.owner;
 if(!items.length||!ctx.store||total>Number(ctx.store.balance))return;
 if(total>0&&!canCheckout()){state.status='Цены ещё не подтверждены. Попробуй чуть позже.';refresh();return;}
 if(!root.komiShopCheckoutCart){state.status='Не удалось подготовить покупку. Обнови страницу и попробуй снова.';refresh();return;}
 state.busy=true;state.status='';refresh();
 try{
  if(total>0&&!await confirmPurchase({items,total,balance:Number(ctx.store.balance),owner,action:'buy_equip'}))return;
  if(state.owner!==owner||latestCtx?.owner!==owner||!inShop())return;
  const current=items.map(p=>find(p.id));
  if(current.some((p,index)=>!p||p.cost!==items[index].cost)||priceOf(current,latestCtx.store)!==total){state.status='Состав или стоимость обновились. Проверь примерку и подтверди покупку ещё раз.';return;}
  if(total>0&&!canCheckout())throw Error('Каталог обновляется. Подтверди покупку после обновления цен.');
  if(!latestCtx.store||total>Number(latestCtx.store.balance))throw Error('Баланс изменился. Проверь доступные AniCoin.');
  state.status='Сохраняем оформление…';refresh();
  const result=await root.komiShopCheckoutCart(items.map(p=>p.id),owner);
  if(state.owner!==owner)return;
  if(result){state.trial=Object.create(null);state.status='Оформление сохранено. '+(Number(result.spent)>0?'Списано '+fmt(result.spent)+' AniCoin.':'Предметы надеты бесплатно.');}
 }catch(error){if(state.owner===owner)state.status=error?.message||'Не удалось подтвердить покупку. Проверь баланс и попробуй снова.';}
 finally{if(state.owner===owner){state.busy=false;refresh('[data-v3-checkout]');}}
}
function mount(section,ctx){
 for(const img of section.querySelectorAll('[data-sv3-user-avatar]'))img.addEventListener('error',()=>{img.hidden=true;if(img.nextElementSibling)img.nextElementSibling.hidden=false;},{once:true});
 section.querySelector?.('.sv7-collections')?.addEventListener('toggle',event=>{state.collectionsOpen=event.currentTarget.open;});
 section.addEventListener('click',async event=>{
  const t=event.target.closest('button');if(!t||t.disabled)return;
  if(t.hasAttribute('data-shop-item-action')){state.status='';if(narrow()&&ctx.owner)state.sheetOpen=true;return;}
  if((state.busy||ctx.busy)&&['data-v3-try','data-v7-look','data-v3-bundle','data-v3-remove','data-v3-reset'].some(attr=>t.hasAttribute(attr)))return;
  if(t.hasAttribute('data-v3-category')){const id=t.dataset.v3Category;if(id==='owned'){state.view='owned';state.category='all';}else if(categories.some(c=>c[0]===id))state.category=id;else return;filterChanged('[data-v3-category="'+id+'"]');return;}
  if(t.hasAttribute('data-v7-view')){state.view=t.dataset.v7View==='owned'?'owned':'catalog';resetFilters();filterChanged('[data-v7-view="'+state.view+'"]');return;}
  if(t.hasAttribute('data-v3-sort')){if(sorts.some(s=>s[0]===t.dataset.v3Sort))state.sort=t.dataset.v3Sort;filterChanged('[data-v3-sort]');return;}
  if(t.hasAttribute('data-v3-try')){tryItem(t.dataset.v3Try);return;}
  if(t.hasAttribute('data-v7-preview')){const mode=t.dataset.v7Preview;state.previewMode=mode==='reaction'&&state.reactionPreview?'reaction':mode==='comment'?'comment':'profile';resetPreviewScroll=true;refresh('[data-v7-preview="'+state.previewMode+'"]');return;}
  if(t.hasAttribute('data-v7-collection')){state.collection=state.collection===t.dataset.v7Collection?'':t.dataset.v7Collection;state.view='catalog';state.category='all';state.query='';filterChanged(t.closest?.('.sv10-station')?'[data-v3-reset-filters]':'[data-v7-collection="'+t.dataset.v7Collection+'"]');return;}
  if(t.hasAttribute('data-v7-look')||t.hasAttribute('data-v3-bundle')){
   const starter=t.hasAttribute('data-v3-bundle'),collection=collections().find(c=>c.id===t.dataset.v7Look);
    if(!starter&&!collection)return;
    const ids=starter?STARTER_IDS:collection.preview;
    state.trial=Object.create(null);state.reactionPreview=null;
   for(const id of ids){const p=find(id);if(p&&p.type!=='reaction')state.trial[p.type]=id;}
   state.sheetOpen=true;state.previewMode='profile';state.status='';resetPreviewScroll=true;
   refresh(narrow()?'[data-v3-sheet]':'.sv3-fitting-head h2');
   if(!narrow())document.querySelector?.('#shop .sv3-fitting')?.scrollIntoView?.({
    block:'start',behavior:root.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches?'auto':'smooth'
   });
   return;
  }
  if(t.hasAttribute('data-v3-remove')){delete state.trial[t.dataset.v3Remove];if(!selected().length&&!state.reactionPreview){state.sheetOpen=false;state.status='';}refresh(narrow()&&!selected().length&&!state.reactionPreview?'[data-v7-search]':'[data-v3-reset]');return;}
  if(t.hasAttribute('data-v3-reset')){state.trial=Object.create(null);state.reactionPreview=null;state.previewMode='profile';state.sheetOpen=false;state.status='';resetPreviewScroll=true;refresh(narrow()?'[data-v7-search]':'[data-v7-preview="profile"]');return;}
  if(t.hasAttribute('data-v3-reset-filters')||t.hasAttribute('data-v7-browse')){if(t.hasAttribute('data-v7-browse'))state.view='catalog';resetFilters();route();refresh('[data-v7-search]');return;}
  if(t.hasAttribute('data-v7-clear-search')){state.query='';filterChanged('[data-v7-search]');return;}
  if(t.hasAttribute('data-v7-more')){const nextId=currentItems(ctx)[state.limit]?.id;state.limit+=PAGE_SIZE;route();refresh(nextId?'[data-v3-try="'+nextId+'"]':'[data-v7-more]');return;}
  if(t.hasAttribute('data-v3-sheet')){state.sheetOpen=!state.sheetOpen;refresh('[data-v3-sheet]');return;}
  if(t.hasAttribute('data-v7-login')){if(typeof openAuthModal==='function')openAuthModal('login');return;}
  if(t.hasAttribute('data-v3-promo')){section.querySelector('#sv3PromoDialog')?.showModal();return;}
  if(t.hasAttribute('data-v3-promo-close')){section.querySelector('#sv3PromoDialog')?.close();return;}
  if(t.hasAttribute('data-v3-checkout'))await checkout(ctx);
 });
 const search=event=>{
  if(!event.target.matches?.('[data-v7-search]')||event.isComposing)return;
  state.query=event.target.value.slice(0,100);const caret=event.target.selectionStart;
  filterChanged('[data-v7-search]');const input=document.querySelector?.('#sv7Search');try{input?.setSelectionRange(caret,caret);}catch{}
 };
 section.addEventListener('input',search);section.addEventListener('compositionend',search);
 section.addEventListener('change',event=>{
  const t=event.target;
  if(t.matches('[data-v3-sort]')){state.sort=sorts.some(s=>s[0]===t.value)?t.value:'default';filterChanged('[data-v3-sort]');}
  else if(t.matches('[data-v7-category-select]')){state.category=categories.some(c=>c[0]===t.value)?t.value:'all';filterChanged('[data-v7-category-select]');}
  else if(t.matches('[data-v3-hide-owned]')){state.hideOwned=t.checked;filterChanged('[data-v3-hide-owned]');}
  else if(t.matches('[data-v7-affordable]')){state.affordableOnly=t.checked;filterChanged('[data-v7-affordable]');}
 });
 section.addEventListener('keydown',event=>{if(event.key==='Escape'&&state.sheetOpen&&narrow()){state.sheetOpen=false;refresh('[data-v3-sheet]');}});
}
function render(container,ctx){
 if(!container)return;latestCtx=ctx;
 if(!state.routeRead||(root.location?.href&&root.location.href!==state.routeSignature)){route(true);state.routeRead=true;}
 const owner=ctx.owner||'';
 const previousSearch=container.querySelector?.('#shop [data-v7-search]');
 const searchFocus=state.owner===owner&&previousSearch&&document.activeElement===previousSearch
  ?{start:previousSearch.selectionStart,end:previousSearch.selectionEnd,direction:previousSearch.selectionDirection}:null;
 if(state.owner!==owner){if(pendingConfirmation&&pendingConfirmation.owner!==owner)pendingConfirmation.cancel();state.owner=owner;state.trial=Object.create(null);state.reactionPreview=null;state.previewMode='profile';state.sheetOpen=false;state.busy=false;state.status='';resetPreviewScroll=true;}
 const scroll=container.querySelector?.('.sv7-collection-rail')?.scrollLeft||0;
 const previewScroll=resetPreviewScroll?0:container.querySelector?.('.sv7-fitting-scroll')?.scrollTop||0;
 resetPreviewScroll=false;
 container.innerHTML=layout(ctx);const section=container.querySelector('#shop.komi-shop-v3');
 if(section){mount(section,ctx);const rail=section.querySelector?.('.sv7-collection-rail');if(rail)rail.scrollLeft=scroll;const previewRegion=section.querySelector?.('.sv7-fitting-scroll');if(previewRegion)previewRegion.scrollTop=previewScroll;}
 // Session/catalogue hydration can repaint after an input or clear handler has
 // already restored focus. Preserve only the current owner's active search.
 if(searchFocus){
  const input=container.querySelector?.('#shop [data-v7-search]');
  input?.focus?.({preventScroll:true});
  if(Number.isInteger(searchFocus.start)&&Number.isInteger(searchFocus.end))
   try{input?.setSelectionRange?.(searchFocus.start,searchFocus.end,searchFocus.direction);}catch{}
 }
 document.title='Магазин оформления — KomiAnime';
}
function routeChanged(){if(!inShop()){pendingConfirmation?.cancel();return;}route(true);refresh();}
root.addEventListener?.('popstate',routeChanged);root.addEventListener?.('hashchange',routeChanged);
root.KomiShopV3={render,priceOf,confirmPurchase,tryItem,selected:()=>selected().map(p=>p.id),reset(){state.trial=Object.create(null);state.reactionPreview=null;state.previewMode='profile';state.sheetOpen=false;state.status='';refresh();}};
})(window);
