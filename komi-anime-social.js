/* Anime-specific reviews and studio follows. Safe text nodes only. */
(function(){
'use strict';
const k=()=>window.KomiCommunity;
const tags=['Сильный сюжет','Красивая рисовка','Слитая концовка','Отличный саундтрек','Любимые герои'];
const validId=id=>Number.isSafeInteger(Number(id))&&Number(id)>0;
function mount(){
 const comments=document.getElementById('komiAnimeComments'),content=document.getElementById('watchModalContent');
 if(!comments||!content||!validId(comments.dataset.animeId))return;
 const id=Number(comments.dataset.animeId),tag=content.querySelector('#komiAnimeSocial');
 if(tag&&tag.dataset.animeId===String(id))return;
 tag?.remove();
 const section=k().node('section',undefined,'komi-lab-card');
 section.id='komiAnimeSocial';section.dataset.animeId=String(id);
 section.append(k().node('h3','Рецензии и озвучка'));
 const row=k().node('div',undefined,'komi-lab-row'),result=k().node('div');
 row.append(k().btn('Рецензии',()=>reviews(id,result)),k().btn('Подписка на озвучку',()=>voices(id,result)));
 section.append(row,result);
 comments.before(section);
}
function alive(id,out){return out.isConnected&&Number(document.getElementById('komiAnimeComments')?.dataset.animeId)===id}
async function reviews(id,out){
 const K=k();out.replaceChildren();
 const heading=K.node('h4','Отзывы зрителей'),status=K.node('p',undefined,'komi-lab-status'),list=K.node('div');
 out.append(heading);
 const form=document.createElement('form'),text=K.node('textarea');
 text.rows=5;text.minLength=40;text.maxLength=3000;text.placeholder='Напиши развёрнутую рецензию (40–3000 символов)';
 const chips=K.node('div',undefined,'komi-lab-row'),selected=new Set();
 tags.forEach(tag=>{
  const b=K.btn(tag,()=>{if(selected.has(tag))selected.delete(tag);else if(selected.size<3)selected.add(tag);b.setAttribute('aria-pressed',String(selected.has(tag)))});
  b.setAttribute('aria-pressed','false');chips.append(b);
 });
 const send=K.btn('Опубликовать рецензию');send.type='submit';form.append(text,chips,send);
 form.onsubmit=async event=>{
  event.preventDefault();if(!K.signed())return;
  if(text.value.trim().length<40){K.notice(status,'Нужно не меньше 40 символов.');return}
  send.disabled=true;K.notice(status,'Сохраняем…');
  const result=await K.api().from('komi_reviews').upsert({
   anime_id:id,user_id:K.owner(),body:text.value.trim(),tags:[...selected]
  },{onConflict:'anime_id,user_id'});
  if(result.error)K.notice(status,result.error.message);
  else{form.reset();selected.clear();await load()}
  send.disabled=false;
 };
 out.append(form,status,list);
 async function load(){
  const {data,error}=await K.api().from('komi_reviews').select('id,user_id,body,tags,created_at').eq('anime_id',id).order('created_at',{ascending:false}).limit(40);
  if(!alive(id,out))return;
  if(error){K.notice(status,'Не удалось загрузить рецензии: '+error.message);return}
  list.replaceChildren();
  if(!data?.length){list.append(K.node('p','Пока нет рецензий.'));return}
  const ids=data.map(x=>x.id);
  const uids=[...new Set(data.map(x=>x.user_id))];
  const [votes,profiles]=await Promise.all([
   K.api().from('komi_review_votes').select('review_id,user_id').in('review_id',ids),
   K.api().from('komi_profiles').select('user_id,display_name,username').in('user_id',uids)
  ]);
  if(!alive(id,out))return;
  for(const review of data){
   const p=(profiles.data||[]).find(x=>x.user_id===review.user_id);
   const c=K.card(list,p?.display_name||p?.username||'Участник KomiAnime',review.body);
   c.append(K.node('small',(review.tags||[]).join(' · '),'komi-lab-note'));
   const count=(votes.data||[]).filter(v=>v.review_id===review.id).length;
   const mine=review.user_id===K.owner();
   const liked=(votes.data||[]).some(v=>v.review_id===review.id&&v.user_id===K.owner());
   c.append(K.btn('Полезно '+count+(liked?' ✓':''),async()=>{
    if(!K.signed())return;
    const query=liked?K.api().from('komi_review_votes').delete().eq('review_id',review.id).eq('user_id',K.owner()):
     K.api().from('komi_review_votes').insert({review_id:review.id,user_id:K.owner()});
    const {error}=await query;if(error)K.notice(status,error.message);else load();
   }));
   if(mine)c.append(K.btn('Удалить мою рецензию',async()=>{
    const {error}=await K.api().from('komi_reviews').delete().eq('id',review.id).eq('user_id',K.owner());
    if(error)K.notice(status,error.message);else load();
   }));
  }
 }
 await load();
}
function studioList(id){
 const anime=k().catalog().find(a=>Number(a.shikimoriId||a.id)===id);
 const set=new Set();
 for(const ep of (anime?.episodes||[]).slice(0,100)){
  for(const raw of Object.keys(ep?.sources||{})){
   const studio=raw.replace(/^Озвучка\s+/i,'').split(' (')[0].trim();
   if(studio.length>=2&&studio.length<=72&&!/^(?:Недоступно|Основной источник)$/i.test(studio))set.add(studio);
  }
 }
 return [...set].sort((a,b)=>a.localeCompare(b,'ru')).slice(0,40);
}
async function voices(id,out){
 const K=k();out.replaceChildren();
 const status=K.node('p',undefined,'komi-lab-status');
 out.append(K.node('p','Уведомления приходят только при появлении новой серии или источника в выбранной студии.','komi-lab-note'));
 const select=K.node('select'),values=studioList(id);
 for(const v of values){const option=K.node('option',v);option.value=v;select.append(option)}
 const follow=K.btn('🔔 Подписаться'),my=K.node('div');
 out.append(select,follow,status,my);
 if(!values.length){follow.disabled=true;K.notice(status,'В каталоге пока нет именованных озвучек.');return}
 async function load(){
  if(!K.owner()){K.notice(status,'Войди, чтобы подписаться.');return}
  const {data,error}=await K.api().from('komi_voice_follows').select('studio').eq('user_id',K.owner()).eq('anime_id',id);
  if(!alive(id,out))return;
  if(error){K.notice(status,error.message);return}
  my.replaceChildren();
  for(const f of data||[]){
   my.append(K.btn('🔔 '+f.studio+' ×',async()=>{
    const {error}=await K.api().from('komi_voice_follows').delete().eq('user_id',K.owner()).eq('anime_id',id).eq('studio',f.studio);
    if(error)K.notice(status,error.message);else load();
   }));
  }
 }
 follow.onclick=async()=>{
  if(!K.signed())return;
  follow.disabled=true;
  const {error}=await K.api().from('komi_voice_follows').upsert({user_id:K.owner(),anime_id:id,studio:select.value},{onConflict:'user_id,anime_id,studio',ignoreDuplicates:true});
  K.notice(status,error?error.message:'Подписка сохранена.');
  follow.disabled=false;if(!error)load();
 };
 await load();
}
const root=document.getElementById('watchModalContent');
if(root)new MutationObserver(mount).observe(root,{childList:true,subtree:true});
mount();
window.KomiAnimeSocial={mount,reviews,voices};
})();