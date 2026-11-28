(async function(){
'use strict';
const root=document.getElementById('adminSecurityRoot');
if(!root)return;
const db=window.supabase?.createClient("https://xebglnnpoutmdcgukbxf.supabase.co","sb_publishable_SzKz649coUbxHWXjQfdSXQ_GGzzbHrs",{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
if(!db||!window.KomiAdminMfa){root.textContent='Настройки безопасности недоступны.';return;}
let uid='';
window.addEventListener('pagehide',()=>{uid='';root.replaceChildren();});
window.addEventListener('pageshow',e=>{if(e.persisted)location.reload();});
try{
 const user=await db.auth.getUser();
 if(user.error||!user.data?.user?.id){root.textContent='Войдите в аккаунт администратора на основном сайте и откройте страницу снова.';return;}
 uid=user.data.user.id;
 const role=await db.rpc('komi_is_admin');
 if(role.error||role.data!==true){root.textContent='Нет прав администратора.';return;}
 await window.KomiAdminMfa.mount(root,db,()=>location.replace('/'),()=>uid);
}catch{root.textContent='Не удалось проверить права. Попробуйте открыть страницу снова.';}
})();
