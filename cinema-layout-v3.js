/* Komi Cinema V3: progressive DOM enhancements; no catalog, auth or RLS changes. */
(function (root) {
  'use strict';
  if (!root.KomiPlayerUX || typeof root.KomiPlayerUX.mount !== 'function') return;
  const baseMount = root.KomiPlayerUX.mount;
  let drawerPreference = null;
  let current = null;
  // Real per-episode metadata first; cache frames only from already playing,
  // accessible native video. No extra episode downloads or iframe scraping.
  const capturedFrames = new Map();
  const measuredDurations = new Map();
  function frameKey(ctx,index) {return String(ctx.animeId)+':'+ctx.season+':'+index;}
  function uniquePreview(ctx,index) {
    const url=episodePreview(ctx.episodeMeta?.[index]?.preview);
    if (!url) return '';
    return ctx.episodeMeta.filter(ep=>episodePreview(ep?.preview)===url).length===1 ? url : '';
  }
  function actualPreview(ctx,index) {return uniquePreview(ctx,index)||capturedFrames.get(frameKey(ctx,index))||'';}
  function captureCurrentFrame(ctx) {
    const video=ctx.video;
    if(!video || !currentContext(ctx) || video.readyState<2 || video.currentTime<12 ||
       !video.videoWidth || !video.videoHeight || actualPreview(ctx,ctx.index)) return false;
    try {
      const canvas=document.createElement('canvas');
      canvas.width=240;canvas.height=135;
      const g=canvas.getContext('2d');
      if (!g) return false;
      const ratio=Math.max(240/video.videoWidth,135/video.videoHeight);
      const w=video.videoWidth*ratio,h=video.videoHeight*ratio;
      g.drawImage(video,(240-w)/2,(135-h)/2,w,h);
      const pixels=g.getImageData(0,0,240,135).data;
      let light=0;for(let i=0;i<pixels.length;i+=64)light+=pixels[i]+pixels[i+1]+pixels[i+2];
      if(light/(Math.ceil(pixels.length/64)*3)<12)return false;
      const key=frameKey(ctx,ctx.index);
      capturedFrames.set(key,canvas.toDataURL('image/jpeg',.72));
      while(capturedFrames.size>160)capturedFrames.delete(capturedFrames.keys().next().value);
      const btn=ctx.grid.querySelectorAll('.komi-episode-number')[ctx.index];
      const thumbnail=btn?.querySelector('.komi-episode-thumb');
      if(thumbnail) paintEpisodeImage(thumbnail,[capturedFrames.get(key),...ctx.episodeFallbacks]);
      return true;
    } catch {return false;} // CORS/DRM restrictions are respected.
  }

  function button(text, cls, label) {
    const element = document.createElement('button');
    element.type = 'button';
    element.className = cls;
    element.textContent = text;
    if (label) element.setAttribute('aria-label', label);
    return element;
  }
  function currentContext(context) {
    return !!context && current === context && context.modal.classList.contains('active') &&
      context.content.isConnected;
  }
  function setDrawer(context, expanded) {
    if (!currentContext(context)) return;
    const hidden = !expanded;
    context.modal.classList.toggle('komi-episodes-collapsed', hidden);
    // Theater mode moves episodes below video instead of hiding them.
    context.sidebar.inert = false;
    context.sidebar.removeAttribute('aria-hidden');
    context.drawer.setAttribute('aria-expanded', String(expanded));
    context.drawer.setAttribute('aria-pressed', String(hidden));
    context.drawer.setAttribute('aria-label', 'Режим театра');
    context.drawer.textContent = hidden ? 'Вернуть серии' : 'Театр';
  }
  function episodePreview(raw) {
    try {
      if (typeof raw !== 'string' || !raw.trim()) return '';
      const url = new URL(raw, location.origin);
      if (url.protocol === 'https:' && !url.username && !url.password) return url.href;
    } catch {}
    return '';
  }
  function durationLabel(raw) {
    const seconds = typeof raw === 'string' && /^\d{1,3}:[0-5]\d$/.test(raw)
      ? Number(raw.split(':')[0]) * 60 + Number(raw.split(':')[1]) : Number(raw);
    if (!Number.isFinite(seconds) || seconds <= 0 || seconds >= 86400) return '';
    return seconds < 60 ? Math.ceil(seconds) + ' с' : Math.round(seconds / 60) + ' мин';
  }
  function paintEpisodeCaption(button) {
    const caption = button.querySelector('.komi-list-label small');
    if (!caption) return;
    caption.textContent = [button.dataset.episodeDuration, button.classList.contains('active') ? 'Сейчас смотришь' : button.classList.contains('komi-episode-watched') ? 'Просмотрена' : '']
        .filter(Boolean).join(' · ');
    caption.hidden = !caption.textContent;
  }
  function paintEpisodeImage(frame, sources) {
    frame.querySelector('img')?.remove();
    const candidates=[...new Set(sources.filter(Boolean))];
    if(!candidates.length)return;
    const image=document.createElement('img');
    image.className='komi-episode-thumb-image';
    image.alt='';image.loading='lazy';image.decoding='async';
    let next=0;
    const tryNext=()=>{
      if(next>=candidates.length){image.remove();return;}
      image.src=candidates[next++];
    };
    image.addEventListener('error',tryNext);
    frame.prepend(image);
    tryNext();
  }
  function makeEpisodeThumb(context,index,label) {
    const frame=document.createElement('span');
    frame.className='komi-episode-preview komi-episode-thumb';
    frame.setAttribute('aria-hidden','true');
    const number=document.createElement('span');
    number.className='komi-episode-thumb-badge';
    number.textContent=label;
    frame.append(number);
    paintEpisodeImage(frame,[actualPreview(context,index),...context.episodeFallbacks]);
    return frame;
  }
  function setListMode(context, list) {
    context.grid.classList.toggle('komi-episode-list', list);
    context.grid.querySelectorAll('.komi-episode-number').forEach((episodeButton, index) => {
      const label = episodeButton.dataset.komiEpisodeLabel || episodeButton.textContent.trim();
      episodeButton.dataset.komiEpisodeLabel = label;
      episodeButton.replaceChildren();
      if (list) {
        const meta = context.episodeMeta?.[index];
        episodeButton.append(makeEpisodeThumb(context,index,label));
        const caption = document.createElement('span');
        caption.className = 'komi-list-label';
        caption.textContent = 'Серия ' + label;
        const explanation = document.createElement('small');
        episodeButton.dataset.episodeDuration = durationLabel(measuredDurations.get(frameKey(context,index))) || durationLabel(meta?.duration);
        caption.append(explanation);
        episodeButton.append(caption);
        paintEpisodeCaption(episodeButton);
      } else episodeButton.textContent = label;
    });
    context.viewButtons.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === (list ? 'list' : 'grid'))));
    const activeEpisode = context.grid.querySelector('[aria-current="true"]');
    if (activeEpisode && !context.sidebar.inert) {
      const offset = activeEpisode.getBoundingClientRect().bottom - context.grid.getBoundingClientRect().bottom;
      if (offset > 0) context.grid.scrollTop += offset;
    }
  }
  function setStatus(context, message) {
    if (currentContext(context) && context.note) context.note.textContent = message;
  }
  function shareUrl(context) {
    const id = String(context.animeId);
    return /^[1-9][0-9]{0,11}$/.test(id) ? new URL('/anime/' + id, location.origin).href : location.origin + '/';
  }
  async function shareAnime(context) {
    const url = shareUrl(context);
    const title = context.title || 'KomiAnime';
    try {
      if (navigator.share) { await navigator.share({title, url}); return; }
      if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(url); setStatus(context,'Ссылка на аниме скопирована.'); return; }
    } catch (error) {
      if (error?.name === 'AbortError') return;
    }
    setStatus(context,'Ссылка на аниме: ' + url);
  }
  function createWatchRail() {
    const rail = document.createElement('nav');
    rail.className = 'komi-watch-rail';
    rail.setAttribute('aria-label', 'Навигация Komi');
    const siteRail = document.querySelector('.komi-side-nav');
    const shortcuts = ['.komi-side-logo', '#sideHomeBtn', '#sideCatalogBtn', '#sideFriendsBtn',
      '[data-komi-click="watch-party"]', '[data-komi-click="notifications"]', '.komi-side-account'];
    for (const selector of shortcuts) {
      const original = selector === '#sideFriendsBtn'
        ? document.getElementById('sideFriendsBtn')
        : siteRail?.querySelector(selector);
      if (!original) continue;
      const label = original.getAttribute('aria-label') || original.title;
      const shortcut = button('', 'komi-watch-rail-button', label);
      shortcut.title = label;
      const icon = original.querySelector('svg');
      const isAccount = original.classList.contains('komi-side-account');
      if (isAccount) shortcut.classList.add('komi-watch-rail-avatar');
      if (!isAccount && icon) shortcut.append(icon.cloneNode(true));
      else if (!isAccount) shortcut.textContent = original.textContent.trim();
      if (original.classList.contains('komi-side-logo')) shortcut.classList.add('komi-watch-rail-logo');
      if (original.dataset.komiClick === 'notifications') shortcut.classList.add('komi-watch-rail-bottom');
      shortcut.addEventListener('click', () => { root.closeWatchModal(); original.click(); });
      rail.append(shortcut);
    }
    return rail;
  }
  function enhance(context, settings) {
    const content = context.content;
    const main = content.querySelector('.komi-watch-main');
    const wrapper = main?.querySelector('.player-wrapper');
    const sidebar = content.querySelector('.komi-watch-sidebar');
    const controls = content.querySelector('.komi-watch-controls');
    const grid = sidebar?.querySelector('.komi-episode-number-grid');
    const heading = main?.querySelector('.komi-player-heading');
    if (!wrapper || !sidebar || !controls || !grid || !heading) return;
    context.sidebar = sidebar;
    context.grid = grid;
    context.title = heading.querySelector('h1')?.textContent || 'KomiAnime';
    context.episodeMeta = Array.isArray(settings.episodeMeta) ? settings.episodeMeta : [];
    // Prefer a real episode frame, then the title's own landscape artwork,
    // then its poster. Keep the badge even if every image request fails.
    context.episodeFallbacks = [...new Set([
      episodePreview(settings.watchStill),
      episodePreview(settings.watchBanner),
      episodePreview(content.querySelector('.crunchy-hero-poster')?.src)
    ].filter(Boolean))];
    const currentEpisode = context.episodeMeta[context.index];
    const poster = episodePreview(currentEpisode?.preview) || episodePreview(settings.watchStill) ||
      content.querySelector('.crunchy-hero-poster')?.src;
    const durationNode = heading.querySelector('.komi-current-duration');
    const paintDuration = () => {
      const measured = context.video?.duration;
      const actual = durationLabel(measured);
      const duration = actual || durationLabel(currentEpisode?.duration);
      if (actual) {
        measuredDurations.set(frameKey(context,context.index), measured);
        while (measuredDurations.size > 160) measuredDurations.delete(measuredDurations.keys().next().value);
      }
      if (durationNode) durationNode.textContent = duration ? ' · ' + duration : '';
      const active = context.grid.querySelectorAll('.komi-episode-number')[context.index];
      if (active && duration) { active.dataset.episodeDuration = duration; paintEpisodeCaption(active); }
    };
    if (context.video) {
      if (poster) context.video.poster = poster;
      context.video.addEventListener('durationchange', paintDuration);
    }
    paintDuration();
    current = context;

    // The top bar is inside the existing viewport, never overlapping site navigation.
    const top = document.createElement('header');
    top.className = 'komi-cinema-topbar';
    top.setAttribute('aria-label', 'Управление кинотеатром');
    const title = document.createElement('span');
    title.className = 'komi-cinema-topbar-title';
    title.textContent = context.title + ' · Сезон ' + context.season + ' · Серия ' + (settings.displayNumber || context.index + 1);
    const drawer = button('Скрыть серии [→|]', 'komi-episodes-toggle', 'Показать или скрыть список серий');
    drawer.setAttribute('aria-controls', 'komiWatchEpisodeSidebar');
    sidebar.id = 'komiWatchEpisodeSidebar';
    context.drawer = drawer;
    drawer.addEventListener('click', () => {
      const showing = context.modal.classList.contains('komi-episodes-collapsed');
      drawerPreference = showing;
      setDrawer(context, drawerPreference);
    });
    const search = button('Поиск аниме', 'komi-cinema-search', 'Открыть поиск аниме');
    search.addEventListener('click', () => {
      root.closeWatchModal();
      const inputs = ['searchInput','komiCatalogSearchInput'];
      const visibleSearch = () => inputs.map(id => document.getElementById(id)).find(input => input?.getClientRects().length);
      const input = visibleSearch();
      if (input) input.focus();
      else {
        root.navigate('catalog');
        visibleSearch()?.focus();
      }
    });
    top.append(drawer, search);
    const share = button('↗ Поделиться', 'komi-cinema-share', 'Поделиться ссылкой на это аниме');
    share.addEventListener('click', () => void shareAnime(context));
    controls.append(share);
    const expanded = content.querySelector('.komi-watch-expand');
    if (expanded) controls.append(expanded);
    const close = content.querySelector('.modal-close');
    if (close) top.append(close);
    content.prepend(createWatchRail(), top);
    const initialOpen = drawerPreference ?? true;
    setDrawer(context, initialOpen);

    const view = document.createElement('div');
    view.className = 'komi-episode-view-toggle';
    view.setAttribute('role','group');
    view.setAttribute('aria-label','Режим отображения серий');
    const gridButton = button('▦ Сетка','', 'Показать серии сеткой');
    const listButton = button('☷ Список','', 'Показать серии списком');
    gridButton.dataset.view = 'grid';
    listButton.dataset.view = 'list';
    context.viewButtons = [gridButton,listButton];
    view.append(gridButton,listButton);
    grid.after(view);
    gridButton.addEventListener('click', () => setListMode(context,false));
    listButton.addEventListener('click', () => setListMode(context,true));
    setListMode(context,true);
    if (context.video && !actualPreview(context,context.index)) {
      let attempts=0,lastAttempt=-30;
      const takeFrame=()=>{
        if (context.video.currentTime<12 || context.video.currentTime-lastAttempt<8) return;
        lastAttempt=context.video.currentTime;
        if (++attempts>5 || captureCurrentFrame(context)) context.video.removeEventListener('timeupdate',takeFrame);
      };
      context.video.addEventListener('timeupdate',takeFrame,{signal:context.abort.signal});
    }
    // Cloud watched markers may arrive asynchronously; refresh captions when painted.
    if (root.MutationObserver) {
      const observer = new MutationObserver(() => {
        if (!currentContext(context) || !grid.classList.contains('komi-episode-list')) return;
        grid.querySelectorAll('.komi-episode-number').forEach(paintEpisodeCaption);
      });
      observer.observe(grid,{subtree:true,attributes:true,attributeFilter:['class']});
      context.observer = observer;
    }

    // Source choices are generated from actual catalog sources, never invented studio names.
    const source = controls.querySelector('#komiWatchSourceSelect');
    if (source && source.options.length > 0 && source.options.length <= 3 &&
      ![...source.options].some(o => o.value === 'Недоступно')) {
      const group = source.closest('.komi-watch-source');
      const tabs = document.createElement('div');
      tabs.className = 'komi-source-tabs';
      tabs.setAttribute('role','group');
      tabs.setAttribute('aria-label','Озвучка / плеер');
      for (const option of source.options) {
        const tab = button(option.textContent,'','Выбрать источник ' + option.textContent);
        tab.setAttribute('aria-pressed',String(option.value === source.value));
        tab.addEventListener('click', () => {
          if (option.value === source.value || !currentContext(context)) return;
          if (typeof root.changePlayerSource === 'function')
            root.changePlayerSource(context.animeId,context.season,context.index,option.value);
        });
        tabs.append(tab);
      }
      group.append(tabs);
      group.classList.add('komi-has-tabs');
    }
    const qualityLabel = document.createElement('label');
    qualityLabel.className = 'komi-quality-control';
    const qualityCaption = document.createElement('span');
    qualityCaption.textContent = 'Качество';
    const quality = document.createElement('select');
    quality.setAttribute('aria-label','Качество видео');
    const auto = new Option('Авто','-1');
    quality.add(auto);
    quality.disabled = true;
    qualityLabel.hidden = true;
    qualityLabel.append(qualityCaption, quality);
    const playbackMenu = wrapper.querySelector('.komi-playback-menu');
    const playbackSettings = wrapper.querySelector('.komi-playback-settings');
    const compact = window.matchMedia('(max-width:1100px)');
    const placeQuality = () => {
      if (playbackSettings && !compact.matches) playbackSettings.before(qualityLabel);
      else (playbackMenu || controls).append(qualityLabel);
    };
    placeQuality();
    compact.addEventListener('change', placeQuality, {signal:context.abort.signal});
    function refreshQualities() {
      const levels = context.video?.komiHls?.levels;
      if (!levels?.length) return;
      quality.replaceChildren(new Option('Авто','-1'));
      const seen = new Set();
      levels.forEach((level,index) => {
        const label = level.height ? level.height + 'p' : 'Поток ' + (index + 1);
        if (seen.has(label)) return;
        seen.add(label);
        quality.add(new Option(label,String(index)));
      });
      quality.disabled = false;
      qualityLabel.hidden = false;
    }
    quality.addEventListener('change', () => {
      if (context.video?.komiHls) context.video.komiHls.currentLevel = Number(quality.value);
    });
    context.video?.addEventListener('loadedmetadata',refreshQualities);

    const toolbar = content.querySelector('.komi-cinema-toolbar');
    if (toolbar) {
      controls.append(toolbar);
      const light = toolbar.querySelector('.komi-cinema-lights');
      if (light) { light.textContent = '💡 Свет'; light.title = 'Приглушить или вернуть интерфейс'; }
      const skip = toolbar.querySelector('.komi-cinema-skip');
      if (skip) skip.textContent = '⏭ +85с';
    }
    const next = heading.querySelector('.komi-watch-navbtn.primary');
    if (context.video && next && context.hasNext) {
      const check = () => {
        const video=context.video;
        next.classList.toggle('komi-cinema-next-soon',
          Number.isFinite(video.duration) && video.duration>0 && video.currentTime/video.duration>=.88);
      };
      context.video.addEventListener('timeupdate',check);
      context.video.addEventListener('loadedmetadata',check);
    }
    const party = button('◇ Watch Party','komi-cinema-party','Создать комнату на текущей серии');
    party.title = 'Для управляемых MP4/HLS можно передать позицию просмотра. Для внешнего iframe — только серию и источник.';
    party.addEventListener('click', () => {
      if (!currentContext(context) || typeof root.createWatchPartyFromAnime !== 'function') return;
      const time = context.video && Number.isFinite(context.video.currentTime) ? context.video.currentTime : 0;
      root.createWatchPartyFromAnime(context.animeId,'',false,
        Number.isInteger(settings.originalIndex) ? settings.originalIndex : context.index,
        settings.originalSource || source?.value || '',time);
    });
    controls.append(party);
    const note = content.querySelector('.komi-cinema-action-status');
    context.note = note;
    if (note) controls.append(note);

    if (context.video) {
      const video = context.video;
      const play = button('▶','komi-cinema-bigplay','Воспроизвести видео');
      wrapper.append(play);
      const paint = () => {
        play.hidden = !video.paused || video.ended;
        play.setAttribute('aria-hidden',String(play.hidden));
      };
      play.addEventListener('click', () => {
        const playback = wrapper.querySelector('.komi-playback [data-control="play"]');
        if (playback) playback.click();
        else video.play().catch(()=>setStatus(context,'Не удалось начать воспроизведение.'));
      });
      video.addEventListener('play',paint);
      video.addEventListener('pause',paint);
      video.addEventListener('ended',paint);
      paint();
    }

    // Only the site's fullscreen wrapper can show a site HUD.
    // Fullscreen initiated by an embedded third party is not accessible cross-origin.
    const hud = document.createElement('div');
    hud.className = 'komi-native-hud';
    const episodeTitle = document.createElement('strong');
    episodeTitle.textContent = title.textContent;
    const hudNext = button('Следующая серия →','','Следующая серия');
    hudNext.disabled = !context.hasNext;
    hudNext.addEventListener('click', () => {
      if (context.hasNext && currentContext(context) && typeof root.openWatchModal === 'function')
        root.openWatchModal(context.animeId,context.season,context.index+1);
    });
    hud.append(episodeTitle,hudNext);
    wrapper.append(hud);
    let timer;
    function showHud() {
      if (document.fullscreenElement !== wrapper) return;
      hud.classList.add('is-visible');
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (!hud.matches(':focus-within')) hud.classList.remove('is-visible');
      },2500);
    }
    function fullscreenChange() {
      if (document.fullscreenElement === wrapper) showHud();
      else {clearTimeout(timer);hud.classList.remove('is-visible');}
    }
    wrapper.addEventListener('pointermove',showHud,{passive:true});
    wrapper.addEventListener('keydown',showHud);
    hud.addEventListener('focusin',showHud);
    document.addEventListener('fullscreenchange',fullscreenChange,{signal:context.abort?.signal});
    context.hud = hud;
  }

  document.addEventListener('fullscreenchange', () => {
    if (!currentContext(current)) return;
    const label = current.content.querySelector('.komi-watch-expand span');
    if (label) label.textContent = document.fullscreenElement === current.content ? 'Обычный размер' : 'На весь экран';
  });

  root.KomiPlayerUX.mount = function cinemaMount(settings = {}) {
    if (current) {
      current.observer?.disconnect();
      current.abort?.abort();
      current = null;
    }
    const context = baseMount(settings);
    if (context) {
      context.abort = new AbortController();
      enhance(context,settings);
    }
    return context;
  };
})(globalThis);
