/* KomiAnime profile release: safe presentation-only adapter.
 * Imported design ideas from the supplied 2026-11-18 archive; current backend wins.
 * Never writes profile data, grants purchases, or fabricates metrics.
 */
(function (root) {
  'use strict';
  var statusNames=['Смотрю','В планах','Просмотрено','Отложено','Брошено'];
  var gray=['#f0f0f0','#bdbdbd','#909090','#656565','#404040'];
  var escapeText=value=>String(value==null?'':value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  var number=value=>Math.max(0,Number.isFinite(Number(value))?Number(value):0);
  var format=value=>number(value).toLocaleString('ru-RU',{maximumFractionDigits:1});
  var blank=value=>'<p class="profile-empty">'+escapeText(value)+'</p>';
  var header=(name,meta)=>'<div class="profile-widget-heading"><h3>'+escapeText(name)+'</h3>'+(meta||'')+'</div>';
  var safeUrl=value=>{
    try {
      if(typeof value!=='string'||!value.trim())return '';
      var u=new URL(value,location.origin);
      return u.protocol==='https:'||u.origin===location.origin&&u.protocol==='http:'?u.href:'';
    }catch{return ''}
  };
  var appearances=new Map(),metricOverrides=new Map();
  var lastProfile=null,rootObserver=null;
  var prefersLessMotion=()=>Boolean(root.matchMedia&&root.matchMedia('(prefers-reduced-motion: reduce)').matches);
  function navigation(active,friendCount){
    var pages=[['overview','Обзор'],['anime','Мои списки'],['history','История просмотра'],['achievements','Достижения и витрина'],['friends','Друзья ('+friendCount+')'],['comments','Стена']];
    return '<nav class="komi-profile-tabs profile-premium-tabs" aria-label="Разделы профиля">'+pages.map(([id,name])=>
      '<button type="button" class="komi-profile-tab'+(id===active?' active':'')+'" data-profile-tab="'+id+'" aria-pressed="'+(id===active)+'" data-komi-onclick="profilePageSection=\''+id+'\';render()">'+name+'</button>'
    ).join('')+'</nav>';
  }
  function achievementWidget(username,isMe){
    var info=typeof komiAchievements==='function'?komiAchievements(username):{xp:0,badges:[]};
    var badges=Array.isArray(info.badges)?info.badges:[];
    return '<section class="profile-widget profile-achievement-widget">'+header('Витрина достижений','<span class="profile-caption">'+format(info.xp)+' XP</span>')+
      '<div class="profile-achievements">'+Array.from({length:6},(_,i)=>{
        var label=badges[i]?String(badges[i]):'Достижение ещё не получено';
        return '<div class="profile-achievement'+(badges[i]?' is-earned':' is-locked')+'" tabindex="0" data-profile-tilt title="'+escapeText(label)+'"><span aria-hidden="true">'+(badges[i]?'✦':'◇')+'</span><small>'+escapeText(badges[i]?label:'Впереди')+'</small></div>';
      }).join('')+'</div>'+
      (isMe?'<button type="button" class="profile-shop-link" data-komi-onclick="openAniCoinShop()">Оформление в магазине AniCoin</button>':'')+'</section>';
  }
  function watchHistory(ctx){
    if(!ctx.isMe)return [];
    var prefix=ctx.username+'_';
    var store=typeof komiEpisodeProgress==='object'&&komiEpisodeProgress?komiEpisodeProgress:{};
    return Object.entries(store).filter(([key,p])=>key.startsWith(prefix)&&p&&typeof p==='object')
      .map(([key,p])=>({id:key.slice(prefix.length),item:p,anime:ctx.profileAnimeById.get(key.slice(prefix.length))}))
      .filter(x=>/^[0-9]{1,15}$/.test(x.id))
      .sort((a,b)=>number(b.item.updated)-number(a.item.updated));
  }
  function watchCards(ctx,limit){
    return watchHistory(ctx).slice(0,limit).map(({id,item,anime})=>{
      var secs=number(item.time);
      var duration=number(item.duration);
      var ratio=duration?Math.min(1,secs/duration):0;
      var stamp=Math.floor(secs/60)+':'+String(Math.floor(secs%60)).padStart(2,'0');
      var poster=safeUrl(anime&&anime.poster);
      var title=escapeText(anime&&anime.title||'Аниме #'+id);
      var episode=number(item.index)+1;
      var stampLabel=item.updated&&Number.isFinite(Number(item.updated))?' · '+new Date(Number(item.updated)).toLocaleDateString('ru-RU'):'';
      return '<a class="profile-watch-card" href="/anime/'+encodeURIComponent(id)+'#player" data-profile-resume="'+escapeText(id)+'">'+
        '<div class="profile-watch-image">'+(poster?'<img src="'+escapeText(poster)+'" alt="" loading="lazy">':'<span class="profile-watch-fallback" aria-hidden="true">K</span>')+
        '<span class="profile-play" aria-hidden="true">▶</span><span class="profile-time">'+stamp+'</span><span class="profile-progress"><i style="--profile-watch-progress:'+ratio+'"></i></span></div>'+
        '<strong>'+title+'</strong><small>Сезон '+Math.max(1,number(item.season))+' · Серия '+episode+stampLabel+'</small></a>';
    }).join('');
  }
  function content(ctx){
    var fullCounts=statusNames.reduce((total,key)=>total+number(ctx.statsCounts[key]),0);
    var history=watchHistory(ctx);
    var info=typeof komiAchievements==='function'?komiAchievements(ctx.username):{xp:0,badges:[]};
    if(ctx.section==='history')return '<section class="profile-widget profile-history-full">'+header('История просмотра')+
      (ctx.isMe?'<div class="profile-watch-grid">'+(watchCards(ctx,30)||blank('Начни просмотр, чтобы увидеть здесь последний эпизод и таймкод каждого аниме.'))+'</div>'+
       (history.length>30?'<p class="profile-caption">Показаны 30 последних тайтлов.</p>':''):blank('История просмотра доступна только владельцу профиля.'))+'</section>';
    if(ctx.section==='achievements')return achievementWidget(ctx.username,ctx.isMe);
    if(ctx.section!=='overview')return '';
    var favoriteIds=Object.keys(userFavorites[ctx.username]||{});
    var favoriteAnime=favoriteIds.map(id=>ctx.profileAnimeById.get(String(id))).filter(Boolean).slice(0,3);
    var genres=ctx.topGenres.map(([name,count])=>
      '<button class="profile-genre" type="button" data-profile-genre="'+escapeText(name)+'">'+escapeText(name)+' <span>'+Math.round((count/Math.max(1,fullCounts))*100)+'%</span></button>'
    ).join('');
    var legend=statusNames.map((name,i)=>'<button type="button" data-komi-onclick="profileActiveTab=\''+name+'\';profilePageSection=\'anime\';render()">'+
      '<i style="--profile-segment:'+gray[i]+'"></i><span>'+name+'</span><b>'+number(ctx.statsCounts[name])+'</b></button>').join('');
    var distribution=statusNames.map((name,i)=>'<span title="'+name+': '+number(ctx.statsCounts[name])+'" style="flex:'+number(ctx.statsCounts[name])+';--profile-segment:'+gray[i]+'"></span>').join('');
    var ratings='<div class="profile-metrics">'+
      '<div><strong data-profile-count="'+fullCounts+'">'+format(fullCounts)+'</strong><span>Всего тайтлов</span></div>'+
      '<div><strong data-profile-field="episodes">—</strong><span>Серий просмотрено¹</span></div>'+
      '<div><strong data-profile-field="hours">—</strong><span>Часов в аниме¹</span></div>'+
      '<div><strong data-profile-field="meanScore">—</strong><span>Средняя оценка¹</span></div></div>';
    var stats='<section class="profile-widget">'+header('Статистика просмотра','<span class="profile-caption">Аниме-история</span>')+ratings+
      '<div class="profile-distribution" aria-label="Распределение по статусам">'+distribution+(fullCounts?'':'<span class="profile-distribution-empty"></span>')+'</div>'+
      '<div class="profile-legend">'+legend+'</div>'+
      '<p class="profile-data-note">¹ Полная статистика серий, времени и личных оценок пока недоступна.</p></section>';
    var watching='<section class="profile-widget">'+header(ctx.isMe?'Продолжить просмотр':'Мои списки',
      ctx.isMe?'<button type="button" class="profile-text-button" data-komi-onclick="profilePageSection=\'history\';render()">Вся история</button>':'')+
      '<div class="profile-watch-grid">'+(ctx.isMe?watchCards(ctx,2)||blank('Пока нет просмотров. Начни смотреть аниме из каталога.'):blank('Загляни в списки профиля, чтобы увидеть аниме.'))+'</div></section>';
    var favourite='<section class="profile-widget">'+header('Избранное','<span class="profile-caption">'+favoriteIds.length+' тайтлов</span>')+
      '<div class="profile-favorites">'+(favoriteAnime.map(anime=>{
        var poster=safeUrl(anime.poster);
        var id=escapeText(anime.id);
        return '<a href="/anime/'+encodeURIComponent(anime.id)+'" data-profile-anime="'+id+'" title="'+escapeText(anime.title)+'">'+
        (poster?'<img loading="lazy" src="'+escapeText(poster)+'" alt="">':'<div class="profile-favorite-missing">K</div>')+
        '<strong>'+escapeText(anime.title)+'</strong></a>';
      }).join('')||blank(favoriteIds.length?'Карточки избранного ещё загружаются.':'Добавь аниме в избранное, чтобы заполнить витрину.'))+'</div></section>';
    var friends='<section class="profile-widget">'+header('Друзья','<span class="profile-caption">'+ctx.myFriends.length+'</span>')+
      '<div class="profile-friends-mini">'+(ctx.myFriends.slice(0,3).map((name,i)=>{
        var p=userProfiles[name]||{},label=String(p.displayName||name);
        return '<button type="button" data-komi-onclick="openProfile(window.komiProfileFriendNames['+i+'])"><span class="profile-friend-avatar">'+escapeText(label.slice(0,1))+
          '</span><span><strong>'+escapeText(label)+'</strong><small>Открыть профиль</small></span></button>';
      }).join('')||blank('Пока нет друзей. Их можно найти в сообществе.'))+'</div>'+
      (ctx.isMe?'<button type="button" class="profile-shop-link" data-profile-rooms>Комнаты и заявки в друзья</button>':'')+'</section>';
    return '<div class="profile-bento"><div class="profile-bento-main">'+stats+watching+
      '<section class="profile-widget">'+header('Любимые жанры','<span class="profile-caption">По тайтлам в списках</span>')+
      '<div class="profile-genres">'+(genres||blank('Добавь аниме в списки, чтобы появились любимые жанры.'))+'</div></section></div>'+
      '<aside class="profile-bento-side">'+achievementWidget(ctx.username,ctx.isMe)+favourite+friends+'</aside></div>';
  }
  function syncWallet(){
    var profile=document.getElementById('profile');
    if(!profile)return;
    var me=typeof currentUser!=='undefined'?currentUser:null;
    var balance=(me&&me.authUserId&&profile.dataset.profileUser===me.username&&
      typeof aniCoinOwner!=='undefined'&&aniCoinOwner===me.authUserId&&typeof aniCoinWallet!=='undefined')?aniCoinWallet&&aniCoinWallet.balance:null;
    var item=profile.querySelector('[data-profile-balance]');
    if(item)item.textContent=balance==null?'—':format(balance);
  }
  function appearance(username,opts){
    if(!opts||typeof opts!=='object')return;
    appearances.set(username,opts);
    var profile=document.getElementById('profile');
    if(!profile||profile.dataset.profileUser!==username)return;
    var cover=profile.querySelector('[data-profile-cover]');
    if(cover&&Object.hasOwn(opts,'banner')){
      cover.replaceChildren();
      var url=safeUrl(opts.banner);
      if(url){var el=document.createElement(opts.video?'video':'img');el.src=url;if(opts.video){el.muted=true;el.loop=true;el.playsInline=true;el.autoplay=!prefersLessMotion()}else el.alt='';cover.append(el)}
    }
    var frame=profile.querySelector('[data-profile-frame]');
    if(frame)frame.dataset.frame=['red','neon','none','white'].includes(opts.frame)?opts.frame:'none';
    var bio=profile.querySelector('[data-profile-field="bio"]');
    if(bio&&opts.bio!==undefined)bio.textContent=String(opts.bio).slice(0,240);
    var presence=profile.querySelector('[data-profile-presence]');
    if(presence&&opts.status!==undefined)presence.textContent=String(opts.status).slice(0,100);
  }
  function metrics(username,data){
    if(!data||typeof data!=='object')return;
    metricOverrides.set(username,data);
    var profile=document.getElementById('profile');
    if(!profile||profile.dataset.profileUser!==username)return;
    for(var key of ['episodes','hours','meanScore']){
      var element=profile.querySelector('[data-profile-field="'+key+'"]'),value=data[key];
      if(!element)continue;
      if(value==null||!Number.isFinite(Number(value))||Number(value)<0){element.textContent='—';element.removeAttribute('data-profile-count');continue;}
      element.textContent=format(value);
      element.dataset.profileCount=String(value);
    }
  }
  function mount(){
    var profile=document.getElementById('profile');
    if(!profile){lastProfile=null;return}
    if(profile===lastProfile)return;
    lastProfile=profile;
    var title=profile.querySelector('h2');
    if(title)document.title=title.textContent+' · KomiAnime';
    if(appearances.has(profile.dataset.profileUser))appearance(profile.dataset.profileUser,appearances.get(profile.dataset.profileUser));
    if(metricOverrides.has(profile.dataset.profileUser))metrics(profile.dataset.profileUser,metricOverrides.get(profile.dataset.profileUser));
    syncWallet();
    var targets=profile.querySelectorAll('[data-profile-count]');
    if(root.IntersectionObserver&&!prefersLessMotion()){
      var obs=new IntersectionObserver(entries=>{
        for(var entry of entries)if(entry.isIntersecting){
          var el=entry.target;obs.unobserve(el);
          var count=number(el.dataset.profileCount),start=performance.now();
          function tick(now){if(!el.isConnected)return;var t=Math.min(1,(now-start)/600);el.textContent=format(Math.round(count*(1-(1-t)**3)*10)/10);if(t<1)requestAnimationFrame(tick)}
          requestAnimationFrame(tick);
        }
      },{threshold:.1});
      targets.forEach(el=>obs.observe(el));
    }
  }
  document.addEventListener('DOMContentLoaded',()=>{
    var container=document.getElementById('mainContainer')||document.body;
    if(root.MutationObserver){
      rootObserver=new MutationObserver(()=>{if(root.requestAnimationFrame)requestAnimationFrame(mount);else mount()});
      rootObserver.observe(container,{childList:true,subtree:false});
    }
    mount();
  });
  document.addEventListener('click',event=>{
    var button=event.target&&event.target.closest&&event.target.closest('#profile button,#profile a');
    if(!button)return;
    if(button.matches('[data-profile-edit]')){
      var box=document.querySelector('#profile .profile-settings-box');
      if(box){var visible=box.classList.toggle('is-open');button.setAttribute('aria-expanded',String(visible));if(visible)box.querySelector('input')?.focus({preventScroll:true})}
    }
    if(button.matches('[data-profile-share]'))komiCopyProfileLink();
    if(button.matches('[data-profile-rooms]'))openFriendsDrawer();
    if(button.matches('[data-profile-resume]')&&!event.ctrlKey&&!event.metaKey&&!event.shiftKey&&!event.altKey){
      event.preventDefault();resumeKomiAnime(button.dataset.profileResume);
    }
    if(button.matches('[data-profile-anime]')&&!event.ctrlKey&&!event.metaKey&&!event.shiftKey&&!event.altKey){
      event.preventDefault();openWatchModal(button.dataset.profileAnime);
    }
    if(button.matches('[data-profile-genre]')){
      catalogFilterGenre=button.dataset.profileGenre;
      navigate('catalog');
    }
  });
  document.addEventListener('keydown',event=>{
    var button=event.target?.closest?.('[data-profile-tab]');if(!button)return;
    var tabs=Array.from(button.parentElement.querySelectorAll('[data-profile-tab]')),idx=tabs.indexOf(button);
    var next=event.key==='ArrowRight'?tabs[(idx+1)%tabs.length]:event.key==='ArrowLeft'?tabs[(idx+tabs.length-1)%tabs.length]:event.key==='Home'?tabs[0]:event.key==='End'?tabs[tabs.length-1]:null;
    if(next){event.preventDefault();next.focus()}
  });
  document.addEventListener('pointermove',event=>{
    var tile=event.target?.closest?.('[data-profile-tilt]');if(!tile||prefersLessMotion()||event.pointerType!=='mouse')return;
    var rect=tile.getBoundingClientRect(),x=(event.clientX-rect.left)/rect.width-.5,y=(event.clientY-rect.top)/rect.height-.5;
    tile.style.transform='perspective(500px) rotateX('+(-y*7)+'deg) rotateY('+(x*7)+'deg) translateY(-3px)';
  });
  document.addEventListener('pointerout',event=>{
    var tile=event.target?.closest?.('[data-profile-tilt]');if(tile&&!tile.contains(event.relatedTarget))tile.style.transform='';
  });
  root.KomiProfileUI={navigation,content,appearance,metrics,syncWallet};
})(window);
