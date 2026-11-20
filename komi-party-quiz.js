/* Watch Party opening quiz: explicit playback, server-side points, no unlicensed audio. */
(function(){
'use strict';
const K=()=>window.KomiCommunity;
let timer=null,lastRoom=null;
function room(){return typeof partyRoom!=='undefined'?partyRoom:null}
function stateAlive(id){return document.getElementById('watchPartyModal')?.classList.contains('active')&&room()?.id===id}
async function command(action,id,args={}){
 const {data,error}=await K().api().rpc('komi_party_quiz',{p_action:action,p_room:id,p_guess:args.guess||null,p_rounds:args.rounds||3});
 if(error)throw error;return data;
}
function mount(){
 const form=document.getElementById('partyChat'),r=room();
 if(!form||!r?.id||form.parentNode?.querySelector('#komiPartyQuiz'))return;
 const box=K().node('section',undefined,'komi-lab-card');box.id='komiPartyQuiz';
 box.append(K().node('h3','Угадай опенинг · Watch Party'));
 const status=K().node('p','Ожидаем лицензированные аудиофрагменты…','komi-lab-status');
 const controls=K().node('div',undefined,'komi-lab-row');
 const audio=document.createElement('audio');audio.controls=true;audio.preload='none';audio.style.cssText='width:100%;max-width:400px';
 const candidates=K().node('div',undefined,'komi-lab-row');
 const search=K().node('input');search.type='search';search.placeholder='Найди название аниме…';search.setAttribute('aria-label','Угадать аниме по опенингу');
 const score=K().node('div');
 box.append(controls,audio,status,search,candidates,score);
 form.before(box);
 const currentId=r.id,host=r.host===K().owner();
 const rounds=K().node('select');
 for(const count of [3,5]){const o=K().node('option',count+' треков');o.value=String(count);rounds.append(o)}
 if(host){
  controls.append(rounds,K().btn('Начать',async()=>{
   try{await command('start',currentId,{rounds:Number(rounds.value)});await render()}
   catch(e){K().notice(status,'Пока нельзя начать: '+e.message)}
  }));
 }
 let latest=null,guessed=false;
 async function render(){
  if(!stateAlive(currentId)){clearTimeout(timer);return}
  try{
   const x=await command('read',currentId);
   if(!stateAlive(currentId))return;
   const newRound=latest?.round!==x.round||latest?.deadline!==x.deadline;
   if(newRound){guessed=false;search.value='';candidates.replaceChildren()}
   latest=x;
   if(!x.round){K().notice(status,'Ведущий может запустить игру, когда будут загружены 3–5 разрешённых аудиотреков.');search.hidden=true;audio.hidden=true}
   else{
    const ended=!x.active||Date.now()>=Date.parse(x.deadline);
    search.hidden=ended;audio.hidden=ended;
    if(!ended&&x.audio_url){
      if(audio.src!==x.audio_url){audio.pause();audio.src=x.audio_url;audio.load()}
      K().notice(status,'Раунд '+x.round+' / '+x.rounds+' · прослушай фрагмент и найди аниме. 40 секунд.');
    }else{
      audio.pause();
      const title=K().catalog().find(a=>Number(a.shikimoriId||a.id)===Number(x.answer_id))?.title;
      K().notice(status,x.active?'Время вышло. Ответ: '+(title||'аниме #'+x.answer_id):'Игра окончена. Итоги ниже.');
    }
    if(host&&!x.active&&x.round>=x.rounds)controls.append(K().node('strong','Игра завершена.'));
    else if(host&&ended&&!controls.querySelector('[data-quiz-next]')){
      const next=K().btn(x.round>=x.rounds?'Завершить игру':'Следующий раунд',async()=>{
       try{await command('next',currentId);next.remove();await render()}
       catch(e){K().notice(status,e.message)}
      });next.dataset.quizNext='1';controls.append(next);
    }
   }
   score.replaceChildren(K().node('strong','Счёт комнаты'));
   for(const player of x.scores||[])score.append(K().node('div',player.name+' — '+player.points));
  }catch(e){K().notice(status,'Игра недоступна: '+e.message)}
  clearTimeout(timer);
  if(stateAlive(currentId))timer=setTimeout(render,5000);
 }
 search.oninput=()=>{
  candidates.replaceChildren();if(guessed||!latest?.active)return;
  const q=search.value.trim().toLowerCase();if(q.length<2)return;
  const items=K().catalog().filter(a=>String(a.title||'').toLowerCase().includes(q)).slice(0,8);
  for(const item of items){
    const id=Number(item.shikimoriId||item.id);if(!Number.isSafeInteger(id))continue;
    candidates.append(K().btn(item.title,async()=>{
     if(guessed)return;guessed=true;
     try{await command('guess',currentId,{guess:id});K().notice(status,'Ответ принят! Ожидаем завершение раунда.');candidates.replaceChildren();await render()}
     catch(e){guessed=false;K().notice(status,e.message)}
    }));
  }
 };
 lastRoom=currentId;void render();
}
const target=document.getElementById('watchPartyModalContent');
if(target)new MutationObserver(mount).observe(target,{childList:true,subtree:true});
mount();
window.KomiPartyQuiz={mount};
})();