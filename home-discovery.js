/* Komi Home Discovery.
 * Presentation only: receives existing catalog, progress and handlers.
 * No new client-side database reads or writes.
 */
(function (root) {
  'use strict';
  const escape = value => String(value == null ? '' : value).replace(/[&<>"']/g, ch => (
    {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]
  ));
  function rating(anime) {
    const score = Number(anime && anime.shikiRating);
    return Number.isFinite(score) && score > 0 ? score.toFixed(1) : '—';
  }
  function score(anime) { return Number(anime && anime.shikiRating) || 0; }
  function count(anime) {
    return Math.max(0, Number(anime && anime.episodeCount) ||
      (Array.isArray(anime && anime.episodes) ? anime.episodes.length : 0));
  }
  function updated(anime) {
    const time = Date.parse(anime && anime.lastEpisodeAddedAt);
    return Number.isFinite(time) ? time : 0;
  }
  function id(anime) {
    const value = String(anime && anime.id || '');
    return /^[1-9][0-9]{0,14}$/.test(value) ? value : '';
  }
  function collectionAction(kind) {
    return 'data-komi-onclick="openKomiCollection(\'' + kind + '\')"';
  }
  function shelf(title, subtitle, list, kind, renderCard, classname) {
    if (!list.length) return '';
    return '<section class="komi-home-shelf komi-feature-section ' + (classname || '') + '">' +
      '<div class="komi-home-heading"><div><h2>' + escape(title) + '</h2>' +
      '<p class="komi-home-subtitle">' + escape(subtitle) + '</p></div>' +
      '<button type="button" class="komi-home-all" ' + collectionAction(kind) +
      '>Смотреть все <span aria-hidden="true">↗</span></button></div>' +
      '<div class="komi-home-rail">' + list.map(renderCard).join('') + '</div></section>';
  }
  const genreOptions = [
    {name:'Экшен',subtitle:'Драки и погони',symbol:'↗',choices:['Экшен']},
    {name:'Романтика',subtitle:'Про любовь',symbol:'♡',choices:['Романтика']},
    {name:'Фэнтези',subtitle:'Магия и миры',symbol:'✧',choices:['Фэнтези']},
    {name:'Комедия',subtitle:'Посмеяться',symbol:'☺',choices:['Комедия']},
    {name:'Исэкай',subtitle:'Попал в другой мир',symbol:'◇',choices:['Исэкай','Исекай']},
    {name:'Детектив',subtitle:'Распутать дело',symbol:'⌕',choices:['Детектив']},
    {name:'Повседневность',subtitle:'Уютно и спокойно',symbol:'☼',choices:['Повседневность']}
  ];
  function genreShelf(animeList) {
    const genres = new Set();
    for (const anime of animeList) for (const genre of Array.isArray(anime.genres) ? anime.genres : [])
      genres.add(String(genre));
    return '<section class="komi-home-genres komi-feature-section" aria-label="Выбор жанра">' +
      '<div class="komi-home-heading"><div><h2>Жанры <span class="komi-home-kicker">/ настроение</span></h2>' +
      '<p class="komi-home-subtitle">Выбери настроение на вечер</p></div></div>' +
      '<div class="komi-home-genre-rail">' + genreOptions.map(option => {
        const genre = option.choices.find(name => genres.has(name));
        return '<button type="button" class="komi-home-genre-card"' +
          (genre ? ' data-komi-genre="' + escape(genre) + '"' :
            ' disabled title="Тайтлов в этой категории пока нет"') +
          '><span class="komi-home-genre-symbol" aria-hidden="true">' + option.symbol + '</span>' +
          '<span class="komi-home-genre-name">' + escape(option.name) + '</span>' +
          '<span class="komi-home-genre-caption">' + escape(option.subtitle) + '</span></button>';
      }).join('') + '</div></section>';
  }
  function hero(slides, context) {
    if (!slides.length) return '';
    const index = ((Number(context.currentSlideIndex) || 0) % slides.length + slides.length) % slides.length;
    return '<section class="komi-home-hero" aria-label="Рекомендуем посмотреть">' +
      '<div class="hero-slider-container" id="heroSlider">' +
      '<button type="button" class="hero-slider-arrow hero-arrow-prev" aria-label="Предыдущий тайтл" data-komi-onclick="changeSlide(-1)">❮</button>' +
      '<button type="button" class="hero-slider-arrow hero-arrow-next" aria-label="Следующий тайтл" data-komi-onclick="changeSlide(1)">❯</button>' +
      '<div class="hero-slides-wrapper">' + slides.map((anime,i) => {
        const animeId = id(anime);
        const genres = (Array.isArray(anime.genres) ? anime.genres : []).slice(0,3);
        const year = context.year(anime);
        const description = context.describe(anime.desc);
        const canAdd = Boolean(context.currentUser && context.currentUser.authUserId);
        const listAction = canAdd ?
          'setAnimeStatus(\'' + animeId + '\', \'В планах\')' : 'openAuthModal(\'login\')';
        return '<article class="hero-slide' + (i===index ? ' active' : '') + '"' +
          ' style="background-image:url(&quot;' + context.artwork(anime) + '&quot;)"' +
          ' aria-label="' + escape(anime.title) + '">' +
          '<div class="komi-home-hero-content">' +
          '<div class="komi-home-hero-eyebrow"><span class="komi-home-live-dot"></span> ВЫБОР KOMI ANIME</div>' +
          '<div class="hero-meta"><span>★ ' + escape(rating(anime)) + ' Shikimori</span>' +
          (year ? '<span>' + escape(year) + '</span>' : '') +
          genres.map(g => '<span>' + escape(g) + '</span>').join('') + '</div>' +
          '<h1>' + escape(anime.title) + '</h1>' +
          '<p>' + (description || 'Описание тайтла пока не добавлено.') + '</p>' +
          '<div class="hero-buttons"><button type="button" class="btn-glow" data-komi-onclick="openWatchModal(\''+animeId+'\')">▷ Смотреть аниме</button>' +
          '<button type="button" class="btn-glow-secondary" data-komi-onclick="' + listAction +
          '">+ В список</button></div></div></article>';
      }).join('') + '</div>' +
      '<div class="hero-dots">' + slides.map((_,i) =>
        '<button type="button" class="hero-dot' + (i===index?' active':'') +
        '" aria-label="Показать тайтл ' + (i+1) + '" data-komi-onclick="setSlide('+i+')"></button>'
      ).join('') + '</div></div></section>';
  }
  function continueShelf(context) {
    if (!context.currentUser || !context.currentUser.authUserId) return '';
    const prefix = context.currentUser.username + '_';
    const lookup = new Map(context.animeList.map(anime => [String(anime.id),anime]));
    const recent = Object.entries(context.progress || {})
      .filter(([key,p])=>key.startsWith(prefix) && p && Number.isFinite(Number(p.updated)))
      .sort((a,b)=>Number(b[1].updated)-Number(a[1].updated)).slice(0,16)
      .map(([key,p])=>({anime:lookup.get(key.slice(prefix.length)),p})).filter(x=>x.anime).slice(0,8);
    if (!recent.length) return '';
    return '<section class="komi-home-shelf komi-home-continue komi-feature-section">' +
      '<div class="komi-home-heading"><div><h2>Продолжить просмотр</h2>' +
      '<p class="komi-home-subtitle">Возвращайся к сериалам с того же эпизода</p></div></div>' +
      '<div class="komi-home-progress-rail">' + recent.map(({anime,p})=>{
        const animeId=id(anime);
        const position=Number(p.time),duration=Number(p.duration);
        const hasProgress=Number.isFinite(position)&&Number.isFinite(duration)&&duration>0;
        const percent=hasProgress?Math.min(100,Math.max(0,position/duration*100)):0;
        const episode=Number(p.index)+1;
        const season=Number(p.season)||1;
        const image=context.artwork(anime);
        return '<button type="button" class="komi-home-progress-card" data-komi-onclick="resumeKomiAnime(\''+animeId+'\')">' +
          '<span class="komi-home-progress-art"><img src="'+image+'" loading="lazy" decoding="async" alt="">' +
          '<span class="komi-home-progress-track"><span style="width:'+percent.toFixed(2)+'%"></span></span></span>' +
          '<span class="komi-home-progress-details"><strong>'+escape(anime.title)+'</strong>' +
          '<small>Сезон '+season+' · Серия '+episode+'</small></span></button>';
      }).join('')+'</div></section>';
  }
  function leaderboard() {
    // No public opt-in aggregate source currently exists. Never expose other
    // users' owner-only watch progress or wallet rows to manufacture rankings.
    return '<section class="komi-home-leaderboard komi-feature-section" id="komiLeaderboard">' +
      '<div class="komi-home-heading"><div><h2>Топ зрителей Komi</h2>' +
      '<p class="komi-home-subtitle">Сообщество и достижения зрителей</p></div>' +
      '<a class="komi-home-all" href="#komiLeaderboardDetails">Весь рейтинг ↗</a></div>' +
      '<div class="komi-home-community-panel">' +
      '<div class="komi-home-leaderboard-tabs" role="group" aria-label="Показатель рейтинга">' +
      '<button type="button" data-komi-rank="episodes" aria-pressed="true">По сериям</button>' +
      '<button type="button" data-komi-rank="hours" aria-pressed="false">По часам</button>' +
      '<button type="button" data-komi-rank="coins" aria-pressed="false">По AniCoin</button>' +
      '</div><div id="komiLeaderboardDetails" class="komi-home-community-empty" role="status" aria-live="polite">' +
      '<span class="komi-home-community-mark" aria-hidden="true">◇</span>' +
      '<div><strong>Публичный рейтинг пока не доступен</strong>' +
      '<p>Показатели просмотра и балансы пользователей защищены. Здесь появятся только разрешённые к публикации результаты.</p></div>' +
      '</div></div></section>';
  }
  function render(context) {
    const animeList = Array.isArray(context.animeList) ? context.animeList.filter(Boolean) : [];
    if (!animeList.length) return '<section class="komi-home-empty">Аниме в каталоге пока нет.</section>';
    const ranked = [...animeList].filter(a => score(a)>0).sort((a,b)=>score(b)-score(a));
    const slider = [...animeList].filter(a => a.poster && /^https:\/\//i.test(a.poster))
      .sort((a,b)=>Number(context.year(b))-Number(context.year(a))||score(b)-score(a)).slice(0,5);
    const latestYear = String(new Date().getFullYear());
    const recent = [...animeList].filter(a=>updated(a)>0)
      .sort((a,b)=>updated(b)-updated(a)).slice(0,12);
    const season = [...animeList].filter(a=>context.year(a)===latestYear)
      .sort((a,b)=>updated(b)-updated(a)||score(b)-score(a)).slice(0,12);
    const short = [...animeList].filter(a=>context.type(a)==='Сериал' &&
      count(a)>0 && count(a)<=13).sort((a,b)=>score(b)-score(a)).slice(0,12);
    const popular = [...animeList].filter(a=>score(a)>0)
      .sort((a,b)=>((updated(b)>Date.now()-30*86400000?2:0)+score(b)/10)-
                    ((updated(a)>Date.now()-30*86400000?2:0)+score(a)/10)).slice(0,12);
    const recommended = context.recommendations();
    const films = animeList.filter(a=>context.type(a)==='Фильм')
      .sort((a,b)=>score(b)-score(a)).slice(0,10);
    return '<div class="komi-home-discovery">' +
      hero(slider,context) +
      continueShelf({...context,animeList}) +
      genreShelf(animeList) +
      shelf('Популярное прямо сейчас','Высокие оценки Shikimori и недавно обновлённые серии',popular,'all',context.renderCard,'komi-home-popular') +
      shelf('Новинки сезона','Релизы '+latestYear+' года из каталога',season,'all',context.renderCard,'komi-home-season') +
      shelf('На один вечер','Сериалы продолжительностью до 13 серий',short,'short',context.renderCard,'komi-home-evening') +
      shelf('Топ по рейтингу','Самые высоко оценённые тайтлы Shikimori',ranked.slice(0,12),'best',context.renderCard,'komi-home-top') +
      (recent.length ? shelf('Свежие серии','Последние добавления и обновления каталога',recent,'recent',context.renderCard,'komi-home-updated') : '') +
      leaderboard() +
      (recommended.length?shelf('Тебе понравится','Подборка на основе твоих списков и интересов',recommended,'all',context.renderCard,'komi-home-personal'):'') +
      context.calendar() +
      (films.length?shelf('Лучшие фильмы','Истории, которые помещаются в один сеанс',films,'movies',context.renderCard,'komi-home-films'):'') +
      context.years() +
      '<div class="komi-home-browse-footer">'+context.intro()+'</div>' +
      '</div>';
  }
  function afterRender(container) {
    const labels = new Map([
      ['Календарь серий','Актуальное расписание выхода эпизодов'],
      ['Аниме 2026','Тайтлы этого года в нашей библиотеке'],
      ['Аниме 2025','Релизы прошлого года'],
      ['Аниме 2024','Что выходило ранее']
    ]);
    for (const header of container.querySelectorAll('.komi-feature-section .section-header')) {
      const heading = header.querySelector('.section-title');
      if (!heading || header.querySelector('.komi-home-subtitle')) continue;
      const description = labels.get(heading.textContent.trim());
      if (!description) continue;
      const p = document.createElement('p');
      p.className = 'komi-home-subtitle';
      p.textContent = description;
      heading.insertAdjacentElement('afterend',p);
    }
    const community = container.querySelector('#komiLeaderboard');
    if (!community) return;
    community.addEventListener('click', event=>{
      const button=event.target.closest('[data-komi-rank]');
      if (!button || !community.contains(button)) return;
      const selected=button.getAttribute('data-komi-rank');
      for (const tab of community.querySelectorAll('[data-komi-rank]'))
        tab.setAttribute('aria-pressed',String(tab===button));
      community.dataset.metric=selected;
    });
  }
  root.KomiHomeDiscovery = {render,afterRender};
})(globalThis);
