/* Public Komi Premium directory: browser reads verified entitlements only. */
(function(window){
'use strict';
const selector='[data-komi-premium-id],[data-komi-premium-username],[data-komi-premium-panel],[data-komi-premium-editor]';
const checkout='https://app.lava.top/products/b37a75ab-e500-4431-b61e-5c2a7e3edd8a/f1b11818-74d5-4e94-a013-15d89a545cdd?currency=USD';
let client=null,pending=null,last=0,loaded=false;
let activeIds=new Set(),names=new Map(),rewards=new Map(),media=new Map();
const uid=name=>names.get(String(name||'').toLowerCase())||'';
const isActiveId=id=>activeIds.has(String(id||''));
const isActiveName=name=>isActiveId(uid(name));
const xpForUsername=name=>Number(rewards.get(uid(name))||0);
const getMediaForId=id=>media.get(String(id||''))||null;
function imageUrl(bucket,path){
 if(!client||!path)return '';
 const value=client.storage.from(bucket).getPublicUrl(path).data?.publicUrl||'';
 try{const parsed=new URL(value);return parsed.protocol==='https:'?parsed.href:'';}catch{return '';}
}
function swapImage(img,url){
 if(!img)return;
 if(url){
  if(!img.hasAttribute('data-komi-premium-base-src'))
   img.setAttribute('data-komi-premium-base-src',img.getAttribute('src')||'');
  if(img.getAttribute('src')!==url)img.setAttribute('src',url);
 }else if(img.hasAttribute('data-komi-premium-base-src')){
  const old=img.getAttribute('data-komi-premium-base-src');
  img.removeAttribute('data-komi-premium-base-src');
  if(old)img.setAttribute('src',old);
 }
}
function badge(node){
 const id=node.getAttribute('data-komi-premium-id')||
   uid(node.getAttribute('data-komi-premium-username'));
 const yes=isActiveId(id);
 if(node.matches('[data-komi-premium-panel],[data-komi-premium-editor]')){
  node.hidden=!yes;return;
 }
 const old=Array.from(node.children).find(x=>x.classList?.contains('komi-premium-badge'));
 if(yes&&!old){
  const b=document.createElement('span');
  b.className='komi-premium-badge';b.textContent='✦ PREMIUM';
  b.title='Подтверждённая подписка Komi Premium';b.setAttribute('aria-label','Premium активен');
  node.append(b);
 }else if(!yes&&old)old.remove();
}
function apply(root){
 if(!root)return;
 if(root.nodeType===1&&root.matches?.(selector))badge(root);
 root.querySelectorAll?.(selector).forEach(badge);
 const profile=document.querySelector('#profile[data-profile-user]');
 if(profile){
  const id=uid(profile.getAttribute('data-profile-user'));
  const record=isActiveId(id)?media.get(id):null;
  swapImage(profile.querySelector('.profile-avatar-box'),imageUrl('avatars',record?.avatar_path));
  const cover=profile.querySelector('[data-profile-cover]');
  if(cover){
   const url=imageUrl('premium-profile-backgrounds',record?.background_path);
   let image=cover.querySelector('img');
   if(url){
    if(!image){
     image=document.createElement('img');
     image.setAttribute('data-komi-premium-injected','');
     image.setAttribute('alt','');
     cover.append(image);
    }
    swapImage(image,url);
   }else if(image?.hasAttribute('data-komi-premium-injected'))image.remove();
   else swapImage(image,'');
  }
 }
 for(const el of document.querySelectorAll('[data-komi-premium-username]')){
  const id=uid(el.getAttribute('data-komi-premium-username'));
  const image=isActiveId(id)?imageUrl('avatars',media.get(id)?.avatar_path):'';
  swapImage(el.closest('.komi-friends-identity')?.querySelector('img')||
    el.closest('.sidebar-friend-item')?.querySelector('img'),image);
 }
 let owner='';
 try{owner=typeof currentUser==='undefined'?'':currentUser?.authUserId||'';}catch{}
 const url=isActiveId(owner)?imageUrl('avatars',media.get(owner)?.avatar_path):'';
 for(const image of document.querySelectorAll('#sidebarAvatarIcon img,.user-avatar-small'))swapImage(image,url);
}
function perk(symbol,title,description){
 return '<article class="komi-premium-feature"><span aria-hidden="true">'+symbol+'</span>'+
  '<h2>'+title+'</h2><p>'+description+'</p></article>';
}
function renderPage(container){
 if(!container)return;
 let owner='';
 try{owner=typeof currentUser==='undefined'?'':currentUser?.authUserId||'';}catch{}
 const on=isActiveId(owner),bonus=Number(rewards.get(owner)||0);
 const status=!loaded?'Проверяем подписку…':on?'✦ PREMIUM АКТИВЕН':owner?'Premium не активен':'Войди для проверки статуса';
 container.innerHTML=
  '<section id="premium" class="komi-premium-page" aria-labelledby="premium-title">'+
  '<div class="komi-premium-head"><div><p class="komi-premium-kicker">✦ KOMI ANIME · PREMIUM</p>'+
  '<h1 id="premium-title">Твой профиль.<br>Другой уровень.</h1>'+
  '<p>Анимация, статус и подарки за поддержку KomiAnime.</p></div>'+
  '<span class="komi-premium-status" role="status">'+status+'</span></div>'+
  '<div class="komi-premium-perks-grid">'+
  perk('◉','Анимированные аватары','GIF-аватарка видна всем, пока твой Premium активен.')+
  perk('▣','Живой фон профиля','Анимированная GIF-обложка в твоём профиле.')+
  perk('✶','+2000 XP','Разовый бонус. С нулевого опыта — сразу 5-й уровень.')+
  perk('◈','+500 AniCoin','Один раз на аккаунт после первой активации Premium.')+
  '</div><section class="komi-premium-bottom"><div><h2>'+
  (on?'Твой Premium активен':'Открой возможности Premium')+'</h2><p>'+
  (on?'Начисленный Premium-бонус: '+bonus.toLocaleString('ru-RU')+' XP. GIF можно загрузить в настройках профиля.':
  'Выбери подписку и проверь условия ежемесячного продления до оплаты.')+
  '</p><p class="komi-premium-fine">Все пользователи могут получать 1 AniCoin за 20 минут подтверждённого просмотра во встроенном плеере. Для внешних плееров есть отдельный учёт активного времени.</p></div>'+
  '<div class="komi-premium-actions">'+
  (on?'<button type="button" class="komi-premium-action" data-komi-click="profile">Мой профиль</button>':
  '<a class="komi-premium-action" href="'+checkout+'" target="_blank" rel="noopener noreferrer">Оформить Premium ↗</a>')+
  '<a class="komi-premium-action-secondary" href="/premium.html">Условия подписки</a>'+
  '</div></section></section>';
  window.KomiPremiumThemes?.mount(container,owner,on);
 window.KomiPremiumDecor?.mount(container,owner,on);
}
function stamp(){
 return JSON.stringify([[...activeIds].sort(),[...rewards.entries()].sort(),[...media.entries()].sort()]);
}
async function refresh(force){
 if(!client||pending||(!force&&last&&Date.now()-last<30000))return pending;
 pending=(async()=>{
  const old=stamp();
  try{
   const [users,badges,bonus,appearance]=await Promise.all([
    client.from('komi_profiles').select('user_id,username').limit(1000),
    client.from('komi_premium_badges').select('user_id').limit(1000),
    client.from('komi_premium_rewards').select('user_id,xp_awarded').limit(1000),
    client.from('komi_premium_media').select('user_id,avatar_path,background_path').limit(1000)
   ]);
   if(badges.error)throw badges.error;
   activeIds=new Set((badges.data||[]).map(x=>String(x.user_id)));
   if(!users.error)names=new Map((users.data||[]).filter(x=>x.user_id&&x.username)
     .map(x=>[String(x.username).toLowerCase(),String(x.user_id)]));
   rewards=bonus.error?new Map():new Map((bonus.data||[]).map(x=>[String(x.user_id),Number(x.xp_awarded)||0]));
   media=appearance.error?new Map():new Map((appearance.data||[]).map(x=>[String(x.user_id),x]));
   last=Date.now();loaded=true;
   if(old!==stamp()&&typeof currentView!=='undefined'&&
     (currentView==='premium'||currentView==='profile')&&typeof render==='function')render();
   apply(document);
   window.KomiPremiumThemes?.refresh();
   window.KomiPremiumDecor?.refresh();
  }catch(e){
   activeIds=new Set();rewards=new Map();media=new Map();last=0;loaded=false;
   apply(document);console.warn('Premium status unavailable',e?.message||String(e));
  }finally{pending=null;}
 })();
 return pending;
}
function setClient(c){
 client=c||null;last=0;loaded=false;activeIds=new Set();names=new Map();rewards=new Map();media=new Map();
 window.KomiPremiumThemes?.setClient(client);
 window.KomiPremiumDecor?.setClient(client);
 if(client){refresh(true);client.auth.onAuthStateChange(()=>Promise.resolve().then(()=>refresh(true)));}
}
function start(){
 const observer=new MutationObserver(changes=>{
  for(const change of changes)for(const node of change.addedNodes){
   if(node.nodeType===1&&(node.matches?.(selector)||node.querySelector?.(selector)||
     node.matches?.('#profile')))apply(node);
  }
 });
 observer.observe(document.body,{childList:true,subtree:true});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh(true);});
 setInterval(()=>{if(!document.hidden)refresh(false);},30000);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
window.KomiPremium={setClient,refresh,apply,renderPage,isActiveId,isActiveName,xpForUsername,getMediaForId,idForUsername:uid};
})(window);
