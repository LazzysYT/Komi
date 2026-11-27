/* Komi Cinema V3: progressive DOM enhancements; no catalog, auth or RLS changes. */
(function (root) {
  'use strict';
  if (!root.KomiPlayerUX || typeof root.KomiPlayerUX.mount !== 'function') return;
  const baseMount = root.KomiPlayerUX.mount;
  let drawerPreference = null;
  let episodeListPreference = true;
  const episodeArtworkBase = '/episode-stills';
  const publicEpisodeFrames = new Map();

  function externalEpisodeFrame(raw) {
    const match = typeof raw === 'string' &&
      /^https:\/\/image\.tmdb\.org\/t\/p\/w500\/([a-zA-Z0-9_-]+\.jpg)$/.exec(raw);
    return match ? 'https://image.tmdb.org/t/p/w300/' + match[1] : '';
  }
  function matchedEpisodeFrames(data) {
    const frames = new Map(), uses = new Map(), numbers = new Map();
    for (const episode of Array.isArray(data) ? data : []) {
      const number = Number(episode?.number), url = externalEpisodeFrame(episode?.still);
      if (!Number.isSafeInteger(number) || number < 1) continue;
      numbers.set(number,(numbers.get(number) || 0) + 1);
      if (!url) continue;
      uses.set(url,(uses.get(url) || 0) + 1);
      frames.set(number,url);
    }
    for (const [number,url] of frames) {
      if (numbers.get(number) !== 1 || uses.get(url) !== 1) frames.delete(number);
    }
    return frames;
  }
  function getPublicEpisodeFrames(id) {
    if (publicEpisodeFrames.has(id)) return publicEpisodeFrames.get(id);
    const request = (async () => {
      const abort = new AbortController();
      const timer = setTimeout(() => abort.abort(),4500);
      const read = async path => {
        const response = await root.fetch(episodeArtworkBase + path,{
          credentials:'omit',referrerPolicy:'no-referrer',signal:abort.signal
        });
        if (response.status === 404) return null;
        if (!response.ok) throw new Error('Episode artwork unavailable');
        return response.json();
      };
      try {
        // The audited catalogue example has a tiny same-origin frame index.
        // All other titles use a bounded, cacheable same-origin metadata route.
        if (id === 5114) return matchedEpisodeFrames(await read('/5114.json'));
        const mapping = await read('/map/' + Math.floor(id/1000) + '/' + id + '.json');
        const mapped = Number(mapping?.anilist_id);
        if (!Number.isSafeInteger(mapped) || mapped < 1 || mapped > 10000000) return new Map();
        return matchedEpisodeFrames(await read('/data/' + Math.floor(mapped/1000) + '/' + mapped + '.json'));
      } finally {clearTimeout(timer);}
    })().catch(() => {
      if (publicEpisodeFrames.get(id) === request) publicEpisodeFrames.delete(id);
      return new Map();
    });
    publicEpisodeFrames.set(id,request);
    if (publicEpisodeFrames.size > 36) publicEpisodeFrames.delete(publicEpisodeFrames.keys().next().value);
    return request;
  }
  function hydrateEpisodeFrames(ctx) {
    const id = ctx.episodeArtworkId;
    const grid = ctx.grid;
    if (ctx.episodeArtworkRequested) return;
    if (ctx.season !== 1 || !Number.isSafeInteger(id) || id < 1 || id > 10000000 ||
        typeof root.fetch !== 'function') return;
    const buttons = grid.querySelectorAll('.komi-episode-number');
    const positions = ctx.episodeMeta.map((ep,index) => ep?.number ??
      (id === 5114 ? Number(buttons[index]?.dataset.episodeNumber) : null));
    if (!positions.includes(1)) return;
    if (!ctx.episodeMeta.some((ep,index) => Number.isSafeInteger(positions[index]) && !ep?.supplementalLabel && !actualPreview(ctx,index))) return;
    ctx.episodeArtworkRequested = true;
    grid.dataset.episodeFrames = 'loading';
    void getPublicEpisodeFrames(id).then(frames => {
      if (!currentContext(ctx) || ctx.abort.signal.aborted) return;
      grid.dataset.episodeFrames = frames.size ? 'available' : 'unavailable';
      const numbers = new Map();
      for (const number of positions) numbers.set(number,(numbers.get(number)||0)+1);
      const catalogUrls = new Set([...ctx.uniquePreviews,...ctx.episodeFallbacks].filter(Boolean).map(url => url.replace('/w500/','/w300/')));
      ctx.episodeMeta.forEach((ep,index) => {
        const number = positions[index];
        if (ep?.supplementalLabel || numbers.get(number) !== 1) return;
        const url = frames.get(number);
        if (!url || catalogUrls.has(url)) return;
        ctx.externalPreviews[index] = url;
        const frame = buttons[index]?.querySelector('.komi-episode-thumb');
        if (frame && !uniquePreview(ctx,index) && !capturedFrames.has(frameKey(ctx,index))) paintWatchEpisodeFrame(ctx,index,frame);
      });
    });
  }
  let current = null;
  // Real per-episode metadata first; cache frames only from already playing,
  // accessible native video. No extra episode downloads or iframe scraping.
  const capturedFrames = new Map();
  const measuredDurations = new Map();
  function frameKey(ctx,index) {return String(ctx.animeId)+':'+ctx.season+':'+index;}
  function indexEpisodePreviews(ctx) {
    const urls = ctx.episodeMeta.map(ep => episodePreview(ep?.preview));
    const titleArtwork = new Set(ctx.episodeFallbacks || []);
    const counts = new Map();
    for (const url of urls) if (url) counts.set(url,(counts.get(url)||0)+1);
    return urls.map(url => url && counts.get(url) === 1 && !titleArtwork.has(url) ? url : '');
  }
  function uniquePreview(ctx,index) {
    const url=ctx.uniquePreviews?.[index] || '';
    return ctx.failedPreviews?.has(url) ? '' : url;
  }
  function actualPreview(ctx,index) {
    const external = ctx.externalPreviews?.[index];
    return [uniquePreview(ctx,index),capturedFrames.get(frameKey(ctx,index)),external]
      .find(url => url && !ctx.failedPreviews?.has(url)) || '';
  }
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
      if(thumbnail) paintWatchEpisodeFrame(ctx,ctx.index,thumbnail);
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
      if (typeof raw !== 'string' || !/^(?:https:\/\/|\/(?!\/))/i.test(raw)) return '';
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
    const status = button.classList.contains('active') ? 'Сейчас смотришь' : button.classList.contains('komi-episode-watched') ? 'Просмотрена' : '';
    caption.textContent = [button.dataset.episodeDuration, status]
        .filter(Boolean).join(' · ');
    caption.hidden = !caption.textContent;
    button.setAttribute('aria-label',[
      (button.dataset.supplementalLabel ? 'Дополнительный выпуск ' : 'Серия ') + button.dataset.komiEpisodeLabel,
      button.dataset.supplementalLabel, status, button.dataset.episodeDuration,
      button.querySelector('.komi-episode-thumb-kind')?.textContent
    ].filter(Boolean).join('. '));
  }
  function setEpisodePreviewKind(frame,kind) {
    frame.dataset.previewKind = kind;
    let label=frame.querySelector('.komi-episode-thumb-kind');
    if(!label) {
      label=document.createElement('span');
      label.className='komi-episode-thumb-kind';
      frame.append(label);
    }
    label.textContent=kind==='frame' ? 'Кадр серии' : kind==='poster' ? 'Постер тайтла' : 'Нет изображения';
    const episodeButton=frame.closest('.komi-episode-number');
    if(episodeButton) paintEpisodeCaption(episodeButton);
  }
  function paintEpisodeImage(frame, sources, onFailure) {
    frame.querySelector('img')?.remove();
    const seen=new Set();
    const candidates=sources.filter(candidate=>{
      if(!candidate?.url || seen.has(candidate.url)) return false;
      seen.add(candidate.url);
      return true;
    });
    setEpisodePreviewKind(frame,'unavailable');
    if(!candidates.length)return;
    const image=document.createElement('img');
    image.className='komi-episode-thumb-image';
    image.alt='';image.loading='lazy';image.decoding='async';image.referrerPolicy='no-referrer';
    let next=0;
    const tryNext=()=>{
      if(next>=candidates.length){image.remove();setEpisodePreviewKind(frame,'unavailable');return;}
      const candidate=candidates[next++];
      image.src=candidate.url;
      if (image.complete && image.naturalWidth > 0) setEpisodePreviewKind(frame,candidate.kind);
    };
    image.addEventListener('load',()=>{
      if (image.parentNode === frame) setEpisodePreviewKind(frame,candidates[next-1].kind);
    });
    image.addEventListener('error',()=>{
      if (!frame.isConnected || image.parentNode !== frame) return;
      setEpisodePreviewKind(frame,'unavailable');
      onFailure?.(candidates[next-1].url);
      tryNext();
    });
    frame.prepend(image);
    tryNext();
  }
  function paintWatchEpisodeFrame(context,index,frame) {
    const urls = [actualPreview(context,index),context.externalPreviews?.[index]];
    paintEpisodeImage(frame,urls.filter(url => url && !context.failedPreviews.has(url)).map(url => ({url,kind:'frame'})),
      url => {
        context.failedPreviews.add(url);
        hydrateEpisodeFrames(context);
        // The public index can arrive after this image's candidate list was made.
        const backup = context.externalPreviews?.[index];
        if (backup && !context.failedPreviews.has(backup)) queueMicrotask(() => {
          if (frame.isConnected && !frame.querySelector('img')) paintWatchEpisodeFrame(context,index,frame);
        });
      });
  }
  function paintEpisodeProgress(context, node=context.grid?.querySelector('.komi-episode-number.active .komi-cinema-progress')) {
    if (!node) return;
    const live=context.video;
    const measured=Number(live?.duration);
    const validMedia=Number.isFinite(measured)&&measured>0&&Number(live?.currentTime)>0;
    const time=validMedia?Number(live.currentTime):Number(context.savedEpisodeProgress?.time);
    const duration=validMedia?measured:Number(context.savedEpisodeProgress?.duration);
    node.hidden=!(Number.isFinite(duration)&&duration>0&&Number.isFinite(time)&&time>0);
    if(!node.hidden) node.value=Math.min(100, Math.max(0, time/duration*100));
  }
  function makeEpisodeThumb(context,index,label) {
    const frame=document.createElement('span');
    frame.className='komi-episode-preview komi-episode-thumb';
    frame.setAttribute('aria-hidden','true');
    const number=document.createElement('span');
    number.className='komi-episode-thumb-badge';
    number.textContent=label;
    frame.append(number);
    if(index===context.index){
      const progress=document.createElement('progress');
      progress.className='komi-cinema-progress';
      progress.max=100;
      frame.append(progress);
      paintEpisodeProgress(context, progress);
    }
    paintWatchEpisodeFrame(context,index,frame);
    return frame;
  }
  function setListMode(context, list) {
    episodeListPreference = list;
    context.grid.classList.toggle('komi-episode-list', list);
    context.grid.querySelectorAll('.komi-episode-number').forEach((episodeButton, index) => {
      const label = episodeButton.dataset.komiEpisodeLabel || episodeButton.dataset.episodeNumber || episodeButton.textContent.trim();
      episodeButton.dataset.komiEpisodeLabel = label;
      const meta = context.episodeMeta?.[index];
      episodeButton.dataset.supplementalLabel = typeof meta?.supplementalLabel === 'string' ? meta.supplementalLabel : '';
      episodeButton.replaceChildren();
      if (list) {
        episodeButton.append(makeEpisodeThumb(context,index,label));
        const caption = document.createElement('span');
        caption.className = 'komi-list-label';
        caption.textContent = (episodeButton.dataset.supplementalLabel ? 'Доп. выпуск ' : 'Серия ') + label;
        const explanation = document.createElement('small');
        episodeButton.dataset.episodeDuration = durationLabel(measuredDurations.get(frameKey(context,index))) || durationLabel(meta?.duration);
        caption.append(explanation);
        if(episodeButton.dataset.supplementalLabel) {
          const supplemental=document.createElement('small');
          supplemental.className='komi-episode-supplemental';
          supplemental.textContent=episodeButton.dataset.supplementalLabel;
          caption.append(supplemental);
        }
        episodeButton.append(caption);
        paintEpisodeCaption(episodeButton);
      } else {
        episodeButton.textContent = label;
        episodeButton.setAttribute('aria-label',[
          (episodeButton.dataset.supplementalLabel ? 'Дополнительный выпуск ' : 'Серия ') + label,
          episodeButton.dataset.supplementalLabel,
          episodeButton.classList.contains('active') ? 'Сейчас смотришь' : ''
        ].filter(Boolean).join('. '));
      }
    });
    if (list) hydrateEpisodeFrames(context);
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
    if (!/^[1-9][0-9]{0,11}$/.test(id)) return location.origin + '/';
    const url = new URL('/anime/' + id, location.origin);
    const number = context.grid?.querySelectorAll('.komi-episode-number')[context.index]?.dataset.episodeNumber;
    if (/^[1-9][0-9]{0,5}$/.test(String(context.season)) && /^[1-9][0-9]{0,5}$/.test(String(number || ''))) {
      url.searchParams.set('season',String(context.season));
      url.searchParams.set('episode',number);
      url.hash = 'player';
    }
    return url.href;
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
      if (!original || (original.dataset.komiClick==='notifications' && original.hidden)) continue;
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
    context.savedEpisodeProgress=settings.savedEpisodeProgress || null;
    context.episodeMeta = Array.isArray(settings.episodeMeta) ? settings.episodeMeta : [];
    context.episodeArtworkId = Number(settings.episodeArtworkId || settings.animeId || context.animeId);
    context.externalPreviews = [];
    // Title art is used only to reject mislabeled episode metadata, never as row artwork.
    context.episodeFallbacks = [...new Set([
      episodePreview(settings.watchPoster),
      episodePreview(content.querySelector('.crunchy-hero-poster')?.src),
      episodePreview(settings.watchBanner),
      ...(Array.isArray(settings.watchTitleStills) ? settings.watchTitleStills.map(episodePreview) : [])
    ].filter(url=>url && new URL(url).pathname !== '/anime-artwork.svg'))];
    context.uniquePreviews = indexEpisodePreviews(context);
    context.failedPreviews = new Set();
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
      context.video.addEventListener('durationchange', paintDuration,{signal:context.abort.signal});
      context.video.addEventListener('timeupdate', ()=>paintEpisodeProgress(context),{signal:context.abort.signal});
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
    if(typeof settings.episodeSummary === 'string' && settings.episodeSummary.trim()) {
      const summary=document.createElement('p');
      summary.className='komi-episode-summary';
      summary.id='komiEpisodeSummary';
      summary.textContent=settings.episodeSummary;
      grid.before(summary);
      const describedBy=grid.getAttribute('aria-describedby') || '';
      grid.setAttribute('aria-describedby',[describedBy,summary.id].filter(Boolean).join(' '));
    }
    gridButton.addEventListener('click', () => setListMode(context,false));
    listButton.addEventListener('click', () => setListMode(context,true));
    setListMode(context,episodeListPreference);
    if (context.video) {
      let attempts=0,lastAttempt=-30;
      const takeFrame=()=>{
        if (actualPreview(context,context.index) || context.video.currentTime<12 || context.video.currentTime-lastAttempt<8) return;
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
      const hls = context.video?.komiHls;
      const levels = hls?.levels;
      if (!levels?.length) { qualityLabel.hidden = true; quality.disabled = true; return; }
      const selected = hls.autoLevelEnabled ? '-1' : String(hls.currentLevel);
      quality.replaceChildren(new Option('Авто','-1'));
      const seen = new Set();
      levels.forEach((level,index) => {
        const label = level.height ? level.height + 'p' : 'Поток ' + (index + 1);
        if (seen.has(label)) return;
        seen.add(label);
        quality.add(new Option(label,String(index)));
      });
      quality.value = [...quality.options].some(option => option.value === selected) ? selected : '-1';
      quality.disabled = false;
      qualityLabel.hidden = false;
    }
    quality.addEventListener('change', () => {
      if (context.video?.komiHls) context.video.komiHls.currentLevel = Number(quality.value);
    });
    for (const event of ['loadedmetadata','komi:hls-levels']) context.video?.addEventListener(event,refreshQualities,{signal:context.abort.signal});
    refreshQualities();

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

  function disposeCinema() {
    if (current) {
      current.observer?.disconnect();
      current.abort?.abort();
      current = null;
    }
  }
  root.KomiPlayerUX.disposeCinema = disposeCinema;
  root.KomiPlayerUX.mount = function cinemaMount(settings = {}) {
    disposeCinema();
    const context = baseMount(settings);
    if (context) {
      context.abort = new AbortController();
      enhance(context,settings);
    }
    return context;
  };
})(globalThis);
