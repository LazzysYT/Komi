/* Server-backed Premium AniCoin store. Paid cosmetic ownership cannot be claimed by clients. */
(function(root){
'use strict';
const products=[
 {id:'frame_moon',label:'Лунная рамка',cost:30,type:'frame'},
 {id:'frame_aurora',label:'Рамка Аврора',cost:45,type:'frame'},
 {id:'title_cinema',label:'Титул «Киноман»',cost:20,type:'title'},
 {id:'title_starlight',label:'Титул «Звёздный зритель»',cost:25,type:'title'}
];
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
 const entitled=root.KomiPremium?.isActiveId?.(id);
 const item=entitled?publicItems.get(id):null;
 const frame=profile.querySelector('.profile-avatar-frame');
 if(frame){
  frame.classList.toggle('komi-store-frame-moon',item?.frame_id==='frame_moon');
  frame.classList.toggle('komi-store-frame-aurora',item?.frame_id==='frame_aurora');
 }
 const titleHolder=profile.querySelector('.profile-name-row');
 if(!titleHolder)return;
 let title=titleHolder.querySelector('[data-komi-earned-title]');
 const titles={title_cinema:'✧ Киноман',title_starlight:'✦ Звёздный зритель'};
 const content=entitled?titles[item?.title_id]:'';
 if(content){
  if(!title){title=document.createElement('span');title.className='komi-store-earned-title';title.dataset.komiEarnedTitle='';titleHolder.append(title);}
  title.textContent=content;
 }else title?.remove();
}
async function refresh(){
 if(!client)return;
 const {data,error}=await client.from('komi_premium_cosmetic_equips')
  .select('user_id,frame_id,title_id').limit(1000);
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
  const equipped=wallet[product.type==='frame'?'frame_id':'title_id']===product.id;
  button.dataset.action=owned?'equip':'buy';
  button.disabled=busy || equipped || (!owned&&Number(wallet.balance)<product.cost);
  button.textContent=equipped?'Надето ✓':owned?'Надеть':Number(wallet.balance)<product.cost?'Недостаточно AniCoin':'Купить · '+product.cost+' ◈';
 }
}
function mount(container,id,active){
 const page=container?.querySelector('#premium');
 if(!page||!id||!active||page.querySelector('[data-premium-store-panel]'))return;
 css();
 const panel=document.createElement('section');
 panel.className='komi-premium-store';panel.dataset.premiumStorePanel=id;
 const title=document.createElement('h2');title.textContent='Premium-магазин';
 const description=document.createElement('p');
 description.textContent='Рамки и титулы за AniCoin. Покупки подтверждает сервер; доступно только при активной подписке.';
 const balance=document.createElement('p');balance.dataset.premiumStoreBalance='';balance.textContent='Проверяем баланс…';
 const grid=document.createElement('div');grid.className='komi-premium-store-grid';
 for(const product of products){
  const item=document.createElement('article');item.className='komi-premium-store-item';
  const label=document.createElement('h3');label.textContent=product.label;
  const button=document.createElement('button');button.type='button';button.dataset.premiumItem=product.id;
  button.disabled=true;button.textContent='Загрузка…';
  item.append(label,button);grid.append(item);
 }
 const status=document.createElement('p');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 panel.append(title,description,balance,grid,status);
 grid.addEventListener('click',async event=>{
  const button=event.target.closest('[data-premium-item]');
  if(!button||button.disabled||busy||verifiedOwner()!==id||!client)return;
  const product=products.find(x=>x.id===button.dataset.premiumItem);
  if(!product||!root.KomiPremium?.isActiveId?.(id))return;
  busy=true;paint(panel);status.textContent='Проверяем покупку…';
  try{
   const {data:{user},error:authError}=await client.auth.getUser();
   if(authError||user?.id!==id)throw Error('Требуется вход в аккаунт.');
   const action=button.dataset.action;
   if(!['buy','equip'].includes(action))throw Error('Invalid action');
   const {data,error}=await client.rpc('komi_premium_store',{p_action:action,p_item:product.id});
   if(error)throw error;
   if(verifiedOwner()!==id)return;
   wallet=data;owner=id;
   status.textContent=action==='buy'?'Куплено. Теперь можно надеть.':'Оформление обновлено.';
   if(action==='equip')await refresh();
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
