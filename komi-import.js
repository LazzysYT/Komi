/* User-controlled Shikimori JSON / MyAnimeList XML import with safe, bounded upserts. */
(function(){
'use strict';
const k=()=>window.KomiCommunity;
const map={planned:'В планах',watching:'Смотрю',completed:'Просмотрено',on_hold:'Отложено',dropped:'Брошено',
 '1':'Смотрю','2':'Просмотрено','3':'Отложено','4':'Брошено','6':'В планах',
 'Watching':'Смотрю','Completed':'Просмотрено','On-Hold':'Отложено','Dropped':'Брошено','Plan to Watch':'В планах'};
function parse(data){
 let rows;
 if(typeof data==='string'&&data.trimStart().startsWith('<')){
  const doc=new DOMParser().parseFromString(data,'application/xml');
  if(doc.querySelector('parsererror'))throw Error('Неправильный XML.');
  rows=[...doc.querySelectorAll('myanimelist > anime')].map(item=>({
   target_id:item.querySelector('series_animedb_id')?.textContent,
   status:item.querySelector('my_status')?.textContent,score:item.querySelector('my_score')?.textContent
  }));
 }else{
  const json=typeof data==='string'?JSON.parse(data):data;
  rows=Array.isArray(json)?json:(json?.rates||json?.user_rates||json?.anime_rates||[]);
 }
 if(!Array.isArray(rows))throw Error('Неизвестный формат списка.');
 const seen=new Map();
 for(const r of rows.slice(0,7000)){
  if(r.target_type&&r.target_type!=='Anime')continue;
  const id=Number(r.target_id??r.anime_id??r.series_animedb_id??r.id);
  const status=map[String(r.status??r.my_status??'').trim()];
  if(!Number.isSafeInteger(id)||id<1||!status)continue;
  const score=Number(r.score??r.my_score);
  seen.set(id,{anime_id:id,status,score:Number.isInteger(score)&&score>=1&&score<=10?score:null});
 }
 return [...seen.values()];
}
async function importRows(rows,output,control){
 const U=k();if(!U.signed())return;
 if(!rows.length){U.notice(output,'В файле нет поддерживаемых статусов.');return}
 const owner=U.owner();control.disabled=true;U.notice(output,'Проверяем тайтлы в каталоге…');
 try{
  let added=0,kept=0,missing=0;
  for(let i=0;i<rows.length;i+=100){
   if(owner!==U.owner())throw Error('Аккаунт изменился. Импорт остановлен.');
   const items=rows.slice(i,i+100),ids=items.map(r=>r.anime_id);
   const [found,existing]=await Promise.all([
    U.api().from('anime_catalog').select('shikimori_id').in('shikimori_id',ids),
    U.api().from('komi_anime_lists').select('anime_id').eq('user_id',owner).in('anime_id',ids)
   ]);
   if(found.error)throw found.error;if(existing.error)throw existing.error;
   const available=new Set((found.data||[]).map(x=>Number(x.shikimori_id)));
   const owned=new Set((existing.data||[]).map(x=>Number(x.anime_id)));
   missing+=items.filter(x=>!available.has(x.anime_id)).length;
   kept+=items.filter(x=>available.has(x.anime_id)&&owned.has(x.anime_id)).length;
   const fresh=items.filter(x=>available.has(x.anime_id)&&!owned.has(x.anime_id)).map(x=>({user_id:owner,...x}));
   if(fresh.length){
    const saved=await U.api().from('komi_anime_lists').upsert(fresh,{onConflict:'user_id,anime_id',ignoreDuplicates:true});
    if(saved.error)throw saved.error;added+=fresh.length;
   }
   U.notice(output,'Добавлено '+added+' / существовало '+kept+' / нет в каталоге '+missing+'…');
  }
  U.notice(output,'Готово: добавлено '+added+'; существовало '+kept+'; отсутствует в каталоге '+missing+'.');
  if(added)output.after(U.btn('Обновить профиль',()=>location.reload()));
 }catch(e){U.notice(output,'Ошибка: '+e.message)}finally{control.disabled=false}
}
function open(){
 const U=k(),root=U.dialog('Импорт Shikimori / MyAnimeList');
 root.append(U.node('p','Существующие статусы и оценки KomiAnime сохраняются. Файлы обрабатываются в браузере; публичные списки Shikimori запрашиваются без пароля.','komi-lab-note'));
 const nick=U.node('input');nick.placeholder='Никнейм Shikimori';nick.maxLength=60;root.append(nick);
 const fetchButton=U.btn('Получить список по никнейму'),status=U.node('p',undefined,'komi-lab-status');
 root.append(fetchButton);
 const upload=U.node('input');upload.type='file';upload.accept='.xml,.json,application/xml,application/json';root.append(U.node('label','Или загрузить XML / JSON'),upload);
 const fileButton=U.btn('Импортировать файл');root.append(fileButton,status);
 fetchButton.onclick=async()=>{
  if(!U.signed())return;const name=nick.value.trim();
  if(!/^[A-Za-z0-9_.-]{2,60}$/.test(name)){U.notice(status,'Укажи никнейм латиницей.');return}
  fetchButton.disabled=true;
  try{
   U.notice(status,'Получаем публичный список…');
   const response=await fetch('/api/import-shikimori?name='+encodeURIComponent(name));
   const result=await response.json();
   if(!response.ok)throw Error(result.error||'Shikimori недоступен');
   await importRows(parse(result.rates),status,fetchButton);
  }catch(e){U.notice(status,e.message)}finally{fetchButton.disabled=false}
 };
 fileButton.onclick=async()=>{
  if(!U.signed())return;const f=upload.files?.[0];
  if(!f||f.size>8*1024*1024){U.notice(status,'Выбери XML/JSON до 8 МБ.');return}
  try{await importRows(parse(await f.text()),status,fileButton)}catch(e){U.notice(status,e.message)}
 };
}
window.KomiImport={open,parse};
})();