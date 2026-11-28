/* Optional administrator MFA enrollment. AAL2 enforcement is enabled separately. */
(function(root){
'use strict';
function controller(db,uid,isCurrent){
  const ensure=()=>{if(!uid||!isCurrent())throw Error('Сеанс изменился. Откройте раздел заново.');};
  async function guard(){
    ensure();
    let user;try{user=await db.auth.getUser();}catch{throw Error('Не удалось проверить сеанс.');}
    ensure();
    if(user.error||user.data?.user?.id!==uid)throw Error('Войдите в свой аккаунт повторно.');
    let role;try{role=await db.rpc('komi_is_admin');}catch{throw Error('Не удалось проверить права.');}
    ensure();
    if(role.error||role.data!==true)throw Error('Нет прав администратора.');
  }
  async function result(promise,message){
    let r;
    try{r=await promise;}catch{throw Error(message);}
    ensure();
    if(r.error||!r.data)throw Error(message);
    return r.data;
  }
  async function status(){
    await guard();
    const factors=await result(db.auth.mfa.listFactors(),'Не удалось проверить устройства.');
    const level=await result(db.auth.mfa.getAuthenticatorAssuranceLevel(),'Не удалось проверить уровень входа.');
    return {verified:(factors.totp||[]).filter(f=>f.status==='verified'),currentLevel:level.currentLevel};
  }
  async function enroll(){
    const s=await status();
    if(s.verified.length&&s.currentLevel!=='aal2')throw Error('Сначала подтвердите вход на уже подключённом устройстве.');
    await guard();
    const data=await result(db.auth.mfa.enroll({factorType:'totp'}),'Не удалось добавить устройство.');
    if(!data.id||!data.totp?.secret)throw Error('Не удалось получить ключ настройки.');
    return {id:data.id,secret:data.totp.secret};
  }
  async function verify(id,code){
    if(!id||!/^[0-9]{6}$/.test(code))throw Error('Введите шесть цифр из приложения.');
    await guard();
    await result(db.auth.mfa.challengeAndVerify({factorId:id,code}),'Код не подтверждён. Проверьте время на устройстве и повторите.');
    return status();
  }
  return {status,enroll,verify};
}
async function mount(content,db,back,getUid){
  if(!db?.auth?.mfa){content.textContent='Двухфакторная авторизация недоступна.';return;}
  const uid=getUid(),modal=content.closest('.modal-overlay');
  const panel=document.createElement('section');
  panel.style.cssText='display:grid;gap:12px;padding:4px 0;max-width:680px';
  const el=(tag,text,cls)=>{const node=document.createElement(tag);if(text)node.textContent=text;if(cls)node.className=cls;return node;};
  const button=(label,fn)=>{const node=el('button',label,'btn-secondary');node.type='button';node.addEventListener('click',fn);return node;};
  const heading=el('h2','Безопасность администратора');
  const info=el('p','Настройте одноразовые коды в приложении-аутентификаторе. Обязательная серверная проверка ещё не включена.');
  const notice=el('p','Проверяем вход…');notice.setAttribute('role','status');notice.setAttribute('aria-live','polite');
  const actions=el('div');actions.style.cssText='display:grid;gap:10px';
  const secretBox=el('div');secretBox.style.cssText='display:grid;gap:8px;overflow-wrap:anywhere';
  const close=button('Вернуться на сайт',()=>{dispose();back();});
  panel.append(heading,info,notice,actions,secretBox,close);
  content.replaceChildren(panel);
  let disposed=false,observer=null,subscription=null,busy=false;
  const alive=()=>!disposed&&content.isConnected&&content.contains(panel)&&(!modal||modal.classList.contains('active'))&&getUid()===uid;
  function dispose(message){if(disposed)return;disposed=true;secretBox.replaceChildren();actions.replaceChildren();if(message&&content.contains(panel))notice.textContent=message;observer?.disconnect();subscription?.unsubscribe();}
  if(typeof MutationObserver==='function'){
    observer=new MutationObserver(()=>{if(!alive())dispose();});
    observer.observe(content,{childList:true});
    if(modal)observer.observe(modal,{attributes:true,attributeFilter:['class'],childList:true,subtree:true});
    if(modal?.parentNode)observer.observe(modal.parentNode,{childList:true});
  }
  if(db.auth.onAuthStateChange){
    const sub=db.auth.onAuthStateChange((event,session)=>{
      if(event==='SIGNED_OUT'||(session?.user?.id&&session.user.id!==uid))dispose('Сеанс завершён или аккаунт изменился. Откройте раздел заново.');
    });
    subscription=sub?.data?.subscription;
    if(disposed)subscription?.unsubscribe();
  }
  const service=controller(db,uid,alive);
  function report(message){if(alive())notice.textContent=message;}
  function lock(flag){busy=flag;for(const node of panel.querySelectorAll('button,input,select'))if(node!==close)node.disabled=flag;}
  async function run(fn){if(busy||!alive())return;lock(true);try{await fn();}catch(e){report(e instanceof Error?e.message:'Не удалось завершить проверку.');}finally{if(alive())lock(false);}}
  function challenge(id){
    secretBox.replaceChildren();
    const label=el('label','Код из приложения-аутентификатора');
    const code=el('input',null,'form-control');code.type='text';code.inputMode='numeric';code.autocomplete='one-time-code';code.maxLength=6;code.pattern='[0-9]{6}';label.append(code);
    const form=el('form');const submit=el('button','Подтвердить','btn-glow');submit.type='submit';
    form.append(label,submit);
    form.addEventListener('submit',event=>{
      event.preventDefault();const value=code.value.trim();code.value='';
      void run(async()=>{const state=await service.verify(id,value);if(alive())renderStatus(state);});
    });
    secretBox.append(form);code.focus();
  }
  function renderStatus(s){
    if(!alive())return;
    actions.replaceChildren();secretBox.replaceChildren();
    if(s.currentLevel==='aal2')report('Второй фактор подтверждён в текущем сеансе.');
    else if(s.verified.length)report('Устройство подключено. Подтвердите второй фактор для текущего входа.');
    else report('Подтверждённых устройств пока нет.');
    if(s.verified.length&&s.currentLevel!=='aal2'){
      for(const [i,f] of s.verified.entries())actions.append(button('Подтвердить устройство '+(i+1),()=>{if(!busy&&alive())challenge(f.id);}));
    }else{
      actions.append(button(s.verified.length?'Добавить резервное устройство':'Подключить аутентификатор',()=>void run(async()=>{
        const enrolled=await service.enroll();if(!alive())return;
        actions.replaceChildren();
        const key=el('code',enrolled.secret);key.style.cssText='user-select:all;white-space:normal';
        const help=el('p','Добавьте в приложении новый аккаунт по ключу (тип: TOTP, по времени). Не отправляйте ключ никому. После подтверждения он исчезнет.');
        challenge(enrolled.id);secretBox.prepend(help,key);report('Подтвердите новое устройство.');
      })));
    }
    actions.append(button('Обновить состояние',()=>void run(async()=>renderStatus(await service.status()))));
  }
  await run(async()=>renderStatus(await service.status()));
}
const api={controller,mount};
if(typeof module==='object'&&module.exports)module.exports=api;
else root.KomiAdminMfa=api;
})(globalThis);
