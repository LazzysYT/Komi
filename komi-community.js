/* KomiAnime Community Hub: isolated UI, Supabase remains the source of truth. */
(function(){
'use strict';
const api=()=>typeof _supabase!=='undefined'?_supabase:null;
const owner=()=>typeof currentUser!=='undefined'?currentUser?.authUserId:null;
const catalog=()=>typeof animeList!=='undefined'&&Array.isArray(animeList)?animeList:[];
function node(tag,text,cls){const n=document.createElement(tag);if(text!==undefined)n.textContent=String(text);if(cls)n.className=cls;return n}
function btn(text,cb){const b=node('button',text,'komi-lab-btn');b.type='button';if(cb)b.onclick=cb;return b}
function notice(n,text){n.textContent=text;n.setAttribute('role','status')}
function signed(){if(owner()&&api())return true;if(typeof openAuthModal==='function')openAuthModal('login');return false}
const style=node('style');
style.textContent='.komi-lab-overlay{position:fixed;inset:0;background:#000c;z-index:19000;display:grid;place-items:center;padding:16px}.komi-lab-box{box-sizing:border-box;width:min(710px,100%);max-height:90vh;overflow:auto;background:#101013;color:white;border:1px solid #ffffff33;border-radius:16px;padding:22px;font:14px/1.5 Inter,sans-serif;box-shadow:0 30px 80px #0009}.komi-lab-head{display:flex;justify-content:space-between;align-items:center;gap:12px}.komi-lab-head h2{font-size:19px;margin:0}.komi-lab-box input,.komi-lab-box select,.komi-lab-box textarea{box-sizing:border-box;background:#1d1d21;border:1px solid #ffffff44;border-radius:9px;color:#fff;padding:10px;width:100%;font:inherit}.komi-lab-btn,.komi-lab-box button{display:inline-block;background:#222227;color:#fff;border:1px solid #ffffff3b;border-radius:9px;padding:9px 12px;cursor:pointer;font:inherit}.komi-lab-box button:hover,.komi-lab-btn:hover{background:#38383f}.komi-lab-box button:disabled{opacity:.5}.komi-lab-card{border:1px solid #ffffff26;border-radius:12px;padding:13px;margin:10px 0}.komi-lab-card h3{font-size:16px;margin:0 0 6px}.komi-lab-row{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}.komi-lab-row>*{flex:1;min-width:100px}.komi-lab-note{color:#bbb;font-size:12px}.komi-lab-status{min-height:25px;color:#ddd}.komi-lab-box label{display:block;margin:8px 0 4px}@media(max-width:600px){.komi-lab-box{padding:14px}.komi-lab-head h2{font-size:16px}}';
document.head.append(style);
let overlay;
function dialog(title){
 overlay?.remove();overlay=node('div',undefined,'komi-lab-overlay');
 const box=node('section',undefined,'komi-lab-box');box.setAttribute('role','dialog');box.setAttribute('aria-modal','true');box.setAttribute('aria-label',title);
 const header=node('header',undefined,'komi-lab-head');header.append(node('h2',title));
 const close=btn('✕',()=>{overlay?.remove();overlay=null});close.setAttribute('aria-label','Закрыть');header.append(close);box.append(header);
 const body=node('div');box.append(body);overlay.append(box);document.body.append(overlay);
 overlay.onclick=e=>{if(e.target===overlay)close.click()};close.focus();return body;
}
function card(into,title,description){const c=node('section',undefined,'komi-lab-card');c.append(node('h3',title),node('p',description||''));into.append(c);return c}
function hub(){
 const root=dialog('KomiAnime · Инструменты');
 const row=node('div',undefined,'komi-lab-row');
 row.append(btn('Импорт списков',()=>window.KomiImport?.open()),btn('Подборки',collections),
 btn('Anime Wrapped',()=>window.KomiWrapped?.open()),btn('Пригласить друга',referral));
 root.append(row);
 card(root,'Всё в одном месте','Импорт Shikimori и MyAnimeList, подборки сообщества, карточка итогов и приглашения.');
 root.append(node('p','Рецензии и подписки на озвучку находятся в карточках аниме.','komi-lab-note'));
}
async function collections(){
 if(!api())return;
 const root=dialog('Тематические подборки'),out=node('p',undefined,'komi-lab-status'),list=node('div');
 root.append(btn('+ Создать подборку',createCollection),out,list);
 try{
 const {data,error}=await api().from('komi_collections').select('id,owner_id,title,description,is_public').order('created_at',{ascending:false}).limit(40);
 if(error)throw error;
 const ids=(data||[]).map(x=>x.id);let votes=[];
 if(ids.length){const r=await api().from('komi_collection_likes').select('collection_id,user_id').in('collection_id',ids);if(!r.error)votes=r.data||[]}
 if(!data?.length)list.append(node('p','Подборок пока нет.'));
 for(const item of data||[]){
  const c=card(list,item.title,item.description),row=node('div',undefined,'komi-lab-row');
  row.append(btn('Открыть',()=>showCollection(item)));
  const liked=!!owner()&&votes.some(v=>v.collection_id===item.id&&v.user_id===owner());
  const like=btn((liked?'♥ ':'♡ ')+votes.filter(v=>v.collection_id===item.id).length,async()=>{
   if(!signed())return;like.disabled=true;
   const req=liked?api().from('komi_collection_likes').delete().eq('collection_id',item.id).eq('user_id',owner()):
      api().from('komi_collection_likes').insert({collection_id:item.id,user_id:owner()});
   const {error}=await req;if(error){notice(out,error.message);like.disabled=false}else collections();
  });
  row.append(like);c.append(row);
 }
 }catch(e){notice(out,'Ошибка загрузки: '+e.message)}
}
function createCollection(){
 if(!signed())return;
 const root=dialog('Создать подборку'),title=node('input'),desc=node('textarea'),search=node('input'),results=node('div',undefined,'komi-lab-row'),chosen=node('div',undefined,'komi-lab-row');
 title.maxLength=90;title.placeholder='Название от 3 символов';desc.maxLength=800;desc.placeholder='Описание';desc.rows=3;search.placeholder='Найти аниме по названию';
 root.append(node('label','Название'),title,node('label','Описание'),desc,node('label','Аниме'),search,results,node('label','Добавлено'),chosen);
 const pub=node('input');pub.type='checkbox';pub.checked=true;pub.style.width='auto';
 const label=node('label',' Публичная подборка');label.prepend(pub);root.append(label);
 const selected=new Map(),out=node('p',undefined,'komi-lab-status');
 const repaint=()=>{chosen.replaceChildren();for(const [id,name] of selected)chosen.append(btn(name+' ×',()=>{selected.delete(id);repaint()}))};
 search.oninput=()=>{results.replaceChildren();const q=search.value.trim().toLowerCase();if(q.length<2)return;
  for(const a of catalog().filter(a=>String(a.title||'').toLowerCase().includes(q)).slice(0,8)){
    const id=Number(a.shikimoriId||a.id);if(!Number.isSafeInteger(id))continue;
    results.append(btn(a.title,()=>{if(selected.size>=25)return;selected.set(id,a.title);repaint()}));
  }
 };
 const save=btn('Сохранить',async()=>{
  if(title.value.trim().length<3||!selected.size||selected.size>25){notice(out,'Название от 3 букв и 1–25 аниме.');return}
  save.disabled=true;try{
    const id=owner(),{data,error}=await api().from('komi_collections').insert({owner_id:id,title:title.value.trim(),description:desc.value.trim(),is_public:pub.checked}).select('id').single();
    if(error)throw error;
    const items=[...selected.keys()].map((anime_id,position)=>({collection_id:data.id,anime_id,position}));
    const inserted=await api().from('komi_collection_items').insert(items);if(inserted.error)throw inserted.error;
    collections();
  }catch(e){notice(out,'Не удалось сохранить: '+e.message)}finally{save.disabled=false}
 });root.append(save,out);
}
async function addPlans(ids,out){
 if(!signed())return;
 const user=owner(),unique=[...new Set(ids.map(Number).filter(Number.isSafeInteger))].slice(0,100);
 if(!unique.length)return;
 const {data,error}=await api().from('komi_anime_lists').select('anime_id').eq('user_id',user).in('anime_id',unique);if(error)throw error;
 if(user!==owner())throw Error('Аккаунт изменился.');
 const existing=new Set((data||[]).map(x=>Number(x.anime_id)));
 const fresh=unique.filter(x=>!existing.has(x));
 if(fresh.length){const result=await api().from('komi_anime_lists').upsert(fresh.map(anime_id=>({anime_id,user_id:user,status:'В планах'})),{onConflict:'user_id,anime_id',ignoreDuplicates:true});if(result.error)throw result.error}
 notice(out,'Новых «В планах»: '+fresh.length+'. Уже в списке: '+existing.size+'. Обнови страницу для синхронизации.');
}
async function showCollection(item){
 const root=dialog(item.title),out=node('p',undefined,'komi-lab-status'),list=node('div');
 root.append(node('p',item.description||'Подборка участника KomiAnime'),list,out);
 try{
 const {data,error}=await api().from('komi_collection_items').select('anime_id,position').eq('collection_id',item.id).order('position').limit(100);if(error)throw error;
 for(const x of data||[]){
   const a=catalog().find(a=>Number(a.shikimoriId||a.id)===Number(x.anime_id));
   const link=node('a',a?.title||'Аниме #'+x.anime_id);
   link.href='/anime/'+encodeURIComponent(x.anime_id);link.style.cssText='display:block;padding:7px;color:white;border-bottom:1px solid #ffffff22';list.append(link);
 }
 root.append(btn('+ Все в «В планах»',async()=>{try{await addPlans((data||[]).map(x=>x.anime_id),out)}catch(e){notice(out,e.message)}}));
 }catch(e){notice(out,e.message)}
}
async function referral(){
 if(!signed())return;
 const root=dialog('Рефералы · по 50 AniCoin'),out=node('p',undefined,'komi-lab-status'),link=node('input');
 root.append(node('p','Бонус после 3 разных отмеченных серий и 60 минут подтверждённого просмотра приглашённого. Бонус только один раз на аккаунт.','komi-lab-note'));
 link.readOnly=true;root.append(link);
 root.append(btn('Скопировать ссылку',()=>navigator.clipboard?.writeText(link.value).then(()=>notice(out,'Ссылка скопирована.')).catch(()=>notice(out,'Скопируй ссылку вручную.'))));
 root.append(btn('Проверить награду',async()=>{const r=await api().rpc('komi_referral',{p_action:'verify'});notice(out,r.error?r.error.message:r.data?.rewarded?'Награда получена.':'Условия ещё не выполнены.')}),out);
 try{
  const pending=sessionStorage.getItem('komi_referral_pending');
  if(/^[a-f0-9]{32}$/.test(pending||'')){
    const claim=await api().rpc('komi_referral',{p_action:'claim',p_code:pending});
    if(!claim.error)sessionStorage.removeItem('komi_referral_pending');
  }
  const {data,error}=await api().rpc('komi_referral',{p_action:'status'});if(error)throw error;
  link.value=location.origin+'/?ref='+data.code;
  notice(out,'Награждённых приглашений: '+data.invite_count+(data.rewarded?' · Твоя награда получена':''));
 }catch(e){notice(out,e.message)}
}
// Register the referral from a link after Google/email sign-in without requiring a menu visit.
let referralClaimBusy=false,referralClaimTried='';
async function claimPendingReferral(){
 const code=sessionStorage.getItem('komi_referral_pending');
 if(!/^[a-f0-9]{32}$/.test(code||'')||!api()||referralClaimBusy)return;
 const account=owner();
 if(!account||referralClaimTried===account+':'+code)return;
 referralClaimBusy=true;referralClaimTried=account+':'+code;
 try{
  const checked=await api().auth.getUser();
  if(!checked.data?.user||checked.data.user.id!==account)return;
  const {error}=await api().rpc('komi_referral',{p_action:'claim',p_code:code});
  if(!error||['22023','23505','42501'].includes(String(error.code||''))){
   sessionStorage.removeItem('komi_referral_pending');
  }
 }catch(error){console.warn('Komi referral claim unavailable:',String(error?.message||error))}
 finally{referralClaimBusy=false}
}
const badgeCache=new Map();
async function refreshReferralBadge(){
 const profile=document.querySelector('.komi-profile-tabs');
 const user=owner();
 if(!profile||!user||profile.querySelector('[data-komi-referral-badge]'))return;
 // Never show a signed-in viewer's badge on another person's profile.
 if(typeof profileTargetUser!=='undefined'&&profileTargetUser&&
    (typeof currentUser==='undefined'||profileTargetUser!==currentUser?.username))return;
 if(!badgeCache.has(user)){
   badgeCache.set(user,null);
   try{
     const {data,error}=await api().rpc('komi_referral',{p_action:'status'});
     if(error)throw error;
     badgeCache.set(user,data?.rewarded?'Приглашённый друг':data?.invite_count?'Пригласил друзей':'');
   }catch{badgeCache.delete(user);return}
 }
 const label=badgeCache.get(user);
 if(!label||owner()!==user||!profile.isConnected)return;
 const badge=node('span','✧ '+label,'komi-lab-note');
 badge.dataset.komiReferralBadge='1';
 badge.style.cssText='display:inline-block;padding:8px;border:1px solid #ffffff2b;border-radius:9px';
 profile.append(badge);
}
try{const code=new URL(location.href).searchParams.get('ref');if(/^[a-f0-9]{32}$/.test(code||''))sessionStorage.setItem('komi_referral_pending',code)}catch{}
function mount(){
 for(const [host,selector] of [[document.querySelector('.komi-hub-tools-panel'),'panel'],[document.getElementById('komiMobileMoreMenu'),'mobile'],[document.querySelector('.komi-profile-tabs'),'profile']]){
   if(!host||host.querySelector('[data-community-launch]'))continue;
   if(selector==='mobile'){
     // Keep the original five mobile popup buttons unchanged for existing navigation.
     const link=node('a','✧ Подборки и импорт','komi-lab-btn');
     link.href='#komi-tools';link.dataset.communityLaunch=selector;
     link.style.cssText='display:block;text-decoration:none;margin:5px 0';
     link.onclick=event=>{event.preventDefault();host.hidden=true;
       document.getElementById('komiMobileMoreToggle')?.setAttribute('aria-expanded','false');hub();};
     host.append(link);
   }else{
     const b=btn('✧ Подборки и импорт',hub);b.dataset.communityLaunch=selector;host.append(b);
   }
 }
 if(owner())void refreshReferralBadge();
}
const main=document.getElementById('mainContainer');if(main)new MutationObserver(mount).observe(main,{childList:true,subtree:true});mount();
if(api()?.auth?.onAuthStateChange){
 api().auth.onAuthStateChange((event,session)=>{
  if(session?.user)setTimeout(()=>void claimPendingReferral(),0);
  else {referralClaimTried='';badgeCache.clear()}
 });
}
setTimeout(()=>void claimPendingReferral(),1000);
window.KomiCommunity={api,owner,catalog,node,btn,notice,signed,dialog,card,addPlans,open:hub,collections,referral};
})();