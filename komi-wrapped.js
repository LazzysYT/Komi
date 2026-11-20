/* Anime Wrapped: trusted per-account history, never invented view time. */
(function(){
'use strict';
function open(){
 const k=window.KomiCommunity;if(!k.signed())return;
 const root=k.dialog('Anime Wrapped · итоговая карточка');
 const select=k.node('select');
 [['month','Текущий месяц'],['year','Текущий год']].forEach(pair=>{const o=k.node('option',pair[1]);o.value=pair[0];select.append(o)});
 const output=k.node('p',undefined,'komi-lab-status'),run=k.btn('Создать PNG для сторис');
 root.append(select,run,output);
 run.onclick=async()=>{
  run.disabled=true;k.notice(output,'Собираем статистику…');
  const owner=k.owner(),today=new Date();
  const start=select.value==='year'?new Date(Date.UTC(today.getUTCFullYear(),0,1)):new Date(Date.UTC(today.getUTCFullYear(),today.getUTCMonth(),1));
  try{
   const [watched,earned,xp]=await Promise.all([
    k.api().from('komi_watched_episodes').select('anime_id,watched_at').eq('user_id',owner).gte('watched_at',start.toISOString()).limit(5000),
    k.api().from('komi_anicoin_ledger').select('created_at').eq('user_id',owner).eq('reason','watch').gte('created_at',start.toISOString()).limit(5000),
    k.api().rpc('komi_verified_xp')
   ]);
   if(watched.error)throw watched.error;if(earned.error)throw earned.error;if(xp.error)throw xp.error;
   if(owner!==k.owner())throw Error('Аккаунт сменился.');
   const counts=new Map(),genres=new Map();
   const all=k.catalog();
   for(const episode of watched.data||[]){
    counts.set(episode.anime_id,(counts.get(episode.anime_id)||0)+1);
    const title=all.find(a=>Number(a.shikimoriId||a.id)===Number(episode.anime_id));
    for(const genre of Array.isArray(title?.genres)?title.genres:[])genres.set(genre,(genres.get(genre)||0)+1);
   }
   const top=[...counts].sort((a,b)=>b[1]-a[1]).slice(0,3).map(([id])=>all.find(a=>Number(a.shikimoriId||a.id)===Number(id))?.title||'Аниме #'+id);
   const genre=[...genres].sort((a,b)=>b[1]-a[1])[0]?.[0]||'Нет данных';
   const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1920;
   const ctx=canvas.getContext('2d');ctx.fillStyle='#09090B';ctx.fillRect(0,0,1080,1920);
   function line(text,x,y,size=40,bold=false,color='#fff'){
    ctx.fillStyle=color;ctx.font=(bold?'800 ':'400 ')+size+'px Inter,sans-serif';ctx.fillText(String(text),x,y);
   }
   line('KOMIANIME',72,170,75,true);
   line(select.value==='year'?'ИТОГИ ГОДА':'ИТОГИ МЕСЯЦА',72,245,35,false,'#bcbcc2');
   line(((earned.data||[]).length/3).toFixed(1),72,510,150,true);
   line('Подтверждённых часов просмотра',72,575,31,false,'#bcbcc2');
   line((watched.data||[]).length,72,815,150,true);
   line('Отмеченных серий',72,880,31,false,'#bcbcc2');
   line('ЛЮБИМЫЙ ЖАНР',72,1045,40,true);
   line(String(genre).slice(0,38),72,1110,40);
   line('ТОП-3 АНИМЕ',72,1260,40,true);
   top.forEach((name,i)=>line((i+1)+'. '+String(name).slice(0,41),72,1340+i*79,29));
   line('УРОВЕНЬ '+String(xp.data?.level??'—'),72,1680,47,true);
   line('komianime.online',72,1810,35,false,'#aaa');
   canvas.toBlob(blob=>{
    if(!blob){k.notice(output,'Не удалось записать изображение.');return}
    const url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download='KomiAnime-Wrapped-'+select.value+'.png';a.click();
    setTimeout(()=>URL.revokeObjectURL(url),5000);
    k.notice(output,'PNG создан. Часы основаны на подтверждённых 20-минутных начислениях AniCoin.');
   },'image/png');
  }catch(e){k.notice(output,'Не удалось собрать статистику: '+e.message)}
  finally{run.disabled=false}
 };
}
window.KomiWrapped={open};
})();