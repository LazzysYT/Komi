/* Premium-only animated GIF uploads; Supabase RLS is the authorization boundary.
 * Uploads never change Premium status, XP or AniCoin.
 */
(function(window){
'use strict';
let client=null;
const MAX_AVATAR=6291456,MAX_BACKGROUND=8388608;
function feedback(input,message){
 const host=input.closest('[data-komi-premium-editor]');
 const status=host?.querySelector('[data-komi-premium-upload-status]');
 if(status)status.textContent=message;
}
async function save(file,type,input){
 if(!client){feedback(input,'Хранилище пока недоступно.');return;}
 if(type!=='avatar'&&type!=='background')return;
 const max=type==='avatar'?MAX_AVATAR:MAX_BACKGROUND;
 if(!file||file.size===0||file.size>max||!String(file.name).toLowerCase().endsWith('.gif')||
   file.type!=='image/gif'){
  feedback(input,'Выбери GIF: аватар до 6 МБ, фон до 8 МБ.');
  return;
 }
 input.disabled=true;
 try{
  const header=new TextDecoder('ascii').decode(await file.slice(0,6).arrayBuffer());
  if(header!=='GIF87a'&&header!=='GIF89a')
    throw Error('Файл не является корректным GIF.');
  const {data:{user},error:authError}=await client.auth.getUser();
  if(authError||!user?.id)throw Error('Войди в аккаунт KomiAnime.');
  if(!window.KomiPremium?.isActiveId(user.id))await window.KomiPremium?.refresh(true);
  if(!window.KomiPremium?.isActiveId(user.id))
    throw Error('Для анимированных изображений требуется активный Premium.');
  const bucket=type==='avatar'?'avatars':'premium-profile-backgrounds';
  const column=type==='avatar'?'avatar_path':'background_path';
  const path=user.id+'/'+crypto.randomUUID()+'.gif';
  feedback(input,'Загружаем GIF…');
  const uploaded=await client.storage.from(bucket).upload(path,file,{
    contentType:'image/gif',upsert:false,cacheControl:'3600'
  });
  if(uploaded.error)throw Error('Ошибка загрузки: '+uploaded.error.message);
  // Existing other media path must remain unchanged.
  const state=await client.from('komi_premium_media')
    .select('user_id,avatar_path,background_path').eq('user_id',user.id).maybeSingle();
  if(state.error)throw state.error;
  const patch={[column]:path};
  const write=state.data
    ?await client.from('komi_premium_media').update(patch)
       .eq('user_id',user.id).select('user_id').maybeSingle()
    :await client.from('komi_premium_media')
       .insert({user_id:user.id,...patch}).select('user_id').maybeSingle();
  if(write.error)throw Error('Ошибка сохранения: '+write.error.message);
  if(!write.data)throw Error('Нет доступа для изменения оформления профиля.');
  await window.KomiPremium?.refresh(true);
  feedback(input,'Готово! Анимация видна в твоём профиле.');
 }catch(error){
  feedback(input,error?.message||'Не удалось загрузить GIF.');
 }finally{
  input.disabled=false;input.value='';
 }
}
function start(){
 document.addEventListener('change',event=>{
  const input=event.target?.closest?.('input[data-komi-premium-upload]');
  if(!input)return;
  const type=input.getAttribute('data-komi-premium-upload');
  if(input.files?.[0])save(input.files[0],type,input);
 });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
else start();
window.KomiPremiumMedia={setClient(value){client=value||null;}};
})(window);
