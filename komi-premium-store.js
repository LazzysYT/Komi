/* Server-backed Premium AniCoin store. Paid cosmetic ownership cannot be claimed by clients. */
(function(root){
'use strict';
const products=root.KomiShopCatalog?.items||[];
let client=null,publicItems=new Map(),wallet=null,owner='',busy=false;
let xpMotion=null;
const extraSlots=['entry','aura','commentfx','party'];
const entrySeen=new WeakMap();
function updateStoryRhythm(levelNode,user,enabled){
 const track=levelNode?.querySelector('.profile-xp-progress-track');
 const meter=track?.querySelector('progress');
 const level=Number(levelNode?.querySelector('.profile-xp-level strong')?.textContent?.replace(/[^0-9]/g,''));
 if(!enabled||!track||!meter||!user||!(level>=1)||!(meter.max>0)){xpMotion=null;return;}
 const value=meter.value,max=meter.max,previous=xpMotion;
 xpMotion={user,level,value,max};
 if(previous?.user!==user||previous.max!==max||level<previous.level||(level===previous.level&&value<=previous.value)||root.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return;
 const levelUp=level>previous.level,from=levelUp?0:previous.value;
 track.classList.remove('is-xp-gain','is-xp-level-up');
 track.style.setProperty('--komi-xp-gain-from',(from/max*100)+'%');
 track.style.setProperty('--komi-xp-gain-width',((value-from)/max*100)+'%');
 void track.offsetWidth;
 track.classList.add('is-xp-gain');
 if(levelUp)track.classList.add('is-xp-level-up');
 clearTimeout(track.komiXpMotionTimer);
 track.komiXpMotionTimer=setTimeout(()=>track.classList.remove('is-xp-gain','is-xp-level-up'),1050);
}
function css(){
 if(document.getElementById('komi-premium-store-css'))return;
 const style=document.createElement('style');style.id='komi-premium-store-css';
 style.textContent='.komi-premium-store{border:1px solid #393939;background:#101010;border-radius:18px;padding:18px;margin:18px 0}.komi-premium-store h2{margin:0 0 10px}.komi-premium-store-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px}.komi-premium-store-item{padding:14px;border:1px solid #424242;border-radius:14px;background:#181818;color:#fff}.komi-premium-store-item h3{font-size:14px}.komi-premium-store-item button{width:100%;padding:9px;border:1px solid #777;color:#eee;background:#252525;border-radius:10px;cursor:pointer}.komi-premium-store-item button:disabled{opacity:.6;cursor:default}.komi-store-frame-moon{box-shadow:0 0 0 3px #d4d8e6,0 0 17px 5px #c0cae577!important}.komi-store-frame-aurora{box-shadow:0 0 0 3px #8fdbca,0 0 17px 5px #b5a0e080!important}.komi-store-earned-title{display:inline-flex;font-size:11px;font-weight:700;border:1px solid #999;border-radius:99px;padding:3px 8px;margin-inline:5px}';
 document.head.append(style);
}
function verifiedOwner(){
 try{return typeof currentUser==='undefined'?'':currentUser?.authUserId||'';}catch{return '';}
}
function apply(){
 const profile=document.querySelector('#profile[data-profile-user]');
 if(!profile)return;
 const user=profile.getAttribute('data-profile-user');
 const id=root.KomiPremium?.idForUsername?.(user);
 const item=publicItems.get(id);
 const frame=profile.querySelector('.profile-avatar-frame');
 if(frame){
  frame.classList.remove(...products.filter(x=>x.type==='frame').map(x=>'komi-store-'+x.frameClass));
  const frameProduct=products.find(x=>x.id===item?.frame_id);
  if(frameProduct?.frameClass)frame.classList.add('komi-store-'+frameProduct.frameClass);
  if(frameProduct?.id==='frame_ghoul_seal'&&!frame.hasAttribute('tabindex')){frame.tabIndex=0;frame.dataset.komiLivingFrameFocus='';}
  else if(frameProduct?.id!=='frame_ghoul_seal'&&frame.hasAttribute('data-komi-living-frame-focus')){delete frame.dataset.komiLivingFrameFocus;if(!frame.querySelector('[data-komi-shop-hover-card]'))frame.removeAttribute('tabindex');}
 }
 const cover=profile.querySelector('[data-profile-cover]');
 if(cover){
  cover.classList.remove(...products.filter(x=>x.type==='banner').map(x=>'komi-store-'+x.bannerClass));
  const bannerProduct=products.find(x=>x.id===item?.banner_id);
  if(bannerProduct?.bannerClass)cover.classList.add('komi-store-'+bannerProduct.bannerClass);
  cover.classList.remove(...products.filter(x=>x.type==='overlay').map(x=>'komi-store-'+x.cosmeticClass));
  const overlay=products.find(x=>x.id===item?.overlay_id);
  if(overlay?.cosmeticClass)cover.classList.add('komi-store-'+overlay.cosmeticClass);
 }
 const favoriteShowcase=profile.querySelector('[data-komi-shop-showcase]');
 if(favoriteShowcase){
  favoriteShowcase.classList.remove(...products.filter(x=>x.type==='showcase').map(x=>'komi-store-'+x.cosmeticClass));
  const favoriteStyle=products.find(x=>x.id===item?.showcase_id);
  favoriteShowcase.hidden=!favoriteStyle || !favoriteShowcase.querySelector('[data-komi-shop-favorite]');
  if(favoriteStyle?.cosmeticClass)favoriteShowcase.classList.add('komi-store-'+favoriteStyle.cosmeticClass);
  const heading=favoriteShowcase.querySelector('h3');
  const cinema=favoriteStyle?.id==='showcase_personal_cinema';
  const label=cinema?'Личный кинотеатр':'Топ избранного';
  if(heading&&heading.textContent!==label)heading.textContent=label;
  favoriteShowcase.setAttribute('aria-label',label);
 }
 const cardStyle=products.find(x=>x.id===item?.card_id);
 const avatar=profile.querySelector('.profile-avatar-frame');
 if(avatar){
  let hover=avatar.querySelector('[data-komi-shop-hover-card]');
  if(cardStyle?.cosmeticClass){
   if(!hover){
    hover=document.createElement('div');
    hover.dataset.komiShopHoverCard='';
    const label=document.createElement('strong');
    const sub=document.createElement('span');sub.textContent='Профиль Komi';
    hover.append(label,sub);
    avatar.append(hover);
   }
   hover.className='komi-shop-hover-card komi-store-'+cardStyle.cosmeticClass;
   hover.querySelector('strong').textContent=profile.querySelector('[data-profile-field="display-name"]')?.textContent||user;
   avatar.tabIndex=0;
  }else hover?.remove();
 }
 // Each owned visual category changes only its own public profile surface.
 const avatarImage=profile.querySelector('.profile-avatar-box');
 if(avatarImage){
  avatarImage.classList.remove(...products.filter(x=>x.type==='shape').map(x=>'komi-store-'+x.cosmeticClass));
  const shape=products.find(x=>x.id===item?.shape_id);
  if(shape?.cosmeticClass)avatarImage.classList.add('komi-store-'+shape.cosmeticClass);
 }
 const level=profile.querySelector('.profile-xp-capsule');
 if(level){
  level.classList.remove(...products.filter(x=>x.type==='xp').map(x=>'komi-store-'+x.cosmeticClass));
  const xp=products.find(x=>x.id===item?.xp_id);
  if(xp?.cosmeticClass)level.classList.add('komi-store-'+xp.cosmeticClass);
  updateStoryRhythm(level,id,xp?.id==='xp_story_rhythm');
 }else xpMotion=null;
 const nickname=profile.querySelector('[data-profile-field="display-name"]');
 if(nickname){
  nickname.classList.remove(...products.filter(x=>x.type==='name').map(x=>'komi-store-'+x.cosmeticClass));
  const name=products.find(x=>x.id===item?.name_id);
  if(name?.cosmeticClass)nickname.classList.add('komi-store-'+name.cosmeticClass);
 }
 const header=profile.querySelector('.profile-header-card');
 if(header){
  const entry=products.find(x=>x.type==='entry'&&x.id===item?.entry_id);
  const key=entry&&id?id+':'+entry.id:'';
  if(key&&entrySeen.get(header)!==key){entrySeen.set(header,key);if(!root.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches){const fx=document.createElement('span');fx.className='komi-entry-flash komi-fx-'+entry.cosmeticClass;fx.setAttribute('aria-hidden','true');header.append(fx);setTimeout(()=>fx.remove(),1100);}}
  else if(!key)entrySeen.delete(header);
  let mascotNode=header.querySelector('[data-komi-shop-mascot]');
  const mascot=products.find(x=>x.id===item?.mascot_id);
  if(mascot){
   if(!mascotNode){mascotNode=document.createElement('span');mascotNode.dataset.komiShopMascot='';mascotNode.setAttribute('aria-hidden','true');header.append(mascotNode);}
   mascotNode.className='komi-profile-mascot komi-store-'+mascot.cosmeticClass;
  }else mascotNode?.remove();
  const allSets=root.KomiShopCatalog?.sets||[];
  header.classList.remove(...allSets.map(set=>set.className));
  const active=root.KomiShopCatalog?.activeSets?.(item)||[];
  for(const set of active)header.classList.add(set.className);
  let setLabel=header.querySelector('[data-komi-shop-set-label]');
  if(active.length){
   if(!setLabel){setLabel=document.createElement('span');setLabel.dataset.komiShopSetLabel='';setLabel.className='komi-shop-set-status';header.querySelector('.profile-info-grid')?.append(setLabel);}
   if(setLabel)setLabel.textContent='✦ Сет: '+active.map(set=>set.label).join(', ');
  }else setLabel?.remove();
 }
 const titleHolder=profile.querySelector('.profile-name-row');
 if(!titleHolder)return;
 let title=titleHolder.querySelector('[data-komi-earned-title]');
 const icon=products.find(x=>x.id===item?.icon_id);
 let iconNode=titleHolder.querySelector('[data-komi-shop-icon]');
 if(icon){
  if(!iconNode){iconNode=document.createElement('span');iconNode.dataset.komiShopIcon='';iconNode.setAttribute('aria-label','Иконка-статус');titleHolder.append(iconNode);}
  iconNode.textContent=icon.symbol||'';
  iconNode.className='komi-store-'+icon.cosmeticClass;
 }else iconNode?.remove();
 const equippedTitle=products.find(x=>x.id===item?.title_id&&x.type==='title');
 const content=root.KomiShopCatalog?.titleText?.(equippedTitle)||equippedTitle?.title||'';
 if(content){
  if(!title){title=document.createElement('span');title.className='komi-store-earned-title';title.dataset.komiEarnedTitle='';titleHolder.append(title);}
  title.textContent=content;
  title.dataset.komiTitleId=equippedTitle.id;
 }else title?.remove();
}
async function refresh(){
 if(!client)return;
 const fields='user_id,frame_id,title_id,banner_id,overlay_id,showcase_id,card_id,icon_id,shape_id,plate_id,mascot_id,xp_id,name_id';
 let result=await client.from('komi_premium_cosmetic_equips').select(fields+',entry_id,aura_id,commentfx_id,party_id').limit(1000);
 if(result.error)result=await client.from('komi_premium_cosmetic_equips').select(fields).limit(1000);
 const {data,error}=result;
 if(error){console.warn('Premium store items unavailable:',error.message);return;}
 publicItems=new Map((data||[]).map(x=>[String(x.user_id),x]));
 apply();
}
async function loadWallet(id){
 if(!client||!id||verifiedOwner()!==id)return;
 const {data,error}=await client.rpc('komi_premium_store',{p_action:'read',p_item:null});
 if(error)throw error;
 await root.KomiShopCatalog?.checkPricing?.(client);
 if(verifiedOwner()!==id)return;
 if(!data||!Number.isSafeInteger(Number(data.balance))||!Array.isArray(data.owned))throw Error('Invalid wallet');
 wallet=data;owner=id;
 const panel=document.querySelector('[data-premium-store-panel]');
 if(panel?.dataset.premiumStorePanel===id)paint(panel);
}
function paint(panel){
 const id=panel.dataset.premiumStorePanel;
 if(!wallet||owner!==id)return;
 const balance=panel.querySelector('[data-premium-store-balance]');
 if(balance)balance.textContent='Баланс: '+Number(wallet.balance).toLocaleString('ru-RU')+' AniCoin';
 for(const button of panel.querySelectorAll('[data-premium-item]')){
  const product=products.find(x=>x.id===button.dataset.premiumItem);
  if(!product)continue;
  const owned=wallet.owned.includes(product.id);
  const equipped=wallet[product.type+'_id']===product.id;
  if(root.KomiShopCatalog?.isOnSale?.(product.id)!==true)button.closest('article').hidden=!owned;
  button.dataset.action=product.type==='reaction'?(owned?'owned':'buy'):equipped?'unequip':owned?'equip':'buy_equip';
  const locked=root.KomiShopCatalog?.isPreview?.()===true||!owned&&root.KomiShopCatalog?.canCheckout?.()!==true;
  button.disabled=locked || busy || (product.type==='reaction'&&owned)||(!owned&&Number(wallet.balance)<product.cost);
  button.textContent=locked?'Только предпросмотр':product.type==='reaction'&&owned?'Набор куплен':equipped?'Снять':owned?'Надеть':Number(wallet.balance)<product.cost?'Недостаточно AniCoin':'Купить · '+product.cost+' ◈';
 }
}
function mount(container,id,active){
 const page=container?.querySelector('#premium');
 if(!page||!id||!active||page.querySelector('[data-premium-store-panel]'))return;
 css();
 const panel=document.createElement('section');
 panel.className='komi-premium-store';panel.dataset.premiumStorePanel=id;
 const title=document.createElement('h2');title.textContent='Оформление за AniCoin';
 const description=document.createElement('p');
 description.textContent='Титулы и эффекты для профиля. Примерить всё оформление можно в магазине.';
 const balance=document.createElement('p');balance.dataset.premiumStoreBalance='';balance.textContent='Проверяем баланс…';
 const grid=document.createElement('div');grid.className='komi-premium-store-grid';
 for(const product of products){
  if(extraSlots.includes(product.type))continue;
  const item=document.createElement('article');item.className='komi-premium-store-item';
  if(root.KomiShopCatalog?.isOnSale?.(product.id)!==true)item.hidden=true;
  const label=document.createElement('h3');label.textContent=product.label;
  const button=document.createElement('button');button.type='button';button.dataset.premiumItem=product.id;
  button.disabled=true;button.textContent='Загрузка…';
  const sample=document.createElement('div');sample.className='komi-coin-sample';
  if(product.type==='frame'){
   const avatar=document.createElement('span');avatar.className='komi-coin-frame komi-store-'+product.frameClass;avatar.textContent='K';sample.append(avatar);
  }else if(product.type==='banner'){
   const cover=document.createElement('span');cover.className='store-banner-swatch '+product.bannerClass;cover.textContent='KOMI';sample.append(cover);
  }else if(product.type==='title'){
   const chip=document.createElement('span');chip.className='komi-coin-title';chip.textContent=root.KomiShopCatalog?.titleText?.(product)||product.title;chip.dataset.komiTitleId=product.id;sample.append(chip);
  }else if(product.type==='overlay'){
   const cover=document.createElement('div');cover.className='komi-preview-cover';const layer=document.createElement('span');layer.className='komi-shop-overlay-layer '+product.cosmeticClass;cover.append(layer);sample.append(cover);
  }else if(product.type==='showcase'){
   const row=document.createElement('div');row.className='komi-shop-showcase-demo komi-store-'+product.cosmeticClass;
   for(let i=0;i<3;i++)row.append(document.createElement('i'));sample.append(row);
  }else if(product.type==='card'){
   const mini=document.createElement('div');mini.className='komi-shop-mini-swatch komi-store-'+product.cosmeticClass;mini.textContent='Komi';sample.append(mini);
  }else if(product.type==='icon'){
   const badge=document.createElement('span');badge.className='komi-shop-icon-swatch komi-store-'+product.cosmeticClass;badge.textContent=product.symbol;sample.append(badge);
  }else if(product.type==='reaction'){
   const row=document.createElement('span');row.className='komi-shop-reaction-swatch';
   for(const reaction of product.reactions){
    const preview=document.createElement('span');
    preview.setAttribute('role','img');preview.setAttribute('aria-label',reaction.label||reaction.id);
    if(root.KomiShopReactions)preview.innerHTML=root.KomiShopReactions.render(reaction.emoji);
    else preview.textContent=reaction.label||reaction.id;
    row.append(preview);
   }
   sample.append(row);
  }else if(['shape','plate','mascot','xp','name'].includes(product.type)){
   const preview=document.createElement('span');preview.className='komi-shop-visual-sample komi-store-'+product.cosmeticClass;
   preview.textContent=product.type==='mascot'?'':product.type==='xp'?'━━━━':product.type==='name'?'Komi':product.type==='plate'?'Текст комментария':'K';
   preview.classList.add('komi-shop-'+(product.type==='shape'?'avatar-shape':product.type==='plate'?'plate-swatch':product.type==='mascot'?'mascot-swatch':product.type==='xp'?'xp-swatch':'name-swatch'));
   if(product.type==='mascot'){const mini=document.createElement('i');mini.className='komi-profile-mascot komi-store-'+product.cosmeticClass;preview.append(mini);}
   sample.append(preview);
  }
  const rarity=document.createElement('span');rarity.className='komi-shop-rarity';
  rarity.textContent={common:'Обычный',uncommon:'Необычный',rare:'Редкий',epic:'Эпический',legendary:'Легендарный',mythic:'Мифический'}[product.rarity]||'Обычный';item.dataset.rarity=product.rarity;item.prepend(rarity);
  item.append(sample,label,button);grid.append(item);
 }
 const status=document.createElement('p');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 panel.append(title,description,balance,grid,status);
 grid.addEventListener('click',async event=>{
  const button=event.target.closest('[data-premium-item]');
  if(!button||button.disabled||busy||verifiedOwner()!==id||!client||root.KomiShopCatalog?.isPreview?.()===true)return;
  const product=products.find(x=>x.id===button.dataset.premiumItem);
  if(!product)return;
  busy=true;paint(panel);status.textContent='Проверяем покупку…';
  try{
   const {data:{user},error:authError}=await client.auth.getUser();
   if(authError||user?.id!==id)throw Error('Требуется вход в аккаунт.');
   const action=button.dataset.action;
   if(!['buy','buy_equip','equip','unequip'].includes(action))throw Error('Invalid action');
   if(['buy','buy_equip'].includes(action)&&(root.KomiShopCatalog?.isOnSale?.(product.id)!==true||root.KomiShopCatalog?.canCheckout?.()!==true))throw Error('Сервер ещё не подтвердил цены.');
   const {data,error}=await client.rpc('komi_premium_store',{p_action:action,p_item:product.id});
   if(error)throw error;
   if(verifiedOwner()!==id)return;
   wallet=data;owner=id;
   status.textContent=action==='buy'?'Набор реакций куплен.':action==='buy_equip'?'Предмет куплен и надет.':action==='equip'?'Предмет надет.':'Предмет снят.';
   if(action!=='buy')await refresh();
   if(typeof aniCoinRequest==='function')void aniCoinRequest('read',{},id).catch(()=>{});
  }catch(error){status.textContent=error?.message||'Операция недоступна.';}
  finally{busy=false;if(verifiedOwner()===id)paint(panel);}
 });
 page.append(panel);
 if(wallet&&owner===id)paint(panel);
 else loadWallet(id).catch(error=>{status.textContent=error?.message||'Не удалось загрузить магазин.';});
}
function setClient(value){
 client=value||null;owner='';wallet=null;publicItems=new Map();
 if(client)void refresh();
}
function start(){
 css();
 const observer=new MutationObserver(changes=>{
  for(const change of changes)for(const node of change.addedNodes){
   if(node.nodeType===1&&(node.matches?.('#profile')||node.querySelector?.('#profile')||node.matches?.('.profile-xp-capsule,.profile-xp-progress-track')||node.querySelector?.('.profile-xp-capsule')))apply();
  }
 });
 observer.observe(document.body,{childList:true,subtree:true});
 apply();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
root.KomiPremiumStore={setClient,mount,refresh,apply};
})(window);
