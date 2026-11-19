/* Premium profile identity. CSS and audio are fixed presets: no third-party copyrighted music. */
(function(root){
'use strict';
const gradients=[
 '', 'linear-gradient(110deg,#f0f0f0,#777)',
 'linear-gradient(110deg,#ff8595,#c959ff)',
 'linear-gradient(110deg,#79bfff,#bd8eff)',
 'linear-gradient(110deg,#81f3e7,#89bbff)',
 'linear-gradient(110deg,#f2d783,#ef9fbb)'
];
const allowedEmoji=['','✨','🌙','🎬','⭐','🔥','💫'];
const soundNotes={
  1:[220,277.18,329.63,440,329.63,277.18],
  2:[196,246.94,293.66,392,293.66,246.94]
};
let client=null,settings=new Map(),owner='',busy=false,audio=null;
function themeCss(){
 if(document.getElementById('komi-identity-css'))return;
 const style=document.createElement('style');
 style.id='komi-identity-css';
 style.textContent='.komi-premium-gradient{background-image:var(--komi-nick-gradient);background-clip:text;-webkit-background-clip:text;color:transparent!important;-webkit-text-fill-color:transparent}.komi-premium-identity-settings{margin:18px 0;padding:18px;border:1px solid #3a3a3a;border-radius:18px;background:#111;color:#f5f5f5}.komi-premium-identity-settings label{display:block;margin:12px 0;font-size:13px}.komi-premium-identity-settings select{width:100%;max-width:330px;background:#171717;color:#fff;border:1px solid #555;padding:10px;border-radius:10px}.komi-profile-music-btn{margin-left:10px;border:1px solid #555;border-radius:10px;padding:6px 9px;background:#151515;color:#fff;font-size:12px;cursor:pointer}';
 document.head.append(style);
}
function getId(host){
 const direct=host.getAttribute('data-komi-premium-id');
 return direct || root.KomiPremium?.idForUsername?.(host.getAttribute('data-komi-premium-username')) || '';
}
function stopAudio(){
 if(!audio)return;
 const old=audio;audio=null;
 if(old.timer)clearTimeout(old.timer);
 try{old.ctx.close();}catch{}
}
function playAudio(id,mode){
 stopAudio();
 const Ctx=root.AudioContext||root.webkitAudioContext;
 if(!Ctx||!soundNotes[mode])return false;
 try{
  const ctx=new Ctx();
  audio={id,ctx,mode,timer:null};
  const schedule=()=>{
   if(audio?.ctx!==ctx||document.hidden)return stopAudio();
   const now=ctx.currentTime+0.05;
   soundNotes[mode].forEach((hz,i)=>{
    const osc=ctx.createOscillator();
    const volume=ctx.createGain();
    const time=now+i*0.36;
    osc.type='sine';osc.frequency.setValueAtTime(hz,time);
    volume.gain.setValueAtTime(0.0001,time);
    volume.gain.exponentialRampToValueAtTime(0.026,time+0.05);
    volume.gain.exponentialRampToValueAtTime(0.0001,time+0.65);
    osc.connect(volume);volume.connect(ctx.destination);
    osc.start(time);osc.stop(time+0.68);
   });
   audio.timer=setTimeout(schedule,2600);
  };
  schedule();
  return true;
 }catch{stopAudio();return false;}
}
function apply(){
 const premium=root.KomiPremium;
 for(const host of document.querySelectorAll('[data-komi-premium-id],[data-komi-premium-username]')){
  const id=getId(host);
  const valid=!!id&&premium?.isActiveId?.(id);
  const record=valid?settings.get(id):null;
  const target=host.matches('strong,h2')?host:
   host.querySelector('[data-profile-field="display-name"],h2,strong');
  if(!target)continue;
  const theme=Number(record?.nick_theme)||0;
  target.classList.toggle('komi-premium-gradient',Boolean(theme&&gradients[theme]));
  if(theme&&gradients[theme])target.style.setProperty('--komi-nick-gradient',gradients[theme]);
  else target.style.removeProperty('--komi-nick-gradient');
  const sibling=target.nextElementSibling;
  let emojiNode=sibling?.hasAttribute('data-komi-identity-emoji')?sibling:null;
  const emoji=allowedEmoji.includes(record?.status_emoji)?record.status_emoji:'';
  if(emoji){
   if(!emojiNode){
    emojiNode=document.createElement('span');
    emojiNode.dataset.komiIdentityEmoji='';
    emojiNode.setAttribute('aria-label','Эмодзи-статус Premium');
    target.insertAdjacentElement('afterend',emojiNode);
   }
   if(emojiNode.textContent!==emoji)emojiNode.textContent=emoji;
  }else emojiNode?.remove();
 }
 const profile=document.querySelector('#profile[data-profile-user]');
 if(!profile){if(audio)stopAudio();return;}
 const username=profile.getAttribute('data-profile-user');
 const id=premium?.idForUsername?.(username);
 const record=premium?.isActiveId?.(id)?settings.get(id):null;
 const mode=Number(record?.music_theme)||0;
 const controls=profile.querySelector('.profile-name-row');
 if(!controls){if(audio)stopAudio();return;}
 let button=controls.querySelector('[data-komi-profile-music]');
 if(!mode||!soundNotes[mode]){
  button?.remove();
  if(audio)stopAudio();
  return;
 }
 if(!button){
  button=document.createElement('button');
  button.type='button';button.className='komi-profile-music-btn';
  button.dataset.komiProfileMusic='';
  button.addEventListener('click',()=>{
   const playing=audio?.id===button.dataset.userId&&audio?.mode===Number(button.dataset.musicMode);
   if(playing)stopAudio();
   else playAudio(button.dataset.userId,Number(button.dataset.musicMode));
   button.textContent=audio?.id===button.dataset.userId?'■ Остановить тему':'♫ Послушать тему';
  });
  controls.append(button);
 }
 button.dataset.userId=id;
 button.dataset.musicMode=String(mode);
 button.textContent=audio?.id===id?'■ Остановить тему':'♫ Послушать тему';
 if(audio&&(audio.id!==id||audio.mode!==mode))stopAudio();
}
async function refresh(){
 if(!client)return;
 const {data,error}=await client.from('komi_premium_profile_prefs')
  .select('user_id,nick_theme,status_emoji,music_theme').limit(1000);
 if(error){console.warn('Premium profile identity unavailable',error.message);return;}
 settings=new Map((data||[]).map(row=>[String(row.user_id),row]));
 apply();
 const section=document.querySelector('[data-komi-identity-settings]');
 const id=section?.dataset.komiIdentitySettings;
 const current=settings.get(id)||{};
 for(const select of section?.querySelectorAll('select[data-premium-identity]')||[]){
  const next=String(current[select.dataset.premiumIdentity]??(select.dataset.premiumIdentity==='status_emoji'?'':0));
  if(document.activeElement!==select)select.value=next;
 }
}
function mount(container,id,active){
 const page=container?.querySelector('#premium');
 if(!page||!active||!id)return;
 if(page.querySelector('[data-komi-identity-settings]'))return;
 const section=document.createElement('section');
 section.className='komi-premium-identity-settings';
 section.dataset.komiIdentitySettings=id;
 const heading=document.createElement('h2');
 heading.textContent='Premium: стиль ника, статус и музыкальная тема';
 const help=document.createElement('p');
 help.textContent='Темы создаются звуком браузера, без чужих аудиозаписей. Музыка включается только после нажатия посетителем профиля.';
 section.append(heading,help);
 const controls=[
  {key:'nick_theme',label:'Градиент ника',options:[['0','Обычный'],['1','Монохром'],['2','Розовый'],['3','Небесный'],['4','Бирюзовый'],['5','Золотой']]},
  {key:'status_emoji',label:'Эмодзи-статус',options:allowedEmoji.map(emoji=>[emoji,emoji||'Без статуса'])},
  {key:'music_theme',label:'Оригинальная тема профиля',options:[['0','Выключена'],['1','Тихий вечер'],['2','Космический свет']]}
 ];
 for(const control of controls){
  const label=document.createElement('label');
  label.textContent=control.label;
  const select=document.createElement('select');
  select.dataset.premiumIdentity=control.key;
  for(const [value,title] of control.options){
   const option=document.createElement('option');option.value=value;option.textContent=title;select.append(option);
  }
  select.value=String(settings.get(id)?.[control.key]??(control.key==='status_emoji'?'':0));
  label.append(select);section.append(label);
 }
 const save=document.createElement('button');
 save.type='button';save.className='komi-premium-action';save.textContent='Сохранить стиль';
 const status=document.createElement('p');status.setAttribute('role','status');
 section.append(save,status);
 save.addEventListener('click',async()=>{
  if(busy||!client)return;
  const entry={user_id:id};
  for(const select of section.querySelectorAll('select[data-premium-identity]')){
   const key=select.dataset.premiumIdentity;
   entry[key]=key==='status_emoji'?select.value:Number(select.value);
  }
  if(!Number.isInteger(entry.nick_theme)||entry.nick_theme<0||entry.nick_theme>5||
     !Number.isInteger(entry.music_theme)||entry.music_theme<0||entry.music_theme>2||
     !allowedEmoji.includes(entry.status_emoji))return;
  busy=true;save.disabled=true;status.textContent='Сохраняем…';
  try{
   const {data:{user},error:authError}=await client.auth.getUser();
   if(authError||user?.id!==id||!root.KomiPremium?.isActiveId?.(id))
    throw Error('Требуется активный Premium владельца.');
   const {error}=await client.from('komi_premium_profile_prefs').upsert(entry,{onConflict:'user_id'});
   if(error)throw error;
   settings.set(id,entry);apply();status.textContent='Стиль сохранён.';
  }catch(e){status.textContent=e?.message||'Ошибка сохранения.';}
  finally{busy=false;save.disabled=false;}
 });
 page.append(section);
}
function setClient(value){
 client=value||null;owner='';settings=new Map();stopAudio();
 if(client)void refresh();
}
function start(){
 themeCss();
 const observer=new MutationObserver(()=>apply());
 observer.observe(document.body,{childList:true,subtree:true});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stopAudio();});
 apply();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
root.KomiPremiumDecor={setClient,refresh,mount,apply,stopAudio};
})(window);
