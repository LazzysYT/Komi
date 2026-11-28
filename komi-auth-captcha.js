/* Lazy, optional Turnstile integration. Supabase must enforce token verification. */
(function(root){
'use strict';
const publicKey=()=>document.querySelector('meta[name="komi-turnstile-sitekey"]')?.content?.trim()||'';
let sdkPromise=null,active=null;
function getSDK(){
 if(root.turnstile?.render)return Promise.resolve(root.turnstile);
 if(!sdkPromise){
  sdkPromise=new Promise((resolve,reject)=>{
   const script=document.createElement('script');
   let done=false,timer;
   const finish=(ok)=>{if(done)return;done=true;clearTimeout(timer);if(ok&&root.turnstile?.render)resolve(root.turnstile);else{script.remove();reject(Error('Не удалось загрузить проверку безопасности. Попробуйте снова.'));}};
   timer=setTimeout(()=>finish(false),15000);
   script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
   script.async=true;script.onload=()=>finish(true);script.onerror=()=>finish(false);
   document.head.append(script);
  }).catch(e=>{sdkPromise=null;throw e;});
 }
 return sdkPromise;
}
function visible(form){
 const modal=form?.closest('#authModal');
 return !!(form?.isConnected&&modal?.classList.contains('active')&&form.style.display!=='none');
}
function canceled(){const e=Error('Проверка отменена.');e.name='KomiCaptchaCanceled';return e;}
async function challenge(form,key,task){
 const sdk=await getSDK();
 if(task.canceled||!visible(form))throw canceled();
 const host=document.createElement('div');
 host.style.cssText='display:grid;justify-content:center;max-width:100%;overflow:hidden;margin:8px 0';
 host.setAttribute('aria-label','Проверка безопасности');host.setAttribute('role','group');
 form.insertBefore(host,form.querySelector('button[type="submit"]'));
 let widget=null,timer=null,observer=null,done=false;
 try{
  return await new Promise((resolve,reject)=>{
   const finish=(error,token)=>{if(done)return;done=true;clearTimeout(timer);observer?.disconnect();task.abort=null;if(error)reject(error);else resolve(token);};
   task.abort=()=>finish(canceled());
   timer=setTimeout(()=>finish(Error('Время проверки истекло. Нажмите кнопку ещё раз.')),120000);
   observer=new MutationObserver(()=>{if(!visible(form))finish(canceled());});
   observer.observe(form.closest('#authModal'),{attributes:true,attributeFilter:['class','style','inert'],subtree:true,childList:true});
   try{
    widget=sdk.render(host,{sitekey:key,theme:'dark',size:'flexible','response-field':false,
      callback:token=>{if(!visible(form)||task.canceled)finish(canceled());else if(typeof token!=='string'||!token||token.length>2048)finish(Error('Проверка не завершилась. Попробуйте снова.'));else finish(null,token);},
      'error-callback':()=>finish(Error('Проверка безопасности недоступна. Попробуйте снова.')),
      'expired-callback':()=>finish(Error('Время проверки истекло. Попробуйте снова.')),
      'timeout-callback':()=>finish(Error('Время проверки истекло. Попробуйте снова.'))});
   }catch{finish(Error('Не удалось запустить проверку безопасности.'));}
  });
 } finally {
  clearTimeout(timer);observer?.disconnect();task.abort=null;
  if(widget!=null)try{sdk.remove(widget);}catch{}
  host.remove();
 }
}
// No duplicate login/signup requests. A canceled challenge never reaches Auth.
function makeRunner({keyFor,verify,isVisible,setBusy}){
 let running=null;
 function cancel(){if(!running||running.submitted)return;running.canceled=true;running.abort?.();}
 async function run(form,send){
  if(running)return {skipped:true};
  if(!isVisible(form))return {skipped:true};
  const task={canceled:false,submitted:false,abort:null};running=task;
  try{
   setBusy(form,true);
   const key=keyFor();
   const token=key?await verify(form,key,task):undefined;
   if(task.canceled||!isVisible(form))return {skipped:true};
   if(key&&(typeof token!=='string'||!token||token.length>2048))throw Error('Проверка безопасности не завершена.');
   task.submitted=true;
   return {value:await send(token)};
  }catch(e){
   if(task.canceled||e?.name==='KomiCaptchaCanceled')return {skipped:true};
   throw e;
  }finally{
   running=null;setBusy(form,false);
  }
 }
 return {run,cancel};
}
if(typeof module==='object'&&module.exports){module.exports={makeRunner};return;}
root.KomiAuthCaptcha=makeRunner({keyFor:publicKey,verify:challenge,isVisible:visible,setBusy(form,busy){
 for(const b of form.querySelectorAll('button[type="submit"]'))b.disabled=busy;
 form.setAttribute('aria-busy',String(busy));
}});
})(globalThis);
