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
  // Supabase profile SELECT policies already filter hidden profiles and require
  // authentication. Never query auth.users or legacy localStorage accounts here.
  const PAGE_SIZE=20;
  const isTechnicalHandle=value=>/^google_[a-f0-9]{32}$/i.test(String(value||''));

  function profileButton(profile,onProfile){
    const button=document.createElement('button');
    button.type='button';
    button.className='komi-search-user-result';
    const img=document.createElement('img');
    img.alt='';
    img.loading='lazy';
    const avatar=String(profile.avatar_url||'');
    try{
      const url=new URL(avatar);
      img.src=url.protocol==='https:'&&!url.username&&!url.password?url.href:'/anime-artwork.svg';
    }catch{img.src='/anime-artwork.svg'}
    const details=document.createElement('span');
    const name=document.createElement('strong');
    const nickname=String(profile.display_name||'').trim();
    const handle=String(profile.username||'');
    name.textContent=(nickname||(!isTechnicalHandle(handle)?handle:'Участник Komi')).slice(0,60);
    const small=document.createElement('small');
    small.textContent=isTechnicalHandle(handle)?'Участник KomiAnime':'@'+handle.slice(0,48);
    details.append(name,small);
    button.append(img,details);
    button.addEventListener('click',()=>{
      dd()?.classList.remove('active');
      onProfile(handle); // The immutable database handle is still the profile route key.
    });
    return button;
  }
  function profileRank(profile,needle){
    const name=String(profile.display_name||'').toLocaleLowerCase();
    const handle=isTechnicalHandle(profile.username)?'':String(profile.username||'').toLocaleLowerCase();
    if(name===needle)return 0;
    if(handle===needle)return 1;
    if(name.startsWith(needle))return 2;
    if(handle.startsWith(needle))return 3;
    return 4;
  }
  function showUsers({dropdown,query,client,user,onProfile,limit=PAGE_SIZE,immediate=false}){
    mode='users';
    const request=++epoch;
    clearTimeout(timer);
    // Searching full display names (including Cyrillic and spaces) is supported.
    const raw=String(query||'').trim().replace(/^@/,'').trim().normalize('NFKC').slice(0,48);
    const pageLimit=Math.max(PAGE_SIZE,Math.min(1000,Math.ceil(limit/PAGE_SIZE)*PAGE_SIZE));
    dropdown.replaceChildren(tabs());
    dropdown.classList.add('active');
    if(!user?.authUserId){
      dropdown.append(notice('Войди в KomiAnime, чтобы искать пользователей.'));
      return true;
    }
    if(raw && [...raw].length<2){
      dropdown.append(notice('Введи минимум 2 символа имени или никнейма.'));
      return true;
    }
    if(!client){
      dropdown.append(notice('Поиск пользователей временно недоступен.'));
      return true;
    }
    dropdown.append(notice(raw?'Ищем пользователей…':'Загружаем участников сообщества…'));
    timer=setTimeout(async()=>{
      try{
        let rows=[],mayHaveMore=false;
        if(!raw){
          // Empty search = browse discoverable users. No unconfirmed users without
          // a saved profile and no accounts hidden by the existing RLS policy.
          const result=await client.from('komi_profiles')
            .select('username,display_name,avatar_url')
            .order('created_at',{ascending:false})
            .limit(pageLimit+1);
          if(result.error)throw result.error;
          rows=result.data||[];
          mayHaveMore=rows.length>pageLimit;
        }else{
          // Two parameterized PostgREST filters avoid interpolating user input
          // into the .or() filter language (commas, quotes and parentheses).
          // Escape LIKE wildcards so a literal underscore searches an underscore.
          const needle=raw.replace(/[\\%_]/g,match=>'\\'+match);
          const pattern='%'+needle+'%';
          const [byName,byHandle]=await Promise.all([
            client.from('komi_profiles').select('username,display_name,avatar_url')
              .ilike('display_name',pattern).order('display_name').limit(pageLimit+1),
            client.from('komi_profiles').select('username,display_name,avatar_url')
              .ilike('username',pattern).order('username').limit(pageLimit+1)
          ]);
          if(byName.error||byHandle.error)throw byName.error||byHandle.error;
          mayHaveMore=(byName.data||[]).length>pageLimit||(byHandle.data||[]).length>pageLimit;
          const matches=new Map();
          for(const profile of byName.data||[])if(profile?.username)matches.set(profile.username,profile);
          for(const profile of byHandle.data||[]){
            if(!profile?.username)continue;
            // A generated Google UUID is not a nickname: "67" must not match
            // random accounts because "67" appears inside their UUID.
            if(isTechnicalHandle(profile.username))continue;
            matches.set(profile.username,profile);
          }
          rows=[...matches.values()].sort((a,b)=>
            profileRank(a,raw.toLocaleLowerCase())-profileRank(b,raw.toLocaleLowerCase())||
            String(a.display_name||a.username).localeCompare(String(b.display_name||b.username),'ru'));
        }
        if(request!==epoch||mode!=='users'||!dropdown.isConnected)return;
        const results=rows.filter(x=>x&&typeof x.username==='string').slice(0,pageLimit);
        const heading=document.createElement('div');
        heading.className='komi-search-results-head';
        heading.textContent=(raw?'Найденные пользователи':'Участники сообщества')+' · показано '+results.length;
        const elements=[tabs(),heading];
        if(results.length)elements.push(...results.map(profile=>profileButton(profile,onProfile)));
        else elements.push(notice(raw?'По этому имени или никнейму ничего не найдено.':'Доступных профилей пока нет.'));
        if(mayHaveMore||rows.length>pageLimit){
          const more=document.createElement('button');
          more.type='button';
          more.className='komi-search-user-more';
          more.textContent='Показать ещё';
          more.addEventListener('click',()=>showUsers({
            dropdown,query,client,user,onProfile,limit:pageLimit+PAGE_SIZE,immediate:true
          }));
          elements.push(more);
        }
        dropdown.replaceChildren(...elements);
      }catch(error){
        if(request!==epoch||mode!=='users'||!dropdown.isConnected)return;
        dropdown.replaceChildren(tabs(),notice('Не удалось загрузить профили. Попробуй ещё раз.'));
        console.warn('Komi profile search:',error?.message||'network error');
      }
    },immediate?0:180);
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
