/* KomiAnime collection: catalog is public; ownership and daily openings are server-authoritative. */
(function(root){
'use strict';
const roster=[["kaneki","Кэн Канэки","Ken Kaneki"],["touka","Тока Кирисима","Touka Kirishima"],["juuzou","Дзюдзо Судзуя","Juuzou Suzuya"],["uta","Ута","Uta"],["tsukiyama","Сю Цукияма","Shuu Tsukiyama"],["hide","Хидэёси Нагатика","Hideyoshi Nagachika"],["rize","Ридзэ Камисиро","Rize Kamishiro"],["arima","Кисё Арима","Kishou Arima"],["eto","Это Ёсимура","Eto Yoshimura"],["ayato","Аято Кирисима","Ayato Kirishima"],["hinami","Хинами Фуэгути","Hinami Fueguchi"],["amon","Котаро Амон","Koutarou Amon"],["nishiki","Нисики Нисио","Nishiki Nishio"],["yomo","Рэндзи Ёмо","Renji Yomo"],["yoshimura","Ёсимура","Kuzen Yoshimura"],["akira","Акира Мадо","Akira Mado"],["furuta","Нимура Фурута","Nimura Furuta"],["takizawa","Сэйдо Такидзава","Seidou Takizawa"]].map(([id,name,query])=>Object.freeze({id,name,query}));
const ids=new Set(roster.map(c=>c.id));
const portraitFallback='<svg class="kc-fallback" viewBox="0 0 100 115" fill="currentColor" aria-hidden="true"><path d="M50 8c16 0 29 13 29 30S66 68 50 68 21 55 21 38 34 8 50 8Zm0 64c25 0 44 18 47 38H3c3-20 22-38 47-38Z"/></svg>';
const lock='<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 4v3"/></svg>';
const caseArt='<svg viewBox="0 0 250 180" fill="none" aria-hidden="true"><path d="m18 61 108-45 106 45-106 47z" fill="#44444d" stroke="#74747e" stroke-width="2"/><path d="M18 61v82l108 30v-65z" fill="#222229" stroke="#55555e" stroke-width="2"/><path d="M232 61v82l-106 30v-65z" fill="#16161b" stroke="#55555e" stroke-width="2"/><path d="m30 76 82 35v47l-82-23z" fill="#18181d"/><path d="m139 115 80-35v53l-80 23z" fill="#27272e"/><path d="m111 34 16-7 83 35-15 7z" fill="#853b46"/><path d="m67 85 17 7v62l-17-5z" fill="#803944"/><path d="m182 85-16 7v63l16-5z" fill="#803944"/><path d="m105 55 20-10 20 10-20 12z" fill="#f4f4f6"/><rect x="111" y="111" width="28" height="24" rx="5" fill="#4c4c55" stroke="#82828d"/><path d="M125 118v9" stroke="#f5f5f5" stroke-width="3" stroke-linecap="round"/></svg>';
const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
function normalizePayload(data){
 if(!data||!Array.isArray(data.owned)||typeof data.can_open!=='boolean')throw new Error('Invalid collection response');
 const owned=[...new Set(data.owned.filter(id=>ids.has(id)))];
 const next=typeof data.next_at==='string'&&Number.isFinite(Date.parse(data.next_at))?data.next_at:null;
 const result=ids.has(data.result)&&owned.includes(data.result)?data.result:null;
 return {owned,canOpen:data.can_open&&owned.length<roster.length,next,result};
}
let state=null,observedOwner,host=null,tab='collection',filter='all',imagePromise=null,imageAttempt=0;
const pictures=new Map();
function active(){return typeof currentView==='string'&&currentView==='collection'&&host?.isConnected;}
function owner(){const id=typeof currentUser==='undefined'?'':currentUser?.authUserId||'';return observedOwner===undefined||observedOwner===id?id:'';}
function fresh(id){return {owner:id,status:id?'idle':'guest',owned:[],canOpen:false,next:null,result:null};}
// A request may finish after navigating away; keep the same account's result,
// but paint() only touches the DOM when collection is the active route.
function current(s){return !!s&&state===s&&owner()===s.owner;}
function authChanged(id){observedOwner=id||'';if(state&&state.owner!==observedOwner){state=fresh(owner());if(active())paint();}}
const aliases={juuzou:['Juzou Suzuya','Juzo Suzuya'],eto:['Eto','Sen Takatsuki'],yoshimura:['Yoshimura','Kuzen'],arima:['Kisho Arima'],tsukiyama:['Shu Tsukiyama'],amon:['Kotaro Amon'],takizawa:['Seido Takizawa'],hide:['Hide Nagachika']};
function normalizedName(n){return String(n||'').normalize('NFKD').toLowerCase().replace(/[^a-z ]/g,' ').trim().split(/\s+/).sort().join(' ');}
function safePortrait(url){try{const u=new URL(url);return u.protocol==='https:'&&(/(^|\.)anilist\.co$/i.test(u.hostname))?u.href:'';}catch{return '';}}
function loadImages(){
 if(imagePromise||Date.now()-imageAttempt<60000||pictures.size===roster.length)return;
 imageAttempt=Date.now();
 const args=roster.map((c,i)=>'$n'+i+':String!').join(',');
 const fields=roster.map((c,i)=>'c'+i+':Character(search:$n'+i+'){name{full alternative} image{large medium}}').join(' ');
 const variables=Object.fromEntries(roster.map((c,i)=>['n'+i,c.query]));
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),9000);
 imagePromise=fetch('https://graphql.anilist.co',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({query:'query('+args+'){'+fields+'}',variables}),signal:ctrl.signal})
 .then(r=>{if(!r.ok)throw new Error('Portrait source unavailable');return r.json();})
 .then(({data})=>{if(!data)return;roster.forEach((c,i)=>{const item=data['c'+i];if(!item)return;const expected=[c.query,...(aliases[c.id]||[])].map(normalizedName);const names=[item.name?.full,...(Array.isArray(item.name?.alternative)?item.name.alternative:[])].map(normalizedName);if(!names.some(n=>n&&expected.includes(n)))return;const url=safePortrait(item.image?.large)||safePortrait(item.image?.medium);if(url)pictures.set(c.id,url);});if(active())paint();})
 .catch(()=>{}).finally(()=>{clearTimeout(timer);imagePromise=null;});
}
function card(c,opened){
 const index=roster.indexOf(c)+1,number=String(index).padStart(2,'0'),image=pictures.get(c.id);
 return '<article class="kc-card'+(opened?'':' kc-locked')+'"><div class="kc-art">'+portraitFallback+(image?'<img src="'+esc(image)+'" alt="" width="240" height="320" loading="lazy" decoding="async" referrerpolicy="no-referrer">':'')+'<span class="kc-number">#'+number+'</span>'+(!opened?'<div class="kc-lock"><span>'+lock+'</span></div>':'')+'</div><div class="kc-card-info"><strong>'+esc(c.name)+'</strong><small>'+(opened?'В коллекции':'Не открыт')+'</small></div></article>';
}
function button(label,action,options={}){
 return '<button type="button" data-kc-action="'+action+'"'+(options.primary?' class="kc-primary"':'')+(options.pressed!==undefined?' aria-pressed="'+options.pressed+'"':'')+(options.disabled?' disabled':'')+'>'+esc(label)+'</button>';
}
function notice(s){
 if(s.status==='guest')return '<div class="kc-notice">Войди, чтобы собирать героев и сохранять коллекцию. '+button('Войти','login',{primary:true})+'</div>';
 if(s.status==='idle'||s.status==='loading')return '<div class="kc-notice" role="status">Загружаем твою коллекцию…</div>';
 if(s.status==='error')return '<div class="kc-notice" role="status">Не удалось получить коллекцию. Проверь соединение и попробуй ещё раз. '+button('Повторить','retry')+'</div>';
 return '';
}
function nextText(s){if(!s.next)return 'Следующий кейс станет доступен после обновления.';return 'Следующий кейс: '+new Date(s.next).toLocaleString('ru-RU',{day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'})+' (местное время).';}
function paint(){
 if(!active()||!state)return;
 const s=state,owned=new Set(s.owned),known=s.status==='ready'||s.status==='opening',count=known?owned.size:0;
 const focus=document.activeElement?.closest?.('.kc-page')?document.activeElement.dataset.kcAction:null;
 const header='<header class="kc-header"><div><div class="kc-kicker">KomiAnime / Коллекции</div><h1>Коллекция и кейсы</h1><p class="kc-muted">Открывай персонажей и собирай любимые аниме.</p></div><div class="kc-count"><strong>'+(known?count+' / '+roster.length:s.status==='guest'?'— / '+roster.length:'…')+'</strong><small>Персонажей собрано</small></div></header>';
 const tabs='<nav class="kc-tabs" aria-label="Коллекция и кейсы">'+button('Моя коллекция','collection',{pressed:tab==='collection'})+button('Кейсы','cases',{pressed:tab==='cases'})+'</nav>';
 let body='';
 if(tab==='collection'){
  const visible=roster.filter(c=>filter==='all'||filter==='owned'&&owned.has(c.id)||filter==='locked'&&!owned.has(c.id));
  body='<div class="kc-series"><div class="kc-series-info"><div class="kc-kicker">Коллекция 01</div><h2>Токийский гуль</h2><p class="kc-muted">'+(known?count+' из '+roster.length+' открыто':roster.length+' персонажей')+'</p><div class="kc-progress" role="progressbar" aria-label="Прогресс коллекции" aria-valuemin="0" aria-valuemax="'+roster.length+'"'+(known?' aria-valuenow="'+count+'"':'')+'><span style="width:'+100*count/roster.length+'%"></span></div></div>'+button('Перейти к кейсам','cases',{primary:true})+'</div><div class="kc-tools"><span class="kc-muted">Все персонажи Tokyo Ghoul</span><div class="kc-filters" aria-label="Фильтр персонажей">'+[['all','Все'],['owned','Открытые'],['locked','Закрытые']].map(([id,title])=>button(title,'filter-'+id,{pressed:filter===id})).join('')+'</div></div>'+(visible.length?'<div class="kc-grid">'+visible.map(c=>card(c,owned.has(c.id))).join('')+'</div>':'<p class="kc-empty">Пока нет персонажей в этой категории.</p>');
 }else{
  const complete=known&&count===roster.length;
  const allowed=s.status==='ready'&&s.canOpen&&!complete;
  let description=complete?'Все персонажи уже собраны!':s.status==='guest'?'Войди, чтобы открыть бесплатный кейс.':s.status==='opening'?'Открываем кейс…':s.status==='ready'&&!allowed?nextText(s):'Один бесплатный кейс за день. Каждый содержит ещё не открытого персонажа.';
  body='<article class="kc-case"><div class="kc-case-visual">'+caseArt+'</div><div class="kc-case-copy"><div class="kc-kicker">Серия 01 · '+roster.length+' персонажей</div><h2>Токийский гуль</h2><p class="kc-muted">Случайный персонаж из коллекции. Без повторов и без списания AniCoin. Шансы всех оставшихся персонажей одинаковы.</p><p class="kc-muted" role="status">'+esc(description)+'</p>'+(s.status==='guest'?button('Войти и открыть','login',{primary:true}):button(complete?'Коллекция собрана':s.status==='opening'?'Открываем…':'Открыть бесплатно','open',{primary:true,disabled:!allowed}))+(s.status==='ready'&&!allowed&&!complete?button('Обновить доступность','retry'):'')+'</div></article>';
  const prize=roster.find(c=>c.id===s.result);
  if(prize&&known)body+='<div class="kc-result" role="status">'+card(prize,true)+'<div class="kc-result-copy"><div class="kc-kicker">Новый персонаж</div><h3>'+esc(prize.name)+'</h3>'+button('В мою коллекцию','collection',{primary:true})+'</div></div>';
 }
 host.innerHTML='<section class="kc-page" aria-label="Коллекция и кейсы">'+header+tabs+notice(s)+body+'</section>';
 host.querySelectorAll('.kc-art img').forEach(img=>{img.addEventListener('error',()=>{img.hidden=true;},{once:true});if(img.complete&&!img.naturalWidth)img.hidden=true;});
 if(focus){const btn=[...host.querySelectorAll('[data-kc-action]')].find(b=>b.dataset.kcAction===focus&&!b.disabled);btn?.focus({preventScroll:true});}
}
async function request(action){
 const s=state;
 if(!active()||!current(s)||!s.owner||s.status==='loading'||s.status==='opening')return;
 if(action==='open'&&(s.status!=='ready'||!s.canOpen))return;
 s.status=action==='open'?'opening':'loading';paint();
 try{
  if(typeof _supabase==='undefined'||!_supabase)throw new Error('Unavailable');
  const {data:sessionData,error:sessionError}=await _supabase.auth.getSession();
  if(!current(s))return;
  if(sessionError||sessionData?.session?.user?.id!==s.owner)throw new Error('Session changed');
  const {data,error}=await _supabase.rpc('komi_collection_action',{p_action:action});
  if(!current(s))return;
  if(error)throw error;
  Object.assign(s,normalizePayload(data),{status:'ready'});paint();
 }catch{if(current(s)){s.status='error';s.canOpen=false;s.owned=[];s.result=null;paint();}}
}
function click(event){if(!active())return;const b=event.target.closest?.('.kc-page [data-kc-action]');if(!b||b.disabled)return;const a=b.dataset.kcAction;if(a==='collection'||a==='cases'){tab=a;paint();}else if(a.startsWith('filter-')){filter=a.slice(7);paint();}else if(a==='login'){if(typeof openAuthModal==='function')openAuthModal('login','Войди, чтобы сохранить коллекцию персонажей.');}else if(a==='retry')void request('read');else if(a==='open')void request('open');}
function render(container){
 if(host!==container){host=container;host.addEventListener('click',click);}
 const id=owner();if(!state||state.owner!==id)state=fresh(id);
 paint();loadImages();if(state.status==='idle')void request('read');
}
root.KomiCollection=Object.freeze({render,authChanged,roster:Object.freeze(roster),normalizePayload});
})(typeof window==='object'?window:{});
