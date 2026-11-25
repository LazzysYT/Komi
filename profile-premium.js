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
  var lastProfile=null,rootObserver=null,previousTab='overview';
  var prefersLessMotion=()=>Boolean(root.matchMedia&&root.matchMedia('(prefers-reduced-motion: reduce)').matches);
  function guest(){
    return '<section id="profile" class="komi-profile-studio komi-profile-guest" aria-labelledby="komi-profile-guest-title">'+
      '<div class="komi-profile-guest-emblem" aria-hidden="true">K</div><span class="komi-profile-guest-label">ЛИЧНЫЙ ПРОФИЛЬ</span>'+
      '<h1 id="komi-profile-guest-title">Твой уголок в KomiAnime</h1>'+
      '<p>Войди, чтобы открыть свои списки, историю просмотра, друзей и достижения.</p>'+
      '<div class="komi-profile-guest-actions"><button type="button" data-profile-guest-login>Войти в профиль</button>'+
      '<a href="/catalog">Открыть каталог</a></div></section>';
  }
  function navigation(active,friendCount,listCount=0,awardCount=0,canSeeActivity=false){
    var pages=[
      ['overview','Обзор',null],
      ['anime','Списки',listCount],
      ['history','История',null],
      ...(canSeeActivity?[['activity','Активность',null]]:[]),
      ['achievements','Достижения',awardCount],
      ['friends','Друзья',friendCount],
      ['comments','Стена',null]
    ];
    return '<nav class="komi-profile-tabs profile-premium-tabs" aria-label="Разделы профиля" data-profile-active="'+escapeText(active)+'">'+pages.map(([id,name,count])=>
      '<button type="button" class="komi-profile-tab'+(id===active?' active':'')+'" data-profile-tab="'+id+'" aria-pressed="'+(id===active)+'" aria-controls="komiProfilePanel">'+
      '<span>'+name+'</span>'+(count===null?'':'<small class="profile-tab-counter">'+format(count)+'</small>')+'</button>'
    ).join('')+'</nav>';
  }
  function achievementWidget(username,isMe,full=false){
    var info=typeof komiAchievements==='function'?komiAchievements(username):{xp:0,achievements:[],badges:[]};
    // Backward-compatible preview for public profiles with older achievement data.
    var definitions=Array.isArray(info.achievements)?info.achievements:[
      ['first-watch','Просмотр','Первый просмотр',info.watched,1],
      ['watch-ten','Просмотр','10 аниме',info.watched,10],
      ['watch-50','Просмотр','Знаток аниме',info.watched,50],
      ['friend-one','Сообщество','Первый друг',info.friends,1],
      ['watching-five','Просмотр','Марафон',info.watching,5]
    ].map(([id,category,label,value,target])=>({
      id,category,label,value:Math.min(target,number(value)),target,earned:number(value)>=target
    }));
    var earned=definitions.filter(item=>item.earned).length;
    var previewIds=['first-watch','watch-ten','favorite-one','list-five','friend-one','xp-500'];
    var chosen=full?definitions:previewIds.map(id=>definitions.find(item=>item.id===id)).filter(Boolean);
    var renderTiles=items=>'<div class="profile-achievements"'+(isMe?' data-komi-quests':'')+'>'+items.map(item=>{
      var progress=Math.min(number(item.target),number(item.value));
      var unlocked=Boolean(item.earned);
      return '<div class="profile-achievement'+(unlocked?' is-earned':' is-locked')+'" tabindex="0" data-profile-tilt title="'+escapeText(item.label)+': '+progress+'/'+item.target+'">'+
        '<span class="profile-achievement-icon" aria-hidden="true">'+(unlocked?'✦':'◇')+'</span>'+
        '<span class="profile-achievement-progress">'+progress+'/'+item.target+'</span>'+
        '<small>'+escapeText(item.label)+'</small></div>';
    }).join('')+'</div>';
    var tiles=full?['Просмотр','Коллекция','Сообщество','Опыт'].map(category=>{
      var items=chosen.filter(item=>item.category===category);
      return items.length?'<div class="profile-achievement-group"><h4 style="font-size:12px;font-weight:800;color:#E2E2E2;margin:17px 0 9px">'+escapeText(category)+'</h4>'+renderTiles(items)+'</div>':'';
    }).join(''):renderTiles(chosen);
    return '<section class="profile-widget profile-achievement-widget'+(full?' profile-achievements-full':'')+'">'+
      header('Витрина достижений','<span class="profile-caption">'+format(info.xp)+' XP</span>')+
      '<p class="profile-caption" style="margin:0 0 12px">Открыто '+earned+' из '+definitions.length+' достижений</p>'+
      tiles+
      (!definitions.length?'<p class="profile-achievements-empty">Загружаем достижения…</p>':'')+
      (!full?'<button type="button" class="profile-shop-link" data-komi-onclick="profilePageSection=\'achievements\';render()">Все достижения ('+definitions.length+')</button>':'')+
      (isMe?'<button type="button" class="profile-shop-link" data-komi-onclick="openAniCoinShop()">✧ Открыть магазин AniCoin</button>':'')+'</section>';
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
  function posterUrl(value){
    var url=safeUrl(value);
    if(!url)return '';
    if(url.startsWith(location.origin+'/api/poster?'))return url;
    return '/api/poster?src='+encodeURIComponent(url);
  }
  function watchCards(ctx,limit){
    return watchHistory(ctx).slice(0,limit).map(({id,item,anime})=>{
      var secs=number(item.time),duration=number(item.duration);
      var ratio=duration?Math.min(1,secs/duration):0;
      var stamp=Math.floor(secs/60)+':'+String(Math.floor(secs%60)).padStart(2,'0');
      var poster=posterUrl(anime&&anime.poster);
      var title=escapeText(anime&&anime.title||'Аниме #'+id);
      var episode=number(item.index)+1;
      var season=Math.max(1,number(item.season));
      return '<a class="profile-watch-card" href="/anime/'+encodeURIComponent(id)+'#player" data-profile-resume="'+escapeText(id)+'" aria-label="Продолжить '+title+', серия '+episode+'">'+
        '<span class="profile-watch-image">'+(poster?'<img src="'+escapeText(poster)+'" alt="" loading="lazy">':'<span class="profile-watch-fallback" aria-hidden="true">K</span>')+
        '<span class="profile-play" aria-hidden="true">▶</span></span>'+
        '<span class="profile-watch-info"><strong>'+title+'</strong><small>Сезон '+season+' · Серия '+episode+'</small>'+
        '<span class="profile-watch-progress"><i style="--profile-watch-progress:'+ratio+'"></i></span>'+
        '<small class="profile-watch-timestamp">Продолжить с '+stamp+'</small></span>'+
        '<span class="profile-watch-action" aria-hidden="true">↗</span></a>';
    }).join('');
  }
  function friendRows(names) {
    return names.slice(0,3).map((name,i)=>{
      var p=userProfiles[name]||{};
      var label=typeof komiVisibleUsername==='function'
        ? komiVisibleUsername(name,p,false) : String(p.displayName||name);
      var avatar=safeUrl(p.avatar);
      return '<button type="button" data-komi-onclick="openProfile(window.komiProfileFriendNames['+i+'])">'+
        '<span class="profile-friend-avatar" style="position:relative;overflow:hidden">'+escapeText(label.slice(0,1))+
        (avatar?'<img src="'+escapeText(avatar)+'" alt="" loading="lazy" decoding="async" data-komi-onerror="this.remove()" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:inherit">':'')+
        '</span><span><strong>'+escapeText(label)+'</strong><small>Открыть профиль</small></span></button>';
    }).join('');
  }
  function fullFriendRows(names) {
    return names.map((name,i)=>{
      var profile=userProfiles[name]||{};
      var label=typeof komiVisibleUsername==='function'
        ? komiVisibleUsername(name,profile,false) : String(profile.displayName||name);
      var avatar=safeUrl(profile.avatar);
      return '<button type="button" class="komi-profile-friend" style="display:inline-flex;align-items:center;gap:10px;min-width:185px;max-width:100%;text-align:left;margin:4px" data-komi-onclick="openProfile(window.komiProfileFriendNames['+i+'])">'+
        '<span class="profile-friend-avatar" style="position:relative;overflow:hidden">'+escapeText(label.slice(0,1))+
        (avatar?'<img src="'+escapeText(avatar)+'" alt="" loading="lazy" decoding="async" data-komi-onerror="this.remove()" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:inherit">':'')+
        '</span><span style="min-width:0"><strong style="display:block;overflow-wrap:anywhere">'+escapeText(label)+'</strong>'+
        '<small style="display:block;color:#999;font-size:10px">Открыть профиль</small></span></button>';
    }).join('');
  }
  function content(ctx){
    var fullCounts=statusNames.reduce((total,key)=>total+number(ctx.statsCounts[key]),0);
    var history=watchHistory(ctx);
    if(ctx.section==='history')return '<section class="profile-widget profile-history-full profile-enter">'+
      header('История просмотра','<span class="profile-caption">Последние эпизоды</span>')+
      (ctx.isMe?'<div class="profile-watch-grid">'+(watchCards(ctx,30)||blank('Здесь появятся последние серии и сохранённые таймкоды после просмотра.'))+'</div>'+
       (history.length>30?'<p class="profile-caption">Показаны 30 последних тайтлов.</p>':''):blank('История просмотра доступна только владельцу профиля.'))+'</section>';
    if(ctx.section==='achievements')return '<div class="profile-enter">'+achievementWidget(ctx.username,ctx.isMe,true)+'</div>';
    if(ctx.section!=='overview')return '';

    var favoriteIds=Object.keys(userFavorites[ctx.username]||{});
    var premiumShowcase=window.KomiPremium?.isActiveName?.(ctx.username)===true;
    var favoriteAnime=favoriteIds.map(id=>ctx.profileAnimeById.get(String(id))).filter(Boolean).slice(0,premiumShowcase?6:3);
    var statusColors=['#F1F1F1','#D0D0D0','#A8A8A8','#7F7F7F','#535353'];
    var segmentNames=statusNames.map((name,i)=>[name,number(ctx.statsCounts[name]),statusColors[i]]);
    var distribution=segmentNames.map(([name,count,color])=>
      '<button type="button" class="profile-distribution-part" title="'+name+': '+count+'" aria-label="'+name+': '+count+
      '" style="--profile-segment:'+color+';flex:'+count+'" data-komi-onclick="profileActiveTab=\''+name+'\';profilePageSection=\'anime\';render()"></button>'
    ).join('');
    var legend=segmentNames.map(([name,count,color])=>
      '<button type="button" data-komi-onclick="profileActiveTab=\''+name+'\';profilePageSection=\'anime\';render()" title="Показать: '+name+'">'+
      '<i style="--profile-segment:'+color+'"></i><span>'+name+'</span><b>'+count+'</b></button>'
    ).join('');
    var metrics='<div class="profile-metrics">'+
      '<div class="profile-metric"><strong data-profile-count="'+fullCounts+'">'+format(fullCounts)+'</strong><span>Тайтлов в списке</span></div>'+
      '<div class="profile-metric"><strong class="is-missing" data-profile-field="episodes">0</strong><span>Серий посмотрено</span></div>'+
      '<div class="profile-metric"><strong class="is-missing" data-profile-field="hours">0</strong><span>Часов просмотра</span></div>'+
      '<div class="profile-metric"><strong class="is-missing" data-profile-field="meanScore">0</strong><span>Средняя оценка</span></div></div>';
    var stats='<section class="profile-widget profile-stats-widget">'+header('Статистика просмотра','<span class="profile-stats-heading-meta"><span class="profile-caption">'+format(fullCounts)+' тайтлов</span>'+
        '<span class="profile-info-popover"><button type="button" class="profile-info-trigger" aria-label="О показателях просмотра" aria-describedby="profile-stats-help">i</button>'+
        '<span class="profile-info-tooltip" role="tooltip" id="profile-stats-help">Показатели обновятся при наличии проверенных данных просмотра и оценок.</span></span></span>')+
      '<div class="profile-distribution" role="group" aria-label="Распределение статусов аниме">'+
      (fullCounts?distribution:'<span class="profile-distribution-empty"></span>')+'</div>'+
      '<div class="profile-legend">'+legend+'</div>'+metrics+'</section>';
    var watching='<section class="profile-widget profile-continue-widget">'+header(ctx.isMe?'Продолжить просмотр':'Коллекция',
      ctx.isMe?'<button type="button" class="profile-text-button" data-komi-onclick="profilePageSection=\'history\';render()">История ↗</button>':'')+
      '<div class="profile-watch-grid">'+(ctx.isMe?watchCards(ctx,2)||blank('Пока нет записей просмотра. Открой любое аниме из каталога.'):blank('Сохранённые аниме доступны на вкладке «Списки».'))+'</div></section>';
    var favoriteLimit=premiumShowcase?6:3;
    var favoriteTiles=favoriteAnime.map(anime=>{
      var poster=posterUrl(anime.poster),id=escapeText(anime.id);
      return '<a href="/anime/'+encodeURIComponent(anime.id)+'" data-profile-anime="'+id+'" title="'+escapeText(anime.title)+'" aria-label="Открыть '+escapeText(anime.title)+'">'+
        (poster?'<img loading="lazy" src="'+escapeText(poster)+'" alt="">':'<div class="profile-favorite-missing">K</div>')+
        '<strong>'+escapeText(anime.title)+'</strong></a>';
    }).join('');
    var favoriteBlanks=Array.from({length:Math.max(0,favoriteLimit-favoriteAnime.length)},()=>ctx.isMe
      ? '<button type="button" class="profile-favorite-add" data-profile-add-favorite title="Выбрать аниме в каталоге" aria-label="Добавить аниме в избранное"><span aria-hidden="true">+</span></button>'
      : '<div class="profile-favorite-add is-disabled" aria-label="Пустой слот избранного"><span aria-hidden="true">+</span></div>').join('');
    var favourite='<section class="profile-widget profile-favorites-widget"'+(premiumShowcase?' data-premium-slots="6"':'')+'>'+
      header('Топ избранного',(premiumShowcase?'<span class="profile-premium-slots-badge">✦ 6 слотов</span>':'')+
        '<span class="profile-caption">'+favoriteIds.length+' в избранном</span>')+
      '<div class="profile-favorites">'+favoriteTiles+favoriteBlanks+'</div></section>';
    var friends='<section class="profile-widget profile-friends-widget">'+header('Друзья','<span class="profile-caption">'+ctx.myFriends.length+'</span>')+
      '<div class="profile-friends-mini">'+(friendRows(ctx.myFriends)||blank('Список друзей пока пуст.'))+'</div>'+
      (ctx.isMe?'<button type="button" class="profile-shop-link" data-profile-rooms>Комнаты и заявки в друзья ↗</button>':'')+'</section>';
    var genres=ctx.topGenres.map(([name,count])=>
      '<button class="profile-genre" type="button" data-profile-genre="'+escapeText(name)+'">'+escapeText(name)+' <span>'+count+'</span></button>'
    ).join('');
    var favoritesOrGenres='<section class="profile-widget profile-genres-widget">'+header('Любимые жанры')+
      '<div class="profile-genres">'+(genres||blank('Жанры появятся после добавления тайтлов в списки.'))+'</div></section>';
    return '<div class="profile-bento profile-enter">'+
      '<div class="profile-bento-main">'+(ctx.isMe?watching+stats:stats+watching)+favourite+'</div>'+
      '<aside class="profile-bento-side">'+(ctx.canSeeProfileActivity?
        '<section class="profile-widget profile-activity-shortcut">'+header('Активность')+
        '<p>Ежедневная отметка, задания и награды.</p><button type="button" class="profile-shop-link" data-profile-jump="activity">Открыть активность</button></section>':'')+
        achievementWidget(ctx.username,ctx.isMe)+friends+favoritesOrGenres+'</aside>'+
      '</div>';
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
      if(value==null||!Number.isFinite(Number(value))||Number(value)<0){element.textContent='0';element.classList.add('is-missing');element.removeAttribute('data-profile-count');continue;}
      element.classList.remove('is-missing');
      element.textContent=format(value);
      element.dataset.profileCount=String(value);
    }
  }
  function refreshFriends(names) {
    var profile=document.getElementById('profile');
    if(!profile||!Array.isArray(names)||typeof currentUser==='undefined'||
       profile.dataset.profileUser!==currentUser?.username)return;
    root.komiProfileFriendNames=names.slice();
    var widget=profile.querySelector('.profile-friends-widget');
    if(widget){
      var caption=widget.querySelector('.profile-caption');
      if(caption)caption.textContent=String(names.length);
      var list=widget.querySelector('.profile-friends-mini');
      if(list)list.innerHTML=friendRows(names)||blank('Список друзей пока пуст.');
    }
    var fullList=profile.querySelector('.komi-profile-friend-list');
    if(fullList)fullList.innerHTML=fullFriendRows(names)||'<p>Пока нет друзей.</p>';
    var fullHeading=profile.querySelector('.komi-profile-friends-section > h3');
    if(fullHeading)fullHeading.textContent='Друзья ('+names.length+')';
    var badge=profile.querySelector('[data-profile-friends-count]');
    if(badge)badge.textContent='◉ Друзей: '+names.length;
    var tabCount=profile.querySelector('[data-profile-tab="friends"] .profile-tab-counter');
    if(tabCount)tabCount.textContent=format(names.length);
  }
  function mount(){
    var profile=document.getElementById('profile');
    if(!profile){lastProfile=null;return}
    if(profile===lastProfile)return;
    lastProfile=profile;
    var title=profile.querySelector('h1,h2');
    if(title)document.title=title.textContent+' · KomiAnime';
    if(appearances.has(profile.dataset.profileUser))appearance(profile.dataset.profileUser,appearances.get(profile.dataset.profileUser));
    if(metricOverrides.has(profile.dataset.profileUser))metrics(profile.dataset.profileUser,metricOverrides.get(profile.dataset.profileUser));
    syncWallet();
    var nav=profile.querySelector('.profile-premium-tabs');
    if(nav&&root.requestAnimationFrame){
      var current=nav.querySelector('.komi-profile-tab.active');
      var from=nav.querySelector('[data-profile-tab="'+previousTab+'"]')||current;
      if(current){
        nav.style.setProperty('--profile-pill-left',from.offsetLeft+'px');
        nav.style.setProperty('--profile-pill-width',from.offsetWidth+'px');
        nav.classList.add('profile-tabs-ready');
        if(from!==current){
          root.requestAnimationFrame(()=>root.requestAnimationFrame(()=>{
            if(!nav.isConnected)return;
            nav.style.setProperty('--profile-pill-left',current.offsetLeft+'px');
            nav.style.setProperty('--profile-pill-width',current.offsetWidth+'px');
          }));
        }else{
          nav.style.setProperty('--profile-pill-left',current.offsetLeft+'px');
          nav.style.setProperty('--profile-pill-width',current.offsetWidth+'px');
        }
        previousTab=current.dataset.profileTab;
      }
    }
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
    if(button.matches('[data-profile-guest-login]')){openAuthModal('login');return;}
    const nextSection=button.dataset.profileTab||button.dataset.profileJump;
    if(nextSection){
      const tabs=[...button.closest('#profile').querySelectorAll('[data-profile-tab]')];
      if(nextSection===profilePageSection||!tabs.some(tab=>tab.dataset.profileTab===nextSection))return;
      profilePageSection=nextSection;
      render();
      [...document.querySelectorAll('#profile [data-profile-tab]')].find(tab=>tab.dataset.profileTab===nextSection)?.focus();
      return;
    }
    if(button.matches('[data-profile-edit], [data-profile-settings]')){
      var box=document.querySelector('#profile .profile-settings-box');
      if(box){var visible=box.classList.toggle('is-open');button.closest('#profile').querySelectorAll('[data-profile-edit], [data-profile-settings]').forEach(control=>control.setAttribute('aria-expanded',String(visible)));if(visible)box.querySelector('#newDisplayName')?.focus()}
    }
    if(button.matches('[data-profile-share]')){
      Promise.resolve(komiCopyProfileLink()).then(ok=>{
        if(!ok||!button.isConnected)return;
        button.classList.add('is-copied');
        button.setAttribute('aria-label','Ссылка скопирована');
        window.setTimeout(()=>{if(button.isConnected){button.classList.remove('is-copied');button.setAttribute('aria-label','Поделиться ссылкой');}},1700);
      });
    }
    if(button.matches('[data-profile-party]')){
      window.komiWatchTogetherProfileTarget=button.dataset.profileParty;
      if(typeof openWatchPartyHub==='function')openWatchPartyHub();
    }
    if(button.matches('[data-profile-rooms]'))openFriendsDrawer();
    if(button.matches('[data-profile-add-favorite]'))navigate('catalog');
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
  root.KomiProfileUI={guest,navigation,content,appearance,metrics,syncWallet,refreshFriends};
  root.KomiProfileUI.fullFriendRows=fullFriendRows;
})(window);
