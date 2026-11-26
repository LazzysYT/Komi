/* KomiAnime collection: catalog is public; ownership and daily openings are server-authoritative. */
(function(root){
'use strict';
const roster=[["kaneki","Кэн Канэки","Ken Kaneki"],["touka","Тока Кирисима","Touka Kirishima"],["juuzou","Дзюдзо Судзуя","Juuzou Suzuya"],["uta","Ута","Uta"],["tsukiyama","Сю Цукияма","Shuu Tsukiyama"],["hide","Хидэёси Нагатика","Hideyoshi Nagachika"],["rize","Ридзэ Камисиро","Rize Kamishiro"],["arima","Кисё Арима","Kishou Arima"],["eto","Это Ёсимура","Eto Yoshimura"],["ayato","Аято Кирисима","Ayato Kirishima"],["hinami","Хинами Фуэгути","Hinami Fueguchi"],["amon","Котаро Амон","Koutarou Amon"],["nishiki","Нисики Нисио","Nishiki Nishio"],["yomo","Рэндзи Ёмо","Renji Yomo"],["yoshimura","Ёсимура","Kuzen Yoshimura"],["akira","Акира Мадо","Akira Mado"],["furuta","Нимура Фурута","Nimura Furuta"],["takizawa","Сэйдо Такидзава","Seidou Takizawa"]].map(([id,name,query])=>Object.freeze({id,name,query}));
const ids=new Set(roster.map(c=>c.id));
const CASE_PRICE=50;
const purchaseIds=new Map();
function pendingKey(owner){return 'komi:collection:purchase:'+owner;}
function pending(owner){try{return purchaseIds.get(owner)||sessionStorage.getItem(pendingKey(owner))||null;}catch{return purchaseIds.get(owner)||null;}}
function remember(owner,id){if(id)purchaseIds.set(owner,id);else purchaseIds.delete(owner);try{if(id)sessionStorage.setItem(pendingKey(owner),id);else sessionStorage.removeItem(pendingKey(owner));}catch{}}
const portraitFallback=c=>root.KomiCollectionArt?.silhouette(c.id)||'';
const lock='<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 4v3"/></svg>';
const caseArt='<img class="kc-case-image" src="/assets/collection/tokyo-ghoul-case.webp" width="500" height="189" alt="Чёрный кейс Токийский гуль: маска, цепи и красное кагуне" decoding="async">';
const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
function normalizePayload(data){
 if(!data||!Array.isArray(data.owned)||typeof data.can_open!=='boolean')throw new Error('Invalid collection response');
 const owned=[...new Set(data.owned.filter(id=>ids.has(id)))];
 const next=typeof data.next_at==='string'&&Number.isFinite(Date.parse(data.next_at))?data.next_at:null;
 const result=ids.has(data.result)&&owned.includes(data.result)?data.result:null;
 const balance=Number.isSafeInteger(data.balance)&&data.balance>=0?data.balance:null;
 return {owned,canOpen:data.can_open&&owned.length<roster.length,next,result,balance,price:data.price===CASE_PRICE?CASE_PRICE:null,purchaseStatus:['ok','insufficient','complete'].includes(data.purchase_status)?data.purchase_status:null};
}
let state=null,observedOwner,host=null,tab='collection',filter='all',imagePromise=null,imageAttempt=0;
const pictures=new Map();
function active(){return typeof currentView==='string'&&currentView==='collection'&&host?.isConnected;}
function owner(){const id=typeof currentUser==='undefined'?'':currentUser?.authUserId||'';return observedOwner===undefined||observedOwner===id?id:'';}
function fresh(id){return {owner:id,status:id?'idle':'guest',owned:[],canOpen:false,next:null,result:null,balance:null,price:null,confirmBuy:false,purchaseStatus:null};}
// A request may finish after navigating away; keep the same account's result,
// but paint() only touches the DOM when collection is the active route.
function current(s){return !!s&&state===s&&owner()===s.owner;}
function authChanged(id){observedOwner=id||'';if(state&&state.owner!==observedOwner){state=fresh(owner());if(active())paint();}}
const aliases={juuzou:['Juzou Suzuya','Juzo Suzuya'],eto:['Eto','Sen Takatsuki'],yoshimura:['Yoshimura','Kuzen'],arima:['Kisho Arima'],tsukiyama:['Shu Tsukiyama'],amon:['Kotaro Amon'],takizawa:['Seido Takizawa'],hide:['Hide Nagachika']};
function normalizedName(n){return String(n||'').normalize('NFKD').toLowerCase().replace(/[^a-z ]/g,' ').trim().split(/\s+/).sort().join(' ');}
function safePortrait(url){try{const u=new URL(url);return u.protocol==='https:'&&(/(^|\.)anilist\.co$/i.test(u.hostname))?u.href:'';}catch{return '';}}
function loadImages(){
 if(!state?.owned.length||imagePromise||Date.now()-imageAttempt<60000||pictures.size===roster.length)return;
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
 const index=roster.indexOf(c)+1,number=String(index).padStart(2,'0'),image=opened?pictures.get(c.id):null;
 return '<article class="kc-card'+(opened?'':' kc-locked')+'"><div class="kc-art">'+portraitFallback(c)+(image?'<img src="'+esc(image)+'" alt="" width="240" height="320" loading="lazy" decoding="async" referrerpolicy="no-referrer">':'')+'<span class="kc-number">#'+number+'</span>'+(!opened?'<div class="kc-lock"><span>'+lock+'</span></div>':'')+'</div><div class="kc-card-info"><strong>'+(opened?esc(c.name):'Неизвестный персонаж')+'</strong><small>'+(opened?'В коллекции':'Не открыт')+'</small></div></article>';
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
 const complete=known&&count===roster.length;
 const allowed=s.status==='ready'&&s.canOpen&&!complete;
 const retryPurchase=!!s.owner&&!!pending(s.owner);
 const canBuy=s.status==='ready'&&s.price===CASE_PRICE&&(retryPurchase||!complete&&s.balance>=CASE_PRICE);
 const description=complete?'Все персонажи уже собраны!':s.status==='guest'?'Войди, чтобы открыть бесплатный кейс.':s.status==='opening'?'Открываем кейс…':s.status==='ready'&&!allowed?nextText(s):'Один бесплатный кейс в день. Без дубликатов.';
 const action=s.status==='guest'?button('Войти и открыть','login',{primary:true}):button(complete?'Коллекция собрана':s.status==='opening'?'Открываем…':'Открыть бесплатно','open',{primary:true,disabled:!allowed||retryPurchase});
 const balanceText=known&&s.balance!==null?'Баланс: '+s.balance.toLocaleString('ru-RU')+' AniCoin':'Цена: 50 AniCoin';
 const purchase=s.status==='guest'?button('Купить за 50 AniCoin','login'):s.confirmBuy&&canBuy?'<div class="kc-buy-confirm">'+button(retryPurchase?'Повторить запрос':'Подтвердить · 50 AniCoin','buy',{primary:true})+button('Отмена','cancel-buy')+'</div>':button(retryPurchase?'Повторить покупку':'Купить за 50 AniCoin','confirm-buy',{disabled:!canBuy});
 const purchaseNotice=s.purchaseStatus==='insufficient'||known&&!complete&&!retryPurchase&&s.balance!==null&&s.balance<CASE_PRICE?'Недостаточно AniCoin для покупки.':s.purchaseStatus==='complete'?'Коллекция уже собрана, монеты не списаны.':retryPurchase?'Предыдущая покупка не подтверждена. Повтор запроса не спишет монеты дважды.':'';
 const feature='<article class="kc-case"'+(s.status==='opening'?' aria-busy="true"':'')+'><div class="kc-case-visual">'+caseArt+'</div><div class="kc-case-copy"><div class="kc-kicker">Tokyo Ghoul · Коллекция 01</div><h2>Кейс «Токийский гуль»</h2><p class="kc-muted">Собери всех героев. Каждый кейс содержит одного нового персонажа с равными шансами. Бесплатный — раз в день, дополнительный — 50 AniCoin.</p><p class="kc-muted kc-case-status" role="status">'+esc(description)+'</p>'+'<div class="kc-case-actions">'+action+purchase+'</div><p class="kc-muted kc-wallet">'+esc(balanceText)+'</p>'+(purchaseNotice?'<p class="kc-muted" role="status">'+esc(purchaseNotice)+'</p>':'')+(s.status==='ready'&&!complete?button('Обновить доступность','retry'):'')+'</div></article>';
 const prize=roster.find(c=>c.id===s.result);
 const reward=prize&&known?'<div class="kc-result" role="status">'+card(prize,true)+'<div class="kc-result-copy"><div class="kc-kicker">Новый персонаж</div><h3>'+esc(prize.name)+'</h3>'+button('В мою коллекцию','collection',{primary:true})+'</div></div>':'';
 if(tab==='collection'){
  const visible=roster.filter(c=>filter==='all'||filter==='owned'&&owned.has(c.id)||filter==='locked'&&!owned.has(c.id));
  body=feature+reward+'<div class="kc-series"><div class="kc-series-info"><div class="kc-kicker">Коллекция 01</div><h2>Токийский гуль</h2><p class="kc-muted">'+(known?count+' из '+roster.length+' открыто':roster.length+' персонажей')+'</p><div class="kc-progress" role="progressbar" aria-label="Прогресс коллекции" aria-valuemin="0" aria-valuemax="'+roster.length+'"'+(known?' aria-valuenow="'+count+'"':'')+'><span style="width:'+100*count/roster.length+'%"></span></div></div>'+button('Перейти к кейсам','cases',{primary:true})+'</div><div class="kc-tools"><span class="kc-muted">Все персонажи Tokyo Ghoul</span><div class="kc-filters" aria-label="Фильтр персонажей">'+[['all','Все'],['owned','Открытые'],['locked','Закрытые']].map(([id,title])=>button(title,'filter-'+id,{pressed:filter===id})).join('')+'</div></div>'+(visible.length?'<div class="kc-grid">'+visible.map(c=>card(c,owned.has(c.id))).join('')+'</div>':'<p class="kc-empty">Пока нет персонажей в этой категории.</p>');
 }else{
  body=feature+reward+'<div class="kc-case-details"><h2>Что внутри?</h2><p class="kc-muted">18 персонажей. Бесплатный кейс раз в день или дополнительный за 50 AniCoin. Без повторов.</p><div class="kc-grid">'+roster.map(c=>card(c,owned.has(c.id))).join('')+'</div></div>';
 }
 host.innerHTML='<section class="kc-page" aria-label="Коллекция и кейсы">'+header+tabs+notice(s)+body+'</section>';
 host.querySelectorAll('.kc-art img,.kc-case-image').forEach(img=>{img.addEventListener('error',()=>{img.hidden=true;},{once:true});if(img.complete&&!img.naturalWidth)img.hidden=true;});
 if(focus){const btn=[...host.querySelectorAll('[data-kc-action]')].find(b=>b.dataset.kcAction===focus&&!b.disabled);btn?.focus({preventScroll:true});}
}
async function request(action){
 const s=state;
 if(!active()||!current(s)||!s.owner||s.status==='loading'||s.status==='opening')return;
 if(action==='open'&&(s.status!=='ready'||!s.canOpen||pending(s.owner)))return;
 if(action==='buy'&&(s.status!=='ready'||s.price!==CASE_PRICE||!s.confirmBuy||(!pending(s.owner)&&(s.balance<CASE_PRICE||s.owned.length===roster.length))))return;
 let purchaseId=null;
 if(action==='buy'){try{purchaseId=pending(s.owner)||root.crypto.randomUUID();remember(s.owner,purchaseId);}catch{return;}}
 s.confirmBuy=false;s.status=action==='read'?'loading':'opening';paint();
 try{
  if(typeof _supabase==='undefined'||!_supabase)throw new Error('Unavailable');
  const {data:sessionData,error:sessionError}=await _supabase.auth.getSession();
  if(!current(s))return;
  if(sessionError||sessionData?.session?.user?.id!==s.owner)throw new Error('Session changed');
  const {data,error}=action==='buy'?await _supabase.rpc('komi_collection_buy',{p_request_id:purchaseId}):await _supabase.rpc('komi_collection_action',{p_action:action});
  if(!current(s))return;
  if(error)throw error;
  const payload=normalizePayload(data);
  if(action==='buy'){if(!payload.purchaseStatus)throw Error('Unconfirmed purchase');remember(s.owner,null);}
  Object.assign(s,payload,{status:'ready'});paint();try{loadImages();}catch{/* Art failure never changes confirmed ownership. */}
  if(action==='buy'&&payload.purchaseStatus==='ok'&&typeof aniCoinRequest==='function')void Promise.resolve().then(()=>aniCoinRequest('read',{},s.owner)).catch(()=>{});
 }catch{if(current(s)){s.status='error';s.canOpen=false;s.owned=[];s.result=null;paint();}}
}
function click(event){if(!active())return;const b=event.target.closest?.('.kc-page [data-kc-action]');if(!b||b.disabled)return;const a=b.dataset.kcAction;if(a==='collection'||a==='cases'){tab=a;paint();}else if(a.startsWith('filter-')){filter=a.slice(7);paint();}else if(a==='login'){if(typeof openAuthModal==='function')openAuthModal('login','Войди, чтобы сохранить коллекцию персонажей.');}else if(a==='retry')void request('read');else if(a==='open')void request('open');else if(a==='confirm-buy'){state.confirmBuy=true;paint();}else if(a==='cancel-buy'){state.confirmBuy=false;paint();}else if(a==='buy')void request('buy');}
function render(container){
 if(host!==container){host=container;host.addEventListener('click',click);}
 const id=owner();if(!state||state.owner!==id)state=fresh(id);
 paint();try{loadImages();}catch{}if(state.status==='idle')void request('read');
}
root.KomiCollection=Object.freeze({render,authChanged,roster:Object.freeze(roster),normalizePayload});
})(typeof window==='object'?window:{});
