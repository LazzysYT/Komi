/* KomiAnime: server-verified Premium gift administration */
(function(){
'use strict';
window.komiPremiumAdminUI=async function(root,db,goBack){
 if(!root||!db)return;
 if(!document.getElementById('pa-style')){
  const style=document.createElement('style');style.id='pa-style';
  style.textContent=
  '#adminModalContent:has(.pa-app){width:min(1040px,calc(100vw - 20px))!important;max-width:1040px!important;max-height:calc(100dvh - 20px);overflow:auto;box-sizing:border-box}'+
  '.pa-app{color:#fafafa;font:14px Inter,system-ui,sans-serif}.pa-app *{box-sizing:border-box}'+
  '.pa-app h2{font-size:26px;letter-spacing:-.03em;margin:0 0 8px}.pa-app h3{font-size:16px;margin:0 0 14px}'+
  '.pa-app .pa-muted{color:#a4a4ac;font-size:12px;line-height:1.55}.pa-app .pa-eyebrow{font-size:11px;letter-spacing:.12em;font-weight:800}'+
  '.pa-app .pa-header,.pa-app .pa-top,.pa-app .pa-user,.pa-app .pa-record{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}'+
  '.pa-app .pa-header{margin-bottom:20px;align-items:flex-start}'+
  '.pa-app .pa-grid{display:grid;grid-template-columns:1.1fr 1fr;gap:13px;margin-bottom:13px}'+
  '.pa-app .pa-card{border:1px solid #343438;border-radius:17px;padding:17px;background:#151518;min-width:0}'+
  '.pa-app input,.pa-app select{width:100%;background:#0b0b0d;color:white;border:1px solid #44444b;border-radius:10px;min-height:43px;padding:10px;font:inherit}'+
  '.pa-app label{display:block;margin:12px 0 7px;color:#ddd;font-size:12px;font-weight:700}'+
  '.pa-app button{background:#222226;border:1px solid #49494f;color:#fff;border-radius:10px;padding:9px 13px;min-height:38px;cursor:pointer;font:inherit;font-weight:650}'+
  '.pa-app button:hover:not(:disabled){border-color:#fff}.pa-app button:disabled{opacity:.4;cursor:not-allowed}'+
  '.pa-app .pa-primary{background:#fff;color:#09090b;border-color:#fff;width:100%;margin-top:15px;font-weight:800}'+
  '.pa-app .pa-selected{background:#0b0b0d;border:1px solid #3c3c42;border-radius:10px;min-height:55px;padding:12px;display:grid;gap:4px;overflow-wrap:anywhere}'+
  '.pa-app .pa-results,.pa-app .pa-history-list{display:grid;gap:8px;max-height:370px;overflow-y:auto;margin-top:11px}'+
  '.pa-app .pa-user,.pa-app .pa-record{padding:12px;background:#0b0b0d;border:1px solid #303036;border-radius:12px}'+
  '.pa-app .pa-user>div,.pa-app .pa-record>div:first-child{display:grid;gap:5px;min-width:0;overflow-wrap:anywhere}'+
  '.pa-app .pa-user small,.pa-app .pa-record small{font-size:11px;color:#a3a3ad}'+
  '.pa-app .pa-record>div:last-child{display:flex;gap:8px;align-items:center;flex-wrap:wrap}'+
  '.pa-app .pa-record .pa-revoke{color:#ffb7b7}.pa-app .pa-message{min-height:20px;margin:10px 1px;color:#dedee0}.pa-app .pa-message[data-error=true]{color:#ffb7b7}'+
  '.pa-app :is(input,select,button):focus-visible{outline:2px solid white;outline-offset:3px}'+
  '@media(max-width:690px){.pa-app .pa-grid{grid-template-columns:1fr}.pa-app .pa-card{padding:13px}.pa-app .pa-record{align-items:flex-start;flex-direction:column}}';
  document.head.append(style);
 }
 root.replaceChildren();
 const section=document.createElement('section');
 section.className='pa-app';
 section.innerHTML=[
  '<header class="pa-header"><div><p class="pa-muted pa-eyebrow">KOMIANIME / АДМИН-ПАНЕЛЬ</p>',
  '<h2>✦ Выдача Premium</h2><p class="pa-muted">Подаренные подписки учитываются отдельно от платежей Lava.top.</p></div>',
  '<div><button type="button" id="pa-back">← Админка</button> <button type="button" id="pa-close">✕</button></div></header>',
  '<div class="pa-grid"><div class="pa-card"><h3>1. Выбери пользователя</h3>',
  '<label for="pa-search">Никнейм, имя или email</label>',
  '<input id="pa-search" type="search" autocomplete="off" maxlength="100" placeholder="От 2 символов">',
  '<p class="pa-muted" id="pa-search-status">Поиск по всем зарегистрированным аккаунтам.</p>',
  '<div id="pa-results" class="pa-results" aria-live="polite"></div></div>',
  '<div class="pa-card"><h3>2. Назначь срок</h3>',
  '<div id="pa-selected" class="pa-selected" role="status">Пользователь не выбран</div>',
  '<form id="pa-form"><label for="pa-days">Продолжительность</label>',
  '<select id="pa-days"><option value="7">7 дней</option><option value="30" selected>30 дней</option>',
  '<option value="90">90 дней</option><option value="365">1 год</option><option value="3650">10 лет</option></select>',
  '<label for="pa-note">Причина (необязательно)</label>',
  '<input id="pa-note" maxlength="160" autocomplete="off" placeholder="Подарок, конкурс…">',
  '<p class="pa-muted">Срок добавляется к уже активному Premium. Разовые бонусы +2000 XP и +500 AniCoin повторно не начисляются.</p>',
  '<button class="pa-primary" id="pa-grant" type="submit" disabled>Выдать Premium</button></form></div></div>',
  '<section class="pa-card"><div class="pa-top"><div><h3>История выдач</h3>',
  '<p class="pa-muted">Отзыв подарка не отменяет оплаченную подписку.</p></div>',
  '<button id="pa-refresh" type="button">↻ Обновить</button></div><div id="pa-history" class="pa-history-list"></div></section>',
  '<p id="pa-message" role="status" aria-live="polite" class="pa-message"></p>'
 ].join('');
 root.append(section);
 const $=id=>section.querySelector('#'+id);
 const node=(tag,text)=>{
  const x=document.createElement(tag);if(text!==undefined)x.textContent=String(text);return x;
 };
 const when=value=>{
  const d=new Date(value);
  return value&&!Number.isNaN(d.getTime())?d.toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}):'—';
 };
 const message=(v,error)=>{
  $('pa-message').textContent=v;$('pa-message').dataset.error=error?'true':'false';
 };
 let selected=null,busy=false,latest=0,searchTimeout=null;
 const display=u=>String(u.username||u.display_name||'Пользователь');
 function statusBusy(b){
  busy=b;$('pa-grant').disabled=b||!selected;$('pa-search').disabled=b;$('pa-refresh').disabled=b;
 }
 async function search(){
  const q=$('pa-search').value.trim(),id=++latest;
  $('pa-results').replaceChildren();
  if(q.length<2){$('pa-search-status').textContent='Введите минимум 2 символа.';return;}
  $('pa-search-status').textContent='Ищем…';
  const {data,error}=await db.rpc('komi_admin_premium_search',{p_query:q});
  if(id!==latest||!section.isConnected)return;
  if(error){$('pa-search-status').textContent='Ошибка поиска';message(error.message,true);return;}
  const users=Array.isArray(data)?data:[];
  $('pa-search-status').textContent=users.length?'Найдено: '+users.length+' (до 30)':'Ничего не найдено';
  for(const u of users){
   const line=node('div');line.className='pa-user';
   const info=node('div');
   info.append(node('strong',display(u)),node('small',u.email||u.display_name||''));
   info.append(node('small',u.is_premium?'Premium до '+when(u.premium_until):'Нет Premium'));
   const btn=node('button',selected?.user_id===u.user_id?'Выбран':'Выбрать');
   btn.type='button';btn.disabled=selected?.user_id===u.user_id;
   btn.addEventListener('click',()=>{
    selected=u;
    $('pa-selected').replaceChildren(node('strong',display(u)),node('small',u.email||''));
    if(u.is_premium)$('pa-selected').append(node('small','Активен до '+when(u.premium_until)));
    $('pa-grant').disabled=busy;
    $('pa-results').querySelectorAll('button').forEach(b=>{b.disabled=b===btn;b.textContent=b===btn?'Выбран':'Выбрать';});
   });
   line.append(info,btn);$('pa-results').append(line);
  }
 }
 async function history(){
  const {data,error}=await db.rpc('komi_admin_premium_history');
  if(error){message(error.message,true);return;}
  const list=$('pa-history');list.replaceChildren();
  if(!Array.isArray(data)||!data.length){list.append(node('p','Пока нет подарков.'));return;}
  for(const g of data){
   const line=node('div');line.className='pa-record';
   const left=node('div');left.append(node('strong',display(g)));
   left.append(node('small',g.valid_days+' дн. · '+when(g.granted_at)+' · до '+when(g.granted_until)));
   if(g.note)left.append(node('small','Причина: '+g.note));
   const right=node('div');
   const active=!g.revoked_at&&new Date(g.granted_until)>new Date();
   right.append(node('small',g.revoked_at?'Отозван':active?'Активен':'Истёк'));
   if(active){
    const button=node('button','Отозвать');button.type='button';button.className='pa-revoke';
    button.disabled=busy;
    button.addEventListener('click',async()=>{
     if(busy||!confirm('Отозвать подарок у '+display(g)+'? Оплаченные подписки останутся.'))return;
     statusBusy(true);
     try{
      const {error}=await db.rpc('komi_admin_premium_revoke',{p_contract_id:g.contract_id});
      if(error)throw error;
      message('Подарок отозван.');
      await history();if($('pa-search').value.trim().length>=2)await search();
      window.KomiPremium?.refresh?.(true);
     }catch(e){message(e.message||'Ошибка отзыва',true);}
     finally{statusBusy(false);}
    });right.append(button);
   }
   line.append(left,right);list.append(line);
  }
 }
 $('pa-back').onclick=()=>goBack?.();
 $('pa-close').onclick=()=>document.getElementById('adminModal')?.classList.remove('active');
 $('pa-refresh').onclick=history;
 $('pa-search').addEventListener('input',()=>{
  clearTimeout(searchTimeout);searchTimeout=setTimeout(search,250);
 });
 $('pa-form').addEventListener('submit',async e=>{
  e.preventDefault();
  if(!selected||busy)return;
  const target=selected,days=Number($('pa-days').value),note=$('pa-note').value.trim();
  if(![7,30,90,365,3650].includes(days))return message('Неверный срок',true);
  if(!confirm('Выдать Premium аккаунту '+display(target)+' на '+days+' дней?'))return;
  statusBusy(true);
  try{
   const {data,error}=await db.rpc('komi_admin_premium_grant',{
    p_user_id:target.user_id,p_days:days,p_note:note||null
   });
   if(error)throw error;
   message('Premium успешно выдан до '+when(data?.active_until));
   $('pa-note').value='';
   await history();if($('pa-search').value.trim().length>=2)await search();
   window.KomiPremium?.refresh?.(true);
  }catch(err){message(err.message||'Не удалось выдать Premium',true);}
  finally{statusBusy(false);}
 });
 await history();
 $('pa-search').focus();
};
})();
