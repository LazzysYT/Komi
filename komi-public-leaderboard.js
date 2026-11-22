/* Opt-in public leaderboard. Reads only an aggregate RPC, never other users' private tables. */
(function(root){
  'use strict';
  const metrics=new Set(['hours','episodes','level']);
  const api=()=>typeof _supabase!=='undefined'?_supabase:null;
  const user=()=>typeof currentUser!=='undefined'&&currentUser?.authUserId?currentUser.authUserId:null;
  const element=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=String(text);return n};
  function validAvatar(value){
    if(typeof value!=='string'||!value||value.length>1500)return '';
    try{
      const parsed=new URL(value,location.origin);
      return (parsed.protocol==='https:'||(parsed.origin===location.origin&&parsed.protocol==='http:'))?parsed.href:'';
    }catch{return ''}
  }
  function format(value,metric){
    if(metric==='hours')return (Number(value.hours)||0).toLocaleString('ru-RU',{maximumFractionDigits:1})+' ч';
    if(metric==='episodes')return (Number(value.episodes)||0).toLocaleString('ru-RU')+' сер.';
    return 'Lv. '+(Number(value.level)||1);
  }
  function notice(list,text){
    const p=element('p','komi-leaderboard-status',text);
    list.replaceChildren(p);
  }
  function cards(list,rows,metric){
    list.replaceChildren();
    if(!rows.length){notice(list,'Здесь пока нет участников. Включи участие, чтобы появиться в первом рейтинге Komi.');return;}
    rows.forEach((data,index)=>{
      if(!data||!/^[A-Za-z0-9_]{3,48}$/.test(String(data.username||'')))return;
      const link=element('a','komi-leaderboard-person');
      link.href='/?profile='+encodeURIComponent(data.username)+'#profile';
      link.setAttribute('aria-label','Профиль '+data.username);
      link.append(element('span','komi-leaderboard-index',String(index+1).padStart(2,'0')));
      const avatar=element('img','komi-leaderboard-avatar');
      avatar.src=validAvatar(data.avatar_url)||'/anime-artwork.svg';
      avatar.alt='';avatar.loading='lazy';avatar.referrerPolicy='no-referrer';
      avatar.addEventListener('error',()=>{avatar.onerror=null;avatar.src='/anime-artwork.svg'},{once:true});
      link.append(avatar);
      const info=element('span','komi-leaderboard-person-data');
      info.append(element('strong','',data.display_name||data.username),element('small','', '@'+data.username));
      link.append(info,element('span','komi-leaderboard-value',format(data,metric)));
      list.append(link);
    });
  }
  function mount(panel){
    if(!panel||!panel.isConnected||panel.dataset.komiRankMounted)return;
    panel.dataset.komiRankMounted='1';
    const client=api(),rankList=panel.querySelector('#komiLeaderboardDetails');
    const consentBtn=panel.querySelector('[data-komi-rank-consent]');
    const tabs=[...panel.querySelectorAll('[data-komi-rank]')];
    if(!client||!rankList||!consentBtn)return;
    let metric='hours',consent=false,consentBusy=false,request=0;
    let currentOwner=user();
    const load=async()=>{
      const token=++request;
      notice(rankList,'Загружаем рейтинг…');
      const {data,error}=await client.rpc('komi_public_leaderboard',{p_metric:metric});
      if(token!==request||!panel.isConnected)return;
      if(error){notice(rankList,'Сейчас не удалось загрузить рейтинг. Попробуй открыть раздел ещё раз.');return}
      cards(rankList,Array.isArray(data)?data:[],metric);
    };
    const readConsent=async()=>{
      currentOwner=user();
      if(!currentOwner){
        consentBtn.hidden=false;consentBtn.textContent='Войти для участия';consentBtn.disabled=false;
        return;
      }
      const owner=currentOwner;
      const {data,error}=await client.from('komi_leaderboard_optin').select('user_id').eq('user_id',owner).maybeSingle();
      if(!panel.isConnected||owner!==user())return;
      consent=!error&&!!data;
      consentBtn.hidden=false;consentBtn.disabled=false;
      consentBtn.textContent=error?'Повторить проверку':consent?'Не участвовать':'Участвовать';
      consentBtn.title=consent?'Убрать свои агрегированные показатели из публичного рейтинга':'Показать только свои агрегированные показатели в публичном рейтинге';
    };
    panel.addEventListener('click',e=>{
      const tab=e.target.closest('[data-komi-rank]');
      if(!tab||!panel.contains(tab)||!metrics.has(tab.dataset.komiRank))return;
      metric=tab.dataset.komiRank;
      tabs.forEach(item=>item.setAttribute('aria-pressed',String(item===tab)));
      void load();
    });
    consentBtn.addEventListener('click',async()=>{
      if(consentBusy)return;
      const owner=user();
      if(!owner){if(typeof openAuthModal==='function')openAuthModal('login');return;}
      if(owner!==currentOwner){await readConsent();return;}
      consentBusy=true;consentBtn.disabled=true;consentBtn.textContent='Сохраняем…';
      const {error}=consent
        ? await client.from('komi_leaderboard_optin').delete().eq('user_id',owner)
        : await client.from('komi_leaderboard_optin').insert({user_id:owner});
      consentBusy=false;
      if(!panel.isConnected)return;
      if(error){consentBtn.disabled=false;consentBtn.textContent='Повторить';notice(rankList,'Не удалось изменить участие. Попробуй ещё раз.');return;}
      consent=!consent;consentBtn.disabled=false;
      consentBtn.textContent=consent?'Не участвовать':'Участвовать';
      void load();
    });
    void load();void readConsent();
  }
  root.KomiPublicLeaderboard={mount};
})(globalThis);
