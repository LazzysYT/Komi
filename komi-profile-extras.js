/* Profile extras are optional and fail closed until the server revision is confirmed. */
(function(root){
'use strict';
const cat=root.KomiExtrasCatalog;
if(!cat)return;
const byId=new Map(cat.products.map(p=>[p.id,p])),medalById=new Map(cat.medals.map(m=>[m.id,m]));
const bgSet=new Set(cat.backgrounds.map(x=>x[0]));
let client=null,getViewer=()=>'',onWallet=()=>{},cache=null,readPending=null,mutation=null,shopOwner='',shopOpen=false,stateEpoch=0;
const friendsCache=new Map(),friendRequests=new Map();
function configure(opts){client=opts.client;getViewer=opts.getViewer;onWallet=opts.onWallet||(()=>{});}
const viewer=()=>String(getViewer()||'');
const active=(node,uid)=>!!node?.isConnected&&viewer()===uid;
const prod=()=>root.location?.hostname==='komianime.online';
function el(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n;}
function button(text,action,cls='kpe-button'){const b=el('button',cls,text);b.type='button';if(action)b.addEventListener('click',action);return b;}
function style(){if(document.getElementById('kpe-style'))return;const link=el('link');link.id='kpe-style';link.rel='stylesheet';link.href='/komi-profile-extras.css?v=20261127-extras-v1';document.head.append(link);}
function normal(raw){
 if(raw?.revision!==cat.revision||!Array.isArray(raw.owned)||!Array.isArray(raw.medals)||!raw.stats||!raw.appearance||!Number.isSafeInteger(Number(raw.balance)))throw Error('Каталог пока не подтверждён сервером.');
 return {revision:cat.revision,balance:Math.max(0,Number(raw.balance)),stats:raw.stats,appearance:raw.appearance,owned:new Set(raw.owned.filter(id=>byId.has(id))),medals:new Set(raw.medals.map(x=>x?.id).filter(id=>medalById.has(id))),newMedal:medalById.has(raw.new_medal)?raw.new_medal:null};
}
async function rpc(action,args={},uid=viewer()){
 if(!client||!uid||viewer()!==uid)throw Error('Войди в аккаунт.');
 const {data,error}=await client.rpc('komi_profile_extras',{p_action:action,p_args:args});
 if(error)throw Error('Сервер не подтвердил действие. Попробуй ещё раз.');
 if(viewer()!==uid)throw Error('Аккаунт изменился.');
 return data;
}
async function read(uid=viewer(),force=false){
 if(cache?.uid!==uid){cache=null;friendsCache.clear();}
 if(!force&&cache&&Date.now()-cache.at<12000)return cache.data;
 if(readPending?.uid===uid)return readPending.promise;
 const entry={uid,promise:null,epoch:stateEpoch};readPending=entry;
 entry.promise=rpc('read',{},uid).then(raw=>{const data=normal(raw);if(viewer()!==uid)throw Error('Аккаунт изменился.');if(entry.epoch!==stateEpoch&&cache?.uid===uid)return cache.data;cache={uid,data,at:Date.now()};return data;}).finally(()=>{if(readPending===entry)readPending=null;});
 return entry.promise;
}
async function change(action,args,uid){
 if(!prod())throw Error('В тестовой версии изменения отключены.');
 if(mutation)throw Error('Другое действие ещё выполняется.');
 if(!uid||viewer()!==uid)throw Error('Аккаунт изменился.');
 const entry={uid};mutation=entry;
 try{
  const raw=await rpc(action,args,uid),data=normal(raw);
  if(viewer()!==uid)throw Error('Аккаунт изменился.');
  stateEpoch++;cache={uid,data,at:Date.now()};friendsCache.clear();
  return data;
 }finally{if(mutation===entry)mutation=null;}
}
function pathUrl(path){
 if(typeof path!=='string'||!/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.jpg$/.test(path))return '';
 try{const u=new URL(client.storage.from('avatars').getPublicUrl(path).data.publicUrl);return u.protocol==='https:'&&!u.username&&!u.password?u.href:'';}catch{return '';}
}
function safeImage(raw){try{const u=new URL(raw,root.location.origin);return u.protocol==='https:'&&!u.username&&!u.password?u.href:'';}catch{return '';}}
function asset(id){return '/assets/profile-medals/'+medalById.get(id).id+'.svg';}
function medalImage(m){const i=el('img','kpe-medal-art');i.src=asset(m.id);i.alt='';i.loading='lazy';i.decoding='async';return i;}
function setCursor(profile,data,uid){
 if(!active(profile,uid)||profile.dataset.profileOwner!=='true'||profile.dataset.profilePreview==='true')return;
 const p=byId.get(data.appearance.cursor_id);
 if(p?.kind==='cursor')profile.dataset.kpeCursor=p.art;else delete profile.dataset.kpeCursor;
}
function cardFace(card,appearance,baseAvatar,name){
 const bg=bgSet.has(appearance.background)?appearance.background:'noir';card.dataset.kpeBg=bg;
 const fx=byId.get(appearance.effect_id);card.dataset.kpeEffect=fx?.kind==='effect'?fx.art:'none';
 const old=card.querySelector('.kpe-custom-bg');if(old)old.remove();
 const backdrop=bg==='custom'?pathUrl(appearance.background_path):'';
 if(backdrop){const i=el('img','kpe-custom-bg');i.src=backdrop;i.alt='';i.loading='lazy';card.prepend(i);}
 const pic=card.querySelector('.kpe-card-avatar');
 if(pic){const url=pathUrl(appearance.avatar_path)||safeImage(baseAvatar)||'/icon.svg';if(url)pic.src=url;else pic.removeAttribute('src');pic.hidden=!url;}
 const label=card.querySelector('.kpe-card-name');if(label&&name)label.textContent=String(name).slice(0,50);
 const medal=card.querySelector('.kpe-card-medal');if(medal){medal.replaceChildren();const m=medalById.get(appearance.medal_id);if(m){medal.append(medalImage(m));medal.title=m.label;}else medal.removeAttribute('title');}
}
function miniCard(appearance,baseAvatar,name){
 const card=el('div','kpe-mini-card');const avatar=el('img','kpe-card-avatar');avatar.alt='';
 const copy=el('span','kpe-card-copy');copy.append(el('strong','kpe-card-name',name||'Твой профиль'),el('small','','Карточка друга'));
 const medal=el('span','kpe-card-medal');card.append(avatar,copy,medal);cardFace(card,appearance,baseAvatar,name);return card;
}
function notifyMedal(m,uid){
 if(viewer()!==uid)return;
 const old=document.getElementById('kpe-award');if(old)old.remove();
 const dialog=el('dialog','kpe-award');dialog.id='kpe-award';dialog.dataset.rarity=m.rarity;dialog.setAttribute('aria-labelledby','kpe-award-title');
 const stage=el('div','kpe-award-stage');for(let j=0;j<16;j++){const spark=el('i','kpe-spark');spark.style.setProperty('--angle',String(j*22.5)+'deg');spark.style.setProperty('--delay',String(j%4*65)+'ms');stage.append(spark);}stage.append(medalImage(m));
 const title=el('h2','','Новая медаль!');title.id='kpe-award-title';
 const close=()=>{if(dialog.open)dialog.close();dialog.remove();};
 dialog.append(el('span','kpe-rarity',cat.rarities[m.rarity]),stage,title,el('strong','kpe-award-name',m.label),el('p','',m.description+' · '+m.target),button('В коллекцию',close));
 dialog.addEventListener('close',()=>dialog.remove(),{once:true});dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
 document.body.append(dialog);try{dialog.showModal();}catch{dialog.setAttribute('open','');}dialog.querySelector('button')?.focus();
}
function medalGallery(node,data,uid,full){
 node.replaceChildren();const heading=el('div','kpe-heading');heading.append(el('h3','','Коллекционные медали'),el('span','kpe-count',data.medals.size+' / '+cat.medals.length));node.append(heading);
 const featured=medalById.get(data.appearance.medal_id);
 if(featured){const pin=el('div','kpe-featured');pin.append(medalImage(featured),el('span','','На витрине: '+featured.label),button('Снять',()=>run('pin',{medal_id:null})));node.append(pin);}
 const notice=el('p','kpe-notice','Медали открываются за сохранённые списки, активность и коллекции. Без списания AniCoin.');
 node.append(notice);
 const grid=el('div','kpe-medal-grid');const controls=el('div','kpe-controls');let filter='all';
 const status=el('p','kpe-status');status.setAttribute('role','status');
 const sort=(a,b)=>b.tier-a.tier||a.id.localeCompare(b.id);
 function eligible(m){return Number(data.stats[m.metric]||0)>=m.target;}
 function draw(){
  grid.replaceChildren();
  let all=cat.medals.filter(m=>filter==='all'||filter==='ready'&&!data.medals.has(m.id)&&eligible(m)||filter==='owned'&&data.medals.has(m.id)||filter===m.rarity).sort(sort);
  if(!full)all=all.sort((a,b)=>Number(eligible(b)&&!data.medals.has(b.id))-Number(eligible(a)&&!data.medals.has(a.id))||Number(data.medals.has(b.id))-Number(data.medals.has(a.id))||sort(a,b)).slice(0,6);
  for(const m of all){
   const owned=data.medals.has(m.id),ready=eligible(m),tile=el('article','kpe-medal-tile'+(!owned&&!ready?' is-locked':''));tile.dataset.rarity=m.rarity;tile.dataset.medalId=m.id;tile.dataset.medalState=owned?'owned':ready?'ready':'locked';
   const val=Math.max(0,Math.min(m.target,Number(data.stats[m.metric])||0));
   const progress=el('progress');progress.max=m.target;progress.value=owned?m.target:val;progress.setAttribute('aria-label',m.label+' '+(owned?m.target:val)+' из '+m.target);
   tile.append(el('span','kpe-rarity',cat.rarities[m.rarity]),medalImage(m),el('strong','',m.label),el('small','',m.description+' · '+(owned?m.target:val)+' / '+m.target),progress);
   if(owned)tile.append(button(data.appearance.medal_id===m.id?'На витрине':'Выставить',()=>run('pin',{medal_id:m.id})));
   else if(ready)tile.append(button('Получить',()=>run('claim',{medal_id:m.id}),'kpe-button kpe-primary'));
   else tile.append(el('span','kpe-locked','Закрыта'));
   grid.append(tile);
  }
  if(!all.length)grid.append(el('p','kpe-notice','Пока нет медалей в этой категории.'));
 }
 async function run(action,args){
  if(!active(node,uid))return;
  for(const b of node.querySelectorAll('button'))b.disabled=true;
  status.textContent='Проверяем награду…';
  try{const next=await change(action,args,uid);if(!active(node,uid))return;medalGallery(node,next,uid,full);if(next.newMedal)notifyMedal(medalById.get(next.newMedal),uid);}
  catch(e){if(active(node,uid)){status.textContent=e.message;for(const b of node.querySelectorAll('button'))b.disabled=false;}}
 }
 if(full){const select=el('select','kpe-select');select.setAttribute('aria-label','Фильтр медалей');for(const [value,label] of [['all','Все медали'],['ready','Можно получить'],['owned','Полученные'],...Object.entries(cat.rarities)]){const o=el('option','',label);o.value=value;select.append(o);}select.addEventListener('change',()=>{filter=select.value;draw();});controls.append(select);}
 controls.append(button('Обновить',async()=>{try{const next=await read(uid,true);if(active(node,uid))medalGallery(node,next,uid,full);}catch(e){if(active(node,uid))status.textContent=e.message;}}));
 if(!full)controls.append(button('Все медали',()=>document.querySelector('[data-profile-tab="achievements"]')?.click()));
 node.append(controls,grid,status);draw();
}
async function compress(file,max){
 if(!file||!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5*1024*1024)throw Error('Выбери JPG, PNG или WebP до 5 МБ.');
 const url=URL.createObjectURL(file);
 try{
  const img=new Image();img.src=url;await img.decode();
  if(!img.naturalWidth||!img.naturalHeight||img.naturalWidth*img.naturalHeight>40000000)throw Error('Слишком большое изображение.');
  const scale=Math.min(1,max/Math.max(img.naturalWidth,img.naturalHeight)),canvas=el('canvas');canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));const ctx=canvas.getContext('2d');ctx.fillStyle='#15151a';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);
  return await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('Не удалось обработать изображение.')),'image/jpeg',.85));
 }finally{URL.revokeObjectURL(url);}
}
async function upload(blob,uid){
 if(viewer()!==uid)throw Error('Аккаунт изменился.');
 const name=uid+'/'+crypto.randomUUID()+'.jpg';
 const {error}=await client.storage.from('avatars').upload(name,blob,{contentType:'image/jpeg',upsert:false,cacheControl:'3600'});
 if(error)throw Error('Не удалось загрузить изображение.');
 if(viewer()!==uid)throw Error('Аккаунт изменился.');
 return name;
}
function editor(node,data,uid,baseAvatar,name,profile){
 node.replaceChildren();const a=data.appearance;
 node.append(el('h4','','Моя мини-карточка'),el('p','kpe-notice','Так тебя увидят друзья. Фон и аватар — бесплатно, эффекты можно купить в магазине. Карточка не меняет основной профиль. Загруженные картинки используют публичные ссылки, как обычная аватарка.'));
 const preview=miniCard(a,baseAvatar,name);node.append(preview);
 const form=el('div','kpe-editor-grid'),check=el('input');check.type='checkbox';check.checked=a.card_enabled===true;const cl=el('label','kpe-check');cl.append(check,document.createTextNode(' Показывать карточку друзьям'));
 const bg=el('select','kpe-select');for(const [id,label] of cat.backgrounds){const o=el('option','',label);o.value=id;bg.append(o);}bg.value=bgSet.has(a.background)?a.background:'noir';
 const bgLabel=el('label','kpe-field');bgLabel.append(el('span','','Фон карточки'),bg);
 const avatarFile=el('input');avatarFile.type='file';avatarFile.accept='image/jpeg,image/png,image/webp';const avatarLabel=el('label','kpe-field');avatarLabel.append(el('span','','Свой аватар · до 5 МБ'),avatarFile);
 const bgFile=el('input');bgFile.type='file';bgFile.accept=avatarFile.accept;const fileLabel=el('label','kpe-field');fileLabel.append(el('span','','Свой фон · до 5 МБ'),bgFile);
 let avatarPath=a.avatar_path||null,backgroundPath=a.background_path||null,avatarBlob=null,backgroundBlob=null,epoch=0;
 const fx=el('select','kpe-select'),opt=el('option','','Без эффекта');opt.value='';fx.append(opt);
 for(const p of cat.products.filter(p=>p.kind==='effect'&&data.owned.has(p.id))){const o=el('option','',p.label);o.value=p.id;fx.append(o);}fx.value=a.effect_id||'';
 const effectLabel=el('label','kpe-field');effectLabel.append(el('span','','Купленный эффект'),fx);
 const cursor=el('select','kpe-select'),def=el('option','','Обычный курсор');def.value='';cursor.append(def);for(const p of cat.products.filter(p=>p.kind==='cursor'&&data.owned.has(p.id))){const o=el('option','',p.label);o.value=p.id;cursor.append(o);}cursor.value=a.cursor_id||'';
 const cursorLabel=el('label','kpe-field');cursorLabel.append(el('span','','Курсор в моём профиле'),cursor);
 const status=el('p','kpe-status');status.setAttribute('role','status');
 let avToken=0,bgToken=0,avPending=false,bgPending=false;
 function previewNow(){
  cardFace(preview,{...a,background:bg.value,avatar_path:avatarPath,background_path:backgroundPath,effect_id:fx.value},baseAvatar,name);
  const mine=++epoch;
  for(const [blob,selector] of [[avatarBlob,'.kpe-card-avatar'],[bg.value==='custom'?backgroundBlob:null,'.kpe-custom-bg']]){
   if(!blob)continue;let i=preview.querySelector(selector);if(!i){i=el('img',selector.slice(1));i.alt='';preview.prepend(i);}const url=URL.createObjectURL(blob);i.hidden=false;i.src=url;const done=()=>URL.revokeObjectURL(url);i.addEventListener('load',done,{once:true});i.addEventListener('error',done,{once:true});setTimeout(done,15000);
  }
  fileLabel.hidden=bg.value!=='custom';void mine;
 }
 async function pick(input,kind){const av=kind==='avatar',token=av?++avToken:++bgToken;if(av)avPending=true;else bgPending=true;try{const f=input.files?.[0];if(!f)return;const blob=await compress(f,av?256:560);if(!active(node,uid)||(av?avToken:bgToken)!==token)return;if(av)avatarBlob=blob;else backgroundBlob=blob;previewNow();status.textContent='Изображение готово к сохранению.';}catch(e){if(active(node,uid))status.textContent=e.message;}finally{if(av&&avToken===token)avPending=false;if(!av&&bgToken===token)bgPending=false;}}
 avatarFile.addEventListener('change',()=>pick(avatarFile,'avatar'));bgFile.addEventListener('change',()=>pick(bgFile,'background'));bg.addEventListener('change',previewNow);fx.addEventListener('change',previewNow);
 const reset=button('Аватар основного профиля',()=>{++avToken;avPending=false;avatarBlob=null;avatarPath=null;avatarFile.value='';previewNow();});
 form.append(cl,bgLabel,fileLabel,avatarLabel,reset,effectLabel,cursorLabel);
 const save=button('Сохранить мини-карточку',async()=>{
  if(!active(node,uid)||avPending||bgPending)return;
  if(!prod()){status.textContent='В тестовой версии сохранение отключено.';return;}
  if(bg.value==='custom'&&!backgroundBlob&&!backgroundPath){status.textContent='Выбери свой фон.';return;}
  save.disabled=true;for(const input of form.querySelectorAll('input,select,button'))input.disabled=true;status.textContent='Сохраняем…';
  try{
   if(avatarBlob){avatarPath=await upload(avatarBlob,uid);avatarBlob=null;}
   if(bg.value==='custom'&&backgroundBlob){backgroundPath=await upload(backgroundBlob,uid);backgroundBlob=null;}
   const next=await change('save_card',{background:bg.value,avatar_path:avatarPath,background_path:bg.value==='custom'?backgroundPath:null,card_enabled:check.checked,effect_id:fx.value||null,cursor_id:cursor.value||null},uid);
   if(active(node,uid)){editor(node,next,uid,baseAvatar,name,profile);setCursor(profile,next,uid);node.querySelector('.kpe-status').textContent='Мини-карточка сохранена.';void decorateFriends(document);}
  }catch(e){if(active(node,uid)){status.textContent=e.message;save.disabled=false;for(const input of form.querySelectorAll('input,select,button'))input.disabled=false;}}
 },'kpe-button kpe-primary');
 const store=el('a','kpe-link','Курсоры и эффекты в магазине');store.href='/shop?profile_extras=1';
 node.append(form,save,store,status);previewNow();
}
async function mountProfile(profile,opts){
 if(!profile||!opts.viewer)return;style();
 const uid=opts.viewer,medals=profile.querySelector('[data-kpe-medals]'),settings=profile.querySelector('[data-kpe-editor]');
 if(opts.isMe&&!opts.preview){
  try{const data=await read(uid);if(!active(profile,uid))return;
   setCursor(profile,data,uid);
   if(medals)medalGallery(medals,data,uid,opts.full);
   if(settings)editor(settings,data,uid,opts.avatar,opts.name,profile);
  }catch{for(const n of [medals,settings])if(n&&active(n,uid)){n.replaceChildren(el('p','kpe-notice','Расширенное оформление пока недоступно.'),button('Повторить',()=>mountProfile(profile,opts)));}}
 }else if(medals&&!opts.preview){
  try{const raw=await rpc('public_medal',{username:opts.username},uid);if(!active(medals,uid))return;const m=medalById.get(raw?.medal_id);if(m){medals.hidden=false;const featured=el('div','kpe-featured');featured.dataset.rarity=m.rarity;featured.append(medalImage(m),el('strong','',m.label),el('span','kpe-rarity',cat.rarities[m.rarity]));medals.replaceChildren(el('h3','','Медаль на витрине'),featured);}else medals.hidden=true;}catch{if(active(medals,uid))medals.hidden=true;}
 }
 void decorateFriends(profile);
}
function friendKey(node){const img=node.querySelector('img[data-komi-friend-avatar]');return img?.getAttribute('data-komi-friend-avatar-id')||img?.getAttribute('data-komi-friend-avatar')||'';}
function cleanCard(node){delete node.dataset.kpeBg;delete node.dataset.kpeEffect;node.classList.remove('kpe-friend-card');for(const n of node.querySelectorAll('.kpe-friend-bg,.kpe-friend-custom-avatar,.kpe-friend-medal'))n.remove();for(const n of node.querySelectorAll('.kpe-base-avatar-hidden'))n.classList.remove('kpe-base-avatar-hidden');}
function paintFriend(node,row){
 cleanCard(node);if(!row)return;
 node.classList.add('kpe-friend-card');node.dataset.kpeBg=bgSet.has(row.background)?row.background:'noir';const fx=byId.get(row.effect_id);node.dataset.kpeEffect=fx?.kind==='effect'?fx.art:'none';
 const bg=row.background==='custom'?pathUrl(row.background_path):'';if(bg){const i=el('img','kpe-friend-bg');i.src=bg;i.alt='';i.loading='lazy';node.prepend(i);}
 const av=pathUrl(row.avatar_path);if(av){
  const base=node.querySelector('img[data-komi-friend-avatar]'),wrap=node.querySelector('.profile-friend-avatar');
  if(base){
   const img=el('img','kpe-friend-custom-avatar');img.alt='';img.hidden=true;
   if(wrap){img.classList.add('kpe-in-avatar');wrap.append(img);}
   else {img.classList.add(...base.classList);base.before(img);}
   img.addEventListener('load',()=>{if(img.isConnected){img.hidden=false;base.classList.add('kpe-base-avatar-hidden');}},{once:true});
   img.addEventListener('error',()=>{img.remove();base.classList.remove('kpe-base-avatar-hidden');},{once:true});
   img.src=av;
  }
 }
 const medal=medalById.get(row.medal_id);if(medal){const box=el('span','kpe-friend-medal');box.title=medal.label;box.append(medalImage(medal));node.append(box);}
}
async function decorateFriends(scope){
 const uid=viewer();if(!scope?.querySelectorAll)return;
 const nodes=[...scope.querySelectorAll('[data-kpe-friend]')].filter(n=>n.isConnected).slice(0,120);
 if(!uid||!client){for(const node of nodes)cleanCard(node);return;}
 if(!nodes.length)return;style();
 const names=[...new Set(nodes.map(friendKey).filter(s=>s&&s.length<=64))];for(const n of nodes)if(!names.includes(friendKey(n)))cleanCard(n);
 if(friendsCache.get('viewer')!==uid){for(const node of nodes)cleanCard(node);friendsCache.clear();friendsCache.set('viewer',uid);}
 const stale=names.filter(n=>!friendsCache.has(n)||Date.now()-friendsCache.get(n).at>15000);
 try{
  for(let offset=0;offset<stale.length;offset+=60){
   const part=stale.slice(offset,offset+60),key=uid+':'+part.join('|');
   let req=friendRequests.get(key);
   if(!req){req=rpc('cards',{handles:part},uid).finally(()=>friendRequests.delete(key));friendRequests.set(key,req);}
   const rows=await req;if(viewer()!==uid)return;
   const found=new Map((Array.isArray(rows)?rows:[]).filter(r=>part.includes(r?.username)).map(r=>[r.username,r]));
   for(const n of part)friendsCache.set(n,{at:Date.now(),row:found.get(n)||null});
  }
  if(viewer()!==uid)return;
  for(const n of nodes)if(active(n,uid)&&names.includes(friendKey(n)))paintFriend(n,friendsCache.get(friendKey(n))?.row);
 }catch{if(viewer()===uid)for(const n of nodes)if(active(n,uid))cleanCard(n);}
}
function confirmBuy(p,data,uid){
 return new Promise(resolve=>{
  if(!prod()||viewer()!==uid||data.balance<p.cost){resolve(false);return;}
  const d=el('dialog','kpe-confirm');d.setAttribute('aria-label','Подтвердить покупку');
  let settled=false;const finish=yes=>{if(settled)return;settled=true;const accepted=yes&&viewer()===uid;if(d.open)d.close();d.remove();resolve(accepted);};
  d.append(el('h3','','Подтвердить покупку'),el('p','',p.label+' · '+p.cost+' AniCoin'),el('p','','Останется '+(data.balance-p.cost)+' AniCoin.'),button('Отмена',()=>finish(false)),button('Купить и надеть',()=>finish(true),'kpe-button kpe-primary'));
  d.addEventListener('cancel',e=>{e.preventDefault();finish(false);});d.addEventListener('close',()=>finish(false),{once:true});
  document.body.append(d);try{d.showModal();d.querySelector('button')?.focus();}catch{d.remove();resolve(false);}
 });
}
function renderShop(details,data,uid,opts){
 const content=details.querySelector('.kpe-shop-content');if(!content)return;content.replaceChildren();
 const verified=!!data,notice=el('p','kpe-notice',verified?'Баланс: '+data.balance+' AniCoin · куплено '+data.owned.size+' / '+cat.products.length:uid?'Серверный каталог ещё не подтверждён. Доступна примерка.':'Войди, чтобы купить предметы.');content.append(notice);
 const status=el('p','kpe-status');status.setAttribute('role','status');let filter='cursor';
 const buttons=el('div','kpe-controls'),grid=el('div','kpe-product-grid');const tabs=[['cursor','Курсоры'],['effect','Эффекты карточек'],['owned','Мои предметы']].map(([kind,label])=>{const b=button(label,()=>{filter=kind;draw();});b.dataset.kpeTab=kind;return b;});buttons.append(...tabs);content.append(buttons,grid,status);
 function draw(){
  grid.replaceChildren();for(const b of tabs)b.setAttribute('aria-pressed',String(b.dataset.kpeTab===filter));
  const selected=cat.products.filter(p=>filter==='owned'?data?.owned.has(p.id):p.kind===filter);
  for(const p of selected){
   const tile=el('article','kpe-product'),owned=data?.owned.has(p.id),equipped=owned&&data.appearance[p.kind==='cursor'?'cursor_id':'effect_id']===p.id;tile.dataset.productId=p.id;
   if(p.kind==='cursor'){const sample=el('div','kpe-cursor-sample');sample.dataset.kpeCursor=p.art;const i=el('img');i.src='/assets/profile-cursors/'+p.art+'.svg';i.alt='';sample.append(i,el('span','','Наведи для примерки'));tile.append(sample);}
   else tile.append(miniCard({background:'night',effect_id:p.id},opts.avatar,opts.name));
   tile.append(el('strong','',p.label),el('small','',owned?'Уже куплено':p.cost+' AniCoin'));
   const b=button(equipped?'Снять':owned?'Надеть':!uid?'Войти, чтобы купить':!verified||!prod()?'Только примерка':'Купить и надеть',async()=>{
    if(!uid){opts.login?.();return;}if(!verified||!prod()||!active(details,uid))return;
    const oldControls=[...content.querySelectorAll('button')].map(btn=>[btn,btn.disabled]);for(const [btn] of oldControls)btn.disabled=true;
    try{
     if(!owned&&!await confirmBuy(p,data,uid))return;
     if(!active(details,uid))return;
     const next=await change(owned?'equip':'buy',{item_id:equipped?null:p.id,kind:p.kind,...(!owned?{expected_cost:p.cost}:{})},uid);
     if(!owned&&viewer()===uid)void Promise.resolve(onWallet(uid,next.balance)).catch(()=>{});
     if(!active(details,uid))return;
     renderShop(details,next,uid,opts);
    }catch(e){if(active(details,uid))status.textContent=e.message;}
    finally{if(active(details,uid))for(const [btn,wasDisabled] of oldControls)if(btn.isConnected)btn.disabled=wasDisabled;}
   },'kpe-button kpe-primary');
   b.disabled=!!uid&&(!verified||!prod()||!owned&&data.balance<p.cost);tile.append(b);grid.append(tile);
  }
  if(!selected.length)grid.append(el('p','kpe-notice','У тебя пока нет купленных курсоров и эффектов.'));
 }
 draw();
}
function mountShop(container,opts){
 const shop=container?.querySelector('#shop');if(!shop)return;
 style();const uid=opts.owner||'';if(shopOwner!==uid){shopOwner=uid;shopOpen=false;}
 const previous=shop.querySelector('[data-kpe-shop]');if(previous)previous.remove();
 const panel=el('details','kpe-shop');panel.dataset.kpeShop='';panel.open=shopOpen||new URL(root.location.href).searchParams.get('profile_extras')==='1';
 const summary=el('summary','','Курсоры и мини-карточки');summary.append(el('span','kpe-count','16 предметов'));
 const content=el('div','kpe-shop-content');panel.append(summary,content);const header=shop.querySelector('.sv3-topbar');if(header)header.after(panel);else shop.prepend(panel);
 let loaded=false;function load(){if(loaded)return;loaded=true;renderShop(panel,null,uid,opts);if(uid)void read(uid).then(data=>{if(active(panel,uid))renderShop(panel,data,uid,opts);}).catch(()=>{if(active(panel,uid)){loaded=false;panel.querySelector('.kpe-shop-content')?.append(button('Повторить загрузку',load));}});}
 panel.addEventListener('toggle',()=>{shopOpen=panel.open;if(panel.open)load();});if(panel.open)load();
}
root.KomiProfileExtras=Object.freeze({configure,mountProfile,mountShop,decorateFriends});
})(window);
