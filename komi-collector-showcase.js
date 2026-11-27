/* Opt-in profile showcase. The server checks both visibility and ownership. */
(function(root){
'use strict';
const limit=3;
const series=()=>root.KomiCollection?.seriesList||{};
function key(card){return card.series_id+':'+card.character_id;}
function element(tag,cls,txt){
 const n=document.createElement(tag);
 if(cls)n.className=cls;
 if(txt!==undefined)n.textContent=txt;
 return n;
}
function normalize(rows){
 if(!Array.isArray(rows))return [];
 const seen=new Set(),out=[];
 for(const row of rows){
  if(!row||!Object.hasOwn(series(),row.series_id))continue;
  const list=series()[row.series_id],ch=list.roster.find(x=>x.id===row.character_id);
  if(!ch||seen.has(key(row)))continue;
  const canonical={series_id:row.series_id,character_id:ch.id};
  seen.add(key(canonical));out.push(canonical);
  if(out.length===limit)break;
 }
 return out;
}
function visual(card){
 const world=series()[card.series_id],ch=world.roster.find(x=>x.id===card.character_id);
 const tile=element('article','kcs-tile kcs-'+ch.rarity);
 const image=element('img');image.alt='';image.loading='lazy';image.decoding='async';image.width=120;image.height=160;
 image.src='/assets/collection/'+(card.series_id==='ghoul'?'ghoul-cel':card.series_id)+'/'+ch.id+'.webp';
 image.addEventListener('error',()=>image.hidden=true,{once:true});
 const title=element('div','kcs-card-text');
 title.append(element('strong','',ch.name),element('small','',world.title));
 tile.append(image,title);
 return tile;
}
function canWrite(v){return v.node.isConnected&&v.isMe&&v.getViewer()===v.viewer&&!!v.viewer;}
function live(v){return v.node.isConnected&&v.getViewer()===v.viewer&&!!v.viewer;}
async function rpc(v,name,args){
 const {data,error}=await v.client.rpc(name,args);
 if(error)throw error;
 return data;
}
function repaint(v){
 if(!live(v))return;
 v.node.replaceChildren();
 if(!v.isMe&&!v.cards.length){v.node.hidden=true;return;}
 v.node.hidden=false;
 const heading=element('div','kcs-head');
 heading.append(element('h3','','Витрина персонажей'));
 if(v.isMe){
  const button=element('button','kcs-button','Настроить');
  button.type='button';button.addEventListener('click',()=>openEditor(v,button));
  heading.append(button);
 }
 v.node.append(heading);
 if(v.cards.length){
  const grid=element('div','kcs-grid');grid.append(...v.cards.map(visual));v.node.append(grid);
 }else v.node.append(element('p','kcs-muted',v.failed?'Не удалось загрузить витрину.':'Пусто. Можно выбрать до трёх выбитых карточек, чтобы показать их в профиле.'));
 const status=element('p','kcs-feedback',v.note||'');status.setAttribute('role','status');v.node.append(status);
}
async function ownCards(v){
 const pages=await Promise.all(Object.keys(series()).map(async id=>{
  const payload=await rpc(v,id==='ghoul'?'komi_collection_action':'komi_collection_series_read',id==='ghoul'?{p_action:'read'}:{p_series_id:id});
  if(!Array.isArray(payload?.owned))throw Error('Invalid collection payload');
  return series()[id].roster.filter(c=>payload.owned.includes(c.id)).map(c=>({series_id:id,character_id:c.id}));
 }));
 return pages.flat();
}
async function openEditor(v,trigger){
 if(!canWrite(v)||v.editor)return;
 const dialog=element('dialog','kcs-editor');
 dialog.setAttribute('aria-label','Настроить витрину персонажей');
 const header=element('div','kcs-head');
 const close=element('button','kcs-button','Закрыть');close.type='button';
 header.append(element('h3','','Витрина персонажей'),close);
 const note=element('p','kcs-muted','Выбери до трёх карточек. Другие пользователи увидят только выбранные и только если им доступен профиль.');
 const body=element('div','kcs-edit-body'),info=element('p','kcs-feedback','Загружаем выбитых персонажей…');info.setAttribute('role','status');
 const save=element('button','kcs-button kcs-save','Сохранить витрину');save.disabled=true;save.type='button';
 dialog.append(header,note,body,info,save);v.node.append(dialog);v.editor=dialog;
 let pending=false;
 const dismiss=(force=false)=>{if(pending&&force!==true)return;dialog.close();dialog.remove();v.editor=null;if(trigger.isConnected)trigger.focus({preventScroll:true});};
 close.addEventListener('click',dismiss);
 dialog.addEventListener('cancel',event=>{event.preventDefault();dismiss();});
 dialog.addEventListener('click',event=>{if(event.target===dialog)dismiss();});
 dialog.showModal();close.focus();
 const valid=()=>canWrite(v)&&v.editor===dialog&&dialog.isConnected;
 let selected,current,owned;
 try{
  [owned,current]=await Promise.all([ownCards(v),rpc(v,'komi_collection_showcase_read',{p_profile_id:v.viewer})]);
  if(!valid())return;
  const keys=new Set(owned.map(key));
  selected=normalize(current).filter(c=>keys.has(key(c)));
 }catch{
  if(valid())info.textContent='Не удалось получить подтверждённую коллекцию. Закрой окно и попробуй ещё раз.';
  return;
 }
 function editPaint(){
  const options=body.querySelectorAll('input[type="checkbox"]');
  for(const box of options){box.checked=selected.some(c=>key(c)===box.value);box.disabled=!box.checked&&selected.length===limit;}
  info.textContent=selected.length+' / '+limit;
  save.textContent=selected.length?'Сохранить и показать':'Скрыть витрину';
  save.disabled=!owned.length&&!normalize(current).length;
 }
 for(const id of Object.keys(series())){
  const group=owned.filter(c=>c.series_id===id);if(!group.length)continue;
  const field=element('fieldset','kcs-fieldset');
  field.append(element('legend','',series()[id].title));
  for(const card of group){
   const label=element('label','kcs-choice');
   const box=element('input');box.type='checkbox';box.value=key(card);
   const ch=series()[id].roster.find(c=>c.id===card.character_id);
   label.append(box,element('span','',ch.name));
   box.addEventListener('change',()=>{
    if(!valid())return;
    if(box.checked&&selected.length<limit&&!selected.some(c=>key(c)===key(card)))selected.push(card);
    else if(!box.checked)selected=selected.filter(c=>key(c)!==key(card));
    editPaint();
   });
   field.append(label);
  }
  body.append(field);
 }
 if(!owned.length)body.append(element('p','kcs-muted','Пока нет выбитых карточек.'));
 editPaint();
 save.addEventListener('click',async()=>{
  if(!valid()||pending||save.disabled)return;
  pending=true;save.disabled=true;close.disabled=true;info.textContent='Сохраняем…';
  for(const box of body.querySelectorAll('input'))box.disabled=true;
  try{
   const {data,error}=await v.client.auth.getSession();
   if(!valid())return;
   if(error||data?.session?.user?.id!==v.viewer)throw Error('Session changed');
   const result=await rpc(v,'komi_collection_showcase_set',{p_cards:selected});
   if(!valid())return;
   if(!Array.isArray(result))throw Error('Unconfirmed save');
   v.cards=normalize(result);v.failed=false;v.note=v.cards.length?'Витрина сохранена.':'Витрина скрыта.';
   dismiss(true);repaint(v);v.node.querySelector('.kcs-button')?.focus({preventScroll:true});
  }catch{
   if(valid()){editPaint();info.textContent='Не удалось подтвердить сохранение. Попробуй ещё раз.';}
  }finally{pending=false;if(valid())close.disabled=false;}
 });
}
async function mount(node,{client,viewer,getViewer,username,isMe}){
 if(!node||!client||!viewer||!Object.keys(series()).length)return;
 const v={node,client,viewer,getViewer,username,isMe,cards:[],failed:false,note:'',editor:null};
 if(isMe){v.node.hidden=false;v.node.textContent='Загружаем витрину…';}
 try{
  const raw=await (isMe
   ?rpc(v,'komi_collection_showcase_read',{p_profile_id:viewer})
   :rpc(v,'komi_collection_showcase_read_handle',{p_username:username}));
  if(!live(v))return;
  v.cards=normalize(raw);
 }catch{if(!live(v))return;v.failed=true;}
 repaint(v);
}
const wallpaperLabels={ghoul:'Ночной Токио',jujutsu:'Архив талисманов',frieren:'Карта пути',alchemist:'Чертёж Аместриса'};
async function mountWallpaper(node,cover,{client,viewer,getViewer,username,isMe}){
 if(!node||!cover||!client||!viewer)return;
 const v={node,client,viewer,getViewer},current=()=>live(v)&&cover.isConnected;
 function paintCover(id){
  if(!Object.hasOwn(wallpaperLabels,id))delete cover.dataset.kcsWallpaper;
  else cover.dataset.kcsWallpaper=id;
 }
 try{
  const data=await rpc(v,isMe?'komi_collection_wallpaper_read':'komi_collection_wallpaper_read_handle',isMe?{}:{p_username:username});
  if(!current())return;
  paintCover(data?.series_id);
  if(node===cover||!isMe||!Array.isArray(data?.unlocked)||!data.unlocked.length)return;
  node.hidden=false;
  const title=element('h3','','Фон за полный альбом'),body=element('div','kcs-wallpaper-field');
  const label=element('label','','Фон профиля'),select=element('select'),save=element('button','kcs-button','Применить');
  save.type='button';select.id='kcs-wallpaper-choice';label.htmlFor=select.id;
  const options=['',...Object.keys(wallpaperLabels).filter(id=>data.unlocked.includes(id))];
  for(const id of options){const o=element('option','',wallpaperLabels[id]||'Обычный фон');o.value=id;select.append(o);}
  select.value=data.series_id||'';
  const status=element('p','kcs-feedback','Доступны фоны за полностью собранные серии.');status.setAttribute('role','status');
  node.replaceChildren(title,label,body,status);body.append(select,save);
  let pending=false;
  save.addEventListener('click',async()=>{
   if(pending||!current()||!options.includes(select.value))return;
   pending=true;save.disabled=true;select.disabled=true;
   try{
    const {data:session,error}=await client.auth.getSession();
    if(!current())return;
    if(error||session?.session?.user?.id!==viewer)throw Error('Session changed');
    const next=await rpc(v,'komi_collection_wallpaper_set',{p_series_id:select.value||null});
    if(!current())return;
    if(!next||!('series_id' in next)||next.series_id!==null&&!Object.hasOwn(wallpaperLabels,next.series_id))throw Error('Unconfirmed background');
    select.value=next.series_id||'';paintCover(next.series_id);status.textContent=next.series_id?'Фон профиля обновлён.':'Обычный фон восстановлен.';
   }catch{if(current())status.textContent='Не удалось подтвердить фон. Попробуй ещё раз.';}
   finally{pending=false;if(current()){save.disabled=false;select.disabled=false;}}
  });
 }catch{/* Fail closed: a profile never inherits an unconfirmed reward. */}
}

root.KomiCollectorShowcase=Object.freeze({mount,normalize,mountWallpaper});
})(typeof window==='object'?window:{});
