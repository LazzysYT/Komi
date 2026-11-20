'use strict';
// Server-to-server public Shikimori list import; never accepts arbitrary upstream URLs.
module.exports=async function handler(req,res){
 res.setHeader('Cache-Control','private, no-store');
 if(req.method!=='GET'){res.status(405).json({error:'Method not allowed'});return}
 const name=String(req.query?.name||'').trim();
 if(!/^[A-Za-z0-9_.-]{2,60}$/.test(name)){res.status(400).json({error:'Некорректный никнейм Shikimori'});return}
 try{
  async function request(url){
   const response=await fetch(url,{headers:{Accept:'application/json','User-Agent':'KomiAnime/1.0 (public-list-import)'},signal:AbortSignal.timeout(9000)});
   if(!response.ok)throw Error('Shikimori HTTP '+response.status);
   const content=await response.text();
   if(content.length>3*1024*1024)throw Error('Слишком большой список');
   return JSON.parse(content);
  }
  const user=await request('https://shikimori.one/api/users/'+encodeURIComponent(name));
  const id=Number(user?.id);
  if(!Number.isSafeInteger(id)||id<1)throw Error('Пользователь не найден');
  const rows=await request('https://shikimori.one/api/users/'+id+'/anime_rates?limit=5000');
  if(!Array.isArray(rows))throw Error('Не удалось прочитать публичный аниме-список');
  const rates=rows.slice(0,5000).map(row=>({target_id:row.target_id,status:row.status,score:row.score,target_type:'Anime'}));
  res.status(200).json({rates});
 }catch(error){res.status(502).json({error:'Список недоступен или Shikimori ограничил запрос: '+String(error.message).slice(0,100)})}
};