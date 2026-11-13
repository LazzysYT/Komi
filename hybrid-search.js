/* Hybrid search: anime catalog stays on original handlers, community lookup
 * uses only published profile fields via existing authenticated Supabase client.
 * Never reads protected watch progress, notification or wallet tables.
 */
(function(root){
  'use strict';
  let mode='anime';
  let epoch=0;
  let timer=null;
  const input=()=>document.getElementById('searchInput');
  const dd=()=>document.getElementById('searchDropdown');
  function notice(message){
    const el=document.createElement('div');
    el.className='komi-search-notice';
    el.setAttribute('role','status');
    el.textContent=message;
    return el;
  }
  function tabs(){
    const bar=document.createElement('div');
    bar.className='komi-search-mode-tabs';
    bar.setAttribute('role','group');
    bar.setAttribute('aria-label','Режим поиска');
    for(const [value,label] of [['anime','Аниме'],['users','@Пользователи']]){
      const btn=document.createElement('button');
      btn.type='button';
      btn.textContent=label;
      btn.setAttribute('aria-pressed',String(value===mode));
      btn.addEventListener('click',()=>{
        if(mode===value)return;
        mode=value;
        ++epoch;clearTimeout(timer);
        const field=input();
        if(!field)return;
        if (mode==='anime' && field.value.trim().startsWith('@'))
          field.value=field.value.replace(/^\s*@/,'');
        field.setAttribute('aria-label',mode==='anime'?'Поиск аниме':'Поиск пользователей');
        field.focus();
        if(field.value.trim())root.handleInstantSearch?.(field.value);
        else root.showSearchDropdown?.();
      });
      bar.append(btn);
    }
    return bar;
  }
  function decorate(dropdown){
    if(!dropdown)return;
    dropdown.querySelector('.komi-search-mode-tabs')?.remove();
    dropdown.prepend(tabs());
  }
  function buttonForProfile(profile,onProfile){
    const button=document.createElement('button');
    button.type='button';
    button.className='komi-search-user-result';
    const img=document.createElement('img');
    img.alt='';
    img.loading='lazy';
    const avatar=String(profile.avatar_url||'');
    try{
      const u=new URL(avatar);
      img.src=u.protocol==='https:'&&!u.username&&!u.password?u.href:'/anime-artwork.svg';
    }catch{img.src='/anime-artwork.svg'}
    const label=document.createElement('span');
    const name=document.createElement('strong');
    name.textContent=String(profile.display_name||profile.username||'Пользователь').slice(0,60);
    const small=document.createElement('small');
    small.textContent='@'+String(profile.username||'').slice(0,48);
    label.append(name,small);
    button.append(img,label);
    button.addEventListener('click',()=>{
      dd()?.classList.remove('active');
      onProfile(profile.username);
    });
    return button;
  }
  function showUsers({dropdown,query,client,user,onProfile}){
    mode='users';
    const request=++epoch;
    clearTimeout(timer);
    const raw=String(query||'').trim().replace(/^@/,'').slice(0,48);
    dropdown.replaceChildren(tabs());
    dropdown.classList.add('active');
    if(!user?.authUserId){
      dropdown.append(notice('Войди в Komi Anime, чтобы искать профили участников.'));
      return true;
    }
    if(!raw){
      dropdown.append(notice('Введи @никнейм участника сообщества.'));
      return true;
    }
    if(!/^[a-zA-Z0-9_]{2,48}$/.test(raw)){
      dropdown.append(notice('Для поиска введи хотя бы 2 символа никнейма.'));
      return true;
    }
    if(!client){
      dropdown.append(notice('Поиск пользователей временно недоступен.'));
      return true;
    }
    dropdown.append(notice('Ищем пользователей…'));
    timer=setTimeout(async()=>{
      try{
        // Percent/underscore are fixed by the username allowlist above.
        const {data,error}=await client.from('komi_profiles')
          .select('username,display_name,avatar_url')
          .ilike('username','%'+raw+'%').limit(8);
        if(error)throw error;
        if(request!==epoch || mode!=='users' || !dropdown.isConnected)return;
        const matches=(data||[]).filter(x=>x&&typeof x.username==='string');
        dropdown.replaceChildren(tabs(),...(matches.length?
          matches.map(profile=>buttonForProfile(profile,onProfile)):
          [notice('По этому никнейму пользователей не найдено.')]));
      }catch(error){
        if(request!==epoch || mode!=='users' || !dropdown.isConnected)return;
        dropdown.replaceChildren(tabs(),notice('Не удалось загрузить участников. Попробуй снова позже.'));
      }
    },200);
    return true;
  }
  function isUsers(query){return mode==='users' || String(query||'').trim().startsWith('@')}
  root.KomiHybridSearch={decorate,showUsers,isUsers,get mode(){return mode}};
  document.addEventListener('keydown',event=>{
    if((event.ctrlKey||event.metaKey) && !event.altKey &&
       String(event.key).toLowerCase()==='k'){
      const field=input();
      if(!field)return;
      event.preventDefault();
      field.focus();
      field.select();
      root.showSearchDropdown?.();
    }
  });
  // Existing social links are preserved as DOM nodes and simply moved out
  // of the deliberately minimal top bar into the desktop navigation rail.
  const socials=document.querySelector('.komi-header-left .komi-social-links');
  const rail=document.querySelector('.komi-side-nav');
  if(socials&&rail)rail.append(socials);
})(globalThis);
