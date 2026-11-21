/* Server-backed Premium AniCoin store. Paid cosmetic ownership cannot be claimed by clients. */
(function(root){
'use strict';
const products=root.KomiShopCatalog?.items||[];
let client=null,publicItems=new Map(),wallet=null,owner='',busy=false;
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
 const content=products.find(x=>x.id===item?.title_id)?.title||'';
 if(content){
  if(!title){title=document.createElement('span');title.className='komi-store-earned-title';title.dataset.komiEarnedTitle='';titleHolder.append(title);}
  title.textContent=content;
 }else title?.remove();
}
async function refresh(){
 if(!client)return;
 const {data,error}=await client.from('komi_premium_cosmetic_equips')
  .select('user_id,frame_id,title_id,banner_id,overlay_id,showcase_id,card_id,icon_id').limit(1000);
 if(error){console.warn('Premium store items unavailable:',error.message);return;}
 publicItems=new Map((data||[]).map(x=>[String(x.user_id),x]));
 apply();
}
async function loadWallet(id){
 if(!client||!id||verifiedOwner()!==id)return;
 const {data,error}=await client.rpc('komi_premium_store',{p_action:'read',p_item:null});
 if(error)throw error;
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
  button.dataset.action=equipped?'unequip':owned?'equip':'buy';
  button.disabled=busy || (!owned&&Number(wallet.balance)<product.cost);
  button.textContent=equipped?'Снять':owned?'Надеть':Number(wallet.balance)<product.cost?'Недостаточно AniCoin':'Купить · '+product.cost+' ◈';
 }
}
function mount(container,id,active){
 const page=container?.querySelector('#premium');
 if(!page||!id||!active||page.querySelector('[data-premium-store-panel]'))return;
 css();
 const panel=document.createElement('section');
 panel.className='komi-premium-store';panel.dataset.premiumStorePanel=id;
 const title=document.createElement('h2');title.textContent='Магазин AniCoin · 51 украшение';
 const description=document.createElement('p');
 description.textContent='Рамки, титулы, обложки, эффекты и статусы. Покупки защищены сервером. Вся коллекция также доступна в #shop.';
 const balance=document.createElement('p');balance.dataset.premiumStoreBalance='';balance.textContent='Проверяем баланс…';
 const grid=document.createElement('div');grid.className='komi-premium-store-grid';
 for(const product of products){
  const item=document.createElement('article');item.className='komi-premium-store-item';
  const label=document.createElement('h3');label.textContent=product.label;
  const button=document.createElement('button');button.type='button';button.dataset.premiumItem=product.id;
  button.disabled=true;button.textContent='Загрузка…';
  const sample=document.createElement('div');sample.className='komi-coin-sample';
  if(product.type==='frame'){
   const avatar=document.createElement('span');avatar.className='komi-coin-frame komi-store-'+product.frameClass;avatar.textContent='K';sample.append(avatar);
  }else if(product.type==='banner'){
   const cover=document.createElement('span');cover.className='store-banner-swatch '+product.bannerClass;cover.textContent='KOMI';sample.append(cover);
  }else if(product.type==='title'){
   const chip=document.createElement('span');chip.className='komi-coin-title';chip.textContent=product.title;sample.append(chip);
  }else if(product.type==='overlay'){
   const cover=document.createElement('div');cover.className='komi-preview-cover';const layer=document.createElement('span');layer.className='komi-shop-overlay-layer '+product.cosmeticClass;cover.append(layer);sample.append(cover);
  }else if(product.type==='showcase'){
   const row=document.createElement('div');row.className='komi-shop-showcase-demo komi-store-'+product.cosmeticClass;
   for(let i=0;i<3;i++)row.append(document.createElement('i'));sample.append(row);
  }else if(product.type==='card'){
   const mini=document.createElement('div');mini.className='komi-shop-mini-swatch komi-store-'+product.cosmeticClass;mini.textContent='Komi';sample.append(mini);
  }else if(product.type==='icon'){
   const badge=document.createElement('span');badge.className='komi-shop-icon-swatch komi-store-'+product.cosmeticClass;badge.textContent=product.symbol;sample.append(badge);
  }
  item.append(sample,label,button);grid.append(item);
 }
 const status=document.createElement('p');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 panel.append(title,description,balance,grid,status);
 grid.addEventListener('click',async event=>{
  const button=event.target.closest('[data-premium-item]');
  if(!button||button.disabled||busy||verifiedOwner()!==id||!client)return;
  const product=products.find(x=>x.id===button.dataset.premiumItem);
  if(!product)return;
  busy=true;paint(panel);status.textContent='Проверяем покупку…';
  try{
   const {data:{user},error:authError}=await client.auth.getUser();
   if(authError||user?.id!==id)throw Error('Требуется вход в аккаунт.');
   const action=button.dataset.action;
   if(!['buy','equip','unequip'].includes(action))throw Error('Invalid action');
   const {data,error}=await client.rpc('komi_premium_store',{p_action:action,p_item:product.id});
   if(error)throw error;
   if(verifiedOwner()!==id)return;
   wallet=data;owner=id;
   status.textContent=action==='buy'?'Куплено. Теперь можно надеть.':action==='equip'?'Предмет надет.':'Предмет снят.';
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
   if(node.nodeType===1&&(node.matches?.('#profile')||node.querySelector?.('#profile')))apply();
  }
 });
 observer.observe(document.body,{childList:true,subtree:true});
 apply();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
root.KomiPremiumStore={setClient,mount,refresh,apply};
})(window);
