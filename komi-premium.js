/* Komi Premium is always read from a protected Supabase table, never self-assigned. */
(function(window){
'use strict';
let client=null,pending=null,last=0,ids=new Set(),names=new Map();
const mark='[data-komi-premium-id],[data-komi-premium-username],[data-komi-premium-panel]';
function isActive(el){
 const id=el.getAttribute('data-komi-premium-id')||names.get((el.getAttribute('data-komi-premium-username')||'').toLowerCase())||'';
 return ids.has(String(id));
}
function decorate(el){
 const active=isActive(el);
 if(el.matches('[data-komi-premium-panel]')){el.hidden=!active;return;}
 const old=Array.from(el.children).find(x=>x.classList?.contains('komi-premium-badge'));
 if(active&&!old){
  const badge=document.createElement('span');badge.className='komi-premium-badge';
  badge.textContent='✦ PREMIUM';badge.title='Проверенная подписка Komi Premium';
  badge.setAttribute('aria-label','Активная подписка Komi Premium');el.append(badge);
 }else if(!active&&old)old.remove();
}
function apply(root){
 if(root?.nodeType===1&&root.matches?.(mark))decorate(root);
 root?.querySelectorAll?.(mark).forEach(decorate);
}
async function refresh(force){
 if(!client||pending||(!force&&Date.now()-last<30000))return pending;
 pending=(async()=>{
  try{
   const [people,badges]=await Promise.all([
    client.from('komi_profiles').select('user_id,username').limit(1000),
    client.from('komi_premium_badges').select('user_id').limit(1000)
   ]);
   if(badges.error)throw badges.error;
   ids=new Set((badges.data||[]).map(x=>String(x.user_id)));
   if(!people.error)names=new Map((people.data||[]).filter(x=>x.user_id&&x.username).map(x=>[String(x.username).toLowerCase(),String(x.user_id)]));
   last=Date.now();apply(document);
  }catch(e){ids=new Set();last=0;apply(document);console.warn('Premium status unavailable',e?.message||String(e));}
  finally{pending=null;}
 })();
 return pending;
}
function setClient(c){client=c||null;ids=new Set();names=new Map();last=0;
 if(client){refresh(true);client.auth.onAuthStateChange(()=>Promise.resolve().then(()=>refresh(true)));}
}
function observe(){
 const watcher=new MutationObserver(ms=>{for(const m of ms)for(const node of m.addedNodes)
   if(node.nodeType===1&&(node.matches?.(mark)||node.querySelector?.(mark)))apply(node);});
 watcher.observe(document.body,{childList:true,subtree:true});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh(true);});
 setInterval(()=>{if(!document.hidden)refresh(false);},30000);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',observe,{once:true});else observe();
window.KomiPremium={setClient,refresh,apply};
})(window);
