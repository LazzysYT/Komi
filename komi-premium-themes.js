/* Premium badge appearance: public read, owner-only write, entitlement checked by RLS. */
(function(window){
'use strict';
const themes=[
['Золотой','#f5d477','#3b2b0b'],['Красный','#ff6262','#330d0d'],['Фиолетовый','#c795ff','#241036'],
['Розовый','#ff8cc9','#381126'],['Синий','#65b9ff','#0b2444'],['Голубой','#73e8ff','#07323d'],
['Бирюзовый','#4be8d6','#06372f'],['Зелёный','#74e786','#0d3519'],['Лаймовый','#b5f76c','#273809'],
['Оранжевый','#ffae66','#402109'],['Янтарный','#ffca58','#432c07'],['Белый','#f7f7f7','#222222'],
['Графитовый','#b6b8c2','#202127'],['Красный градиент','#ff8b9e','#46131e'],
['Фиолетово-синий','#a2a2ff','#191c50'],['Аврора','#83f7ef','#302054'],
['Радужный','#ffb7e9','#283a65'],['Ледяной','#a7e5ff','#143c56'],
['Дымный','#b8b4c8','#27252e'],['Космический','#cf9dff','#211038']
];
let client=null,owner='',styles=new Map(),busy=false;
const gradient={
13:'linear-gradient(120deg,#571224,#401d66)',14:'linear-gradient(120deg,#3e126b,#123b73)',
15:'linear-gradient(120deg,#114b55,#4e1c65)',16:'linear-gradient(90deg,#9c2848,#8d7e24,#237c86,#4d2f8e)',
17:'linear-gradient(120deg,#1c547e,#16304b)',18:'linear-gradient(120deg,#303038,#15151b)',
19:'linear-gradient(120deg,#221037,#24154c,#0b3658)'
};
function css(){
 if(document.getElementById('komi-premium-themes-css'))return;
 const style=document.createElement('style');style.id='komi-premium-themes-css';
 style.textContent='.komi-premium-badge[data-premium-theme]{color:var(--premium-fg)!important;border:1px solid var(--premium-fg)!important;background:var(--premium-bg)!important;box-shadow:0 0 12px color-mix(in srgb,var(--premium-fg),transparent 72%)!important}.komi-theme-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-top:16px}.komi-theme-choice{padding:13px 8px;border-radius:14px;border:1px solid #444;background:#121212;color:#eee;cursor:pointer;text-align:center}.komi-theme-choice[aria-pressed=true]{outline:2px solid #fff;outline-offset:2px}.komi-theme-choice span{display:block;margin:0 auto 8px;border-radius:30px;padding:6px 8px;font-weight:800;font-size:11px;border:1px solid var(--premium-fg);color:var(--premium-fg);background:var(--premium-bg)}.komi-theme-choice small{font-size:11px}.komi-theme-settings{margin:24px 0;padding:20px;border:1px solid #353535;border-radius:20px;background:#111}.komi-theme-settings h2{margin:0 0 8px;font-size:20px}.komi-theme-settings p{color:#bdbdbd;font-size:13px}';
 document.head.append(style);
}
function decorate(badge,id){
 const n=styles.get(String(id||''))??0;
 const theme=themes[n]||themes[0];
 badge.dataset.premiumTheme=String(n);
 badge.style.setProperty('--premium-fg',theme[1]);
 badge.style.setProperty('--premium-bg',gradient[n]||theme[2]);
}
function apply(){
 document.querySelectorAll('.komi-premium-badge').forEach(badge=>{
  const host=badge.closest('[data-komi-premium-id],[data-komi-premium-username]');
  let id=host?.getAttribute('data-komi-premium-id');
  if(!id&&host?.hasAttribute('data-komi-premium-username')){
   id=window.KomiPremium?.idForUsername?.(host.getAttribute('data-komi-premium-username'));
  }
  if(id)decorate(badge,id);
 });
}
async function refresh(){
 if(!client)return;
 const {data,error}=await client.from('komi_premium_badge_styles').select('user_id,style');
 if(error){console.warn('Premium badge styles unavailable',error.message);return;}
 styles=new Map((data||[]).map(x=>[String(x.user_id),Number(x.style)]));
 apply();
}
function mount(container,id,active){
 if(!container||!active||!id)return;
 const page=container.querySelector('#premium');
 if(!page||page.querySelector('.komi-theme-settings'))return;
 const section=document.createElement('section');
 section.className='komi-theme-settings';
 section.innerHTML='<h2>Оформление значка Premium</h2><p>Выбери один из 20 вариантов. Изменение видно всем пользователям.</p><div class="komi-theme-grid"></div><p role="status" aria-live="polite" data-premium-theme-status></p>';
 const grid=section.querySelector('.komi-theme-grid');
 themes.forEach((theme,n)=>{
  const button=document.createElement('button');button.type='button';
  button.className='komi-theme-choice';button.dataset.style=String(n);
  button.setAttribute('aria-pressed',String((styles.get(id)??0)===n));
  button.style.setProperty('--premium-fg',theme[1]);
  button.style.setProperty('--premium-bg',gradient[n]||theme[2]);
  const badge=document.createElement('span');badge.textContent='✦ PREMIUM';
  const label=document.createElement('small');label.textContent=(n+1)+'. '+theme[0];
  button.append(badge,label);grid.append(button);
 });
 section.addEventListener('click',async event=>{
  const button=event.target.closest('button[data-style]');
  if(!button||busy||!client)return;
  const style=Number(button.dataset.style),status=section.querySelector('[data-premium-theme-status]');
  if(!Number.isInteger(style)||style<0||style>=themes.length)return;
  busy=true;status.textContent='Сохраняем…';
  try{
   const {data:{user},error:authError}=await client.auth.getUser();
   if(authError||user?.id!==id)throw Error('Войди в свой аккаунт.');
   const {error}=await client.from('komi_premium_badge_styles').upsert({user_id:id,style},{onConflict:'user_id'});
   if(error)throw error;
   styles.set(id,style);apply();
   grid.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.style)===style)));
   status.textContent='Оформление сохранено.';
  }catch(e){status.textContent=e?.message||'Не удалось сохранить оформление.';}
  finally{busy=false;}
 });
 page.append(section);
}
function setClient(value){
 client=value||null;styles=new Map();
 if(client)refresh();
}
css();
const observer=new MutationObserver(()=>apply());
function start(){observer.observe(document.body,{childList:true,subtree:true});apply();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
window.KomiPremiumThemes={setClient,refresh,mount,apply};
})(window);
