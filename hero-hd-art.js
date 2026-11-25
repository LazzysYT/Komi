/* Komi Anime: progressive hero artwork with native-resolution fallbacks.
 * Requests public metadata only; does not send account information.
 * Wide images must be genuinely wide and high resolution. Low-resolution
 * portraits stay sharp and contained; wide images upgrade after first paint.
 */
(function (root) {
  'use strict';

  const API = 'https://graphql.anilist.co';
  const SELECTOR = '.komi-home-hero .hero-slide[data-komi-anime-id]';
  const CACHE_PREFIX = 'komi_hd_hero_v3_';
  const FOUND_TTL = 24 * 60 * 60 * 1000;
  const MISSING_TTL = 60 * 60 * 1000;
  const cache = new Map();
  const pending = new Set();
  const fetchingIds = new Set();
  const metadata = new Map();
  const metadataPending = new Map();
  const runningVideos = new Set();
  const videoRecords = new WeakMap();
  const mediaReady = new WeakSet();
  const artworkJobs = new WeakMap();
  const sliderStates = new WeakMap();
  const mountedSliders = new Set();
  const metadataRetryAfter = new Map();
  const metadataVersions = new Map();
  const query = value => { try { return root.matchMedia?.(value) || {matches:false}; } catch { return {matches:false}; } };
  const reducedMotion = query('(prefers-reduced-motion: reduce)');
  const finePointer = query('(hover:hover) and (pointer:fine)');
  const watchModal = document.getElementById('watchModal');
  let viewportObserver = null;
  let pointerFrame = null;
  let pointerPosition = null;
  const retryAfter = new Map();
  let fetching = false;
  let scanTimer = null;
  let firstVisibleId = '';
  let userSelectedSlide = false;

  function trustedAniListImage(raw) {
    try {
      if (typeof raw !== 'string' || raw.length > 1024) return '';
      const u = new URL(raw);
      if (u.protocol !== 'https:' || u.username || u.password || u.port || u.hash ||
          !['s4.anilist.co', 's3.anilist.co'].includes(u.hostname) ||
          !/^\/file\/anilistcdn\/media\/anime\/(?:banner|cover)\//.test(u.pathname)) return '';
      return u.href;
    } catch { return ''; }
  }

  function safeStill(raw) {
    try {
      if (typeof raw !== 'string' || raw.length > 2000) return '';
      const u = new URL(raw);
      return u.protocol === 'https:' && !u.username && !u.password && !u.port ? u.href : '';
    } catch { return ''; }
  }

  function safeVideo(raw) {
    const url = safeStill(raw);
    return url && /\.(mp4|webm)$/i.test(new URL(url).pathname) ? url : '';
  }

  function constrainedConnection() {
    const connection = root.navigator?.connection;
    return Boolean(connection?.saveData || /(^|-)2g$/.test(connection?.effectiveType || ''));
  }

  function sliderFor(slide) {
    return slide?.closest?.('#heroSlider') || document.getElementById('heroSlider');
  }

  function matches(node, selector) {
    try { return Boolean(node?.matches?.(selector)); } catch { return false; }
  }

  function buttonFocused(slider) {
    const active = document.activeElement;
    return Boolean(active?.closest?.('[data-komi-hero-toggle]') && slider?.contains?.(active));
  }

  function mountSlider(slider) {
    if (!slider || typeof slider.querySelectorAll !== 'function') return null;
    let state = sliderStates.get(slider);
    if (state) return state;
    const observeVisibility = typeof root.IntersectionObserver === 'function';
    state = {visible:!observeVisibility, userPaused:false, resumeFocus:false, ignoreHover:false, listeners:[]};
    // The observer supplies initial visibility without forcing layout while the
    // home is mounting. Hold autoplay until that first observation arrives.
    if (!observeVisibility) {
      const rect = slider.getBoundingClientRect?.();
      if (rect && root.innerHeight && rect.height)
        state.visible = rect.bottom > 0 && rect.top < root.innerHeight && rect.right > 0 && (!root.innerWidth || rect.left < root.innerWidth);
    }
    sliderStates.set(slider,state);
    mountedSliders.add(slider);
    if (observeVisibility) {
      if (!viewportObserver) viewportObserver = new root.IntersectionObserver(entries => {
        for (const entry of entries) {
          const current = sliderStates.get(entry.target);
          if (!current) continue;
          current.visible = Boolean(entry.isIntersecting && (entry.intersectionRatio == null || entry.intersectionRatio > 0));
        }
        syncVideos();
        if (entries.some(entry => entry.isIntersecting)) scheduleScan();
      }, {threshold:[0,0.01]});
      viewportObserver.observe(slider);
    }
    const listen = (name, handler) => {
      slider.addEventListener?.(name,handler);
      state.listeners.push([name,handler]);
    };
    listen('pointerenter', () => syncVideos());
    listen('pointerleave', () => { state.ignoreHover = false; syncVideos(); });
    listen('focusin', event => {
      if (!event.target?.closest?.('[data-komi-hero-toggle]')) state.resumeFocus = false;
      syncVideos();
    });
    listen('focusout', () => Promise.resolve().then(() => {
      if (!buttonFocused(slider)) state.resumeFocus = false;
      syncVideos();
    }));
    return state;
  }

  function isPaused(slider) {
    const state = mountSlider(slider);
    const watching = Boolean(watchModal?.classList?.contains('active'));
    if (!state) return Boolean(document.hidden || watching || reducedMotion.matches || constrainedConnection());
    const focused = matches(slider,':focus-within');
    const focusPaused = focused && !(state.resumeFocus && buttonFocused(slider));
    const hoverPaused = finePointer.matches && matches(slider,':hover') && !state.ignoreHover;
    const restricted = Boolean(document.hidden || watching || slider.isConnected === false || !state.visible || reducedMotion.matches || constrainedConnection());
    const paused = Boolean(restricted || state.userPaused || focusPaused || hoverPaused);
    if (slider.dataset) {
      slider.dataset.komiHeroVisible = String(state.visible);
      slider.dataset.komiHeroPaused = String(paused);
    }
    const slides = Array.from(slider.querySelectorAll('.hero-slide'));
    const hasMotion = slides.length > 1 || slides.some(slide => safeVideo(slide.dataset?.komiHeroVideo));
    for (const button of slider.querySelectorAll('[data-komi-hero-toggle]')) {
      button.hidden = !hasMotion;
      button.disabled = restricted;
      button.setAttribute('aria-pressed',String(paused));
      button.setAttribute('aria-label',paused ? 'Продолжить слайдер' : 'Приостановить слайдер');
      button.title = paused ? 'Продолжить слайдер' : 'Приостановить слайдер';
      for (const icon of button.querySelectorAll('[data-komi-hero-pause-icon]')) icon.toggleAttribute('hidden',paused);
      for (const icon of button.querySelectorAll('[data-komi-hero-play-icon]')) icon.toggleAttribute('hidden',!paused);
    }
    return paused;
  }

  function pauseVideo(video) {
    const record = videoRecords.get(video);
    if (record?.pending) { record.attempt++; record.pending = false; }
    if (!video.paused) video.pause();
    video.classList.remove('is-playing');
  }

  function disposeVideo(video) {
    pauseVideo(video);
    runningVideos.delete(video);
    video.removeAttribute?.('src');
    video.load?.();
    video.remove?.();
  }

  function cleanupSliders() {
    for (const slider of mountedSliders) if (slider.isConnected === false) {
      viewportObserver?.unobserve(slider);
      const state = sliderStates.get(slider);
      for (const [name,handler] of state?.listeners || []) slider.removeEventListener?.(name,handler);
      mountedSliders.delete(slider);
      sliderStates.delete(slider);
    }
    for (const video of runningVideos) if (video.isConnected === false) disposeVideo(video);
  }

  function getCached(id) {
    const now = Date.now();
    const key = CACHE_PREFIX + id;
    let item = cache.get(id);
    if (!item) {
      try { item = JSON.parse(sessionStorage.getItem(key) || 'null'); } catch { item = null; }
    }
    if (!item || !Number.isFinite(item.time) ||
        now - item.time > (item.banner || item.cover ? FOUND_TTL : MISSING_TTL)) {
      cache.delete(id);
      return null;
    }
    cache.set(id, item);
    return item;
  }

  function saveCached(id, media) {
    const entry = {
      banner: trustedAniListImage(media?.bannerImage),
      cover: trustedAniListImage(media?.coverImage?.extraLarge),
      time: Date.now()
    };
    cache.set(id, entry);
    try { sessionStorage.setItem(CACHE_PREFIX + id, JSON.stringify(entry)); } catch {}
    return entry;
  }

  function updateLayout(slide, img) {
    if (!img || !img.naturalHeight) return;
    const ratio = img.naturalWidth / img.naturalHeight;
    const wide = img.naturalWidth >= 1200 && ratio >= 1.6;
    const softWide = !wide && img.naturalWidth >= 900 && ratio >= 1.55;
    slide.classList.toggle('komi-hd-wide', wide);
    slide.classList.toggle('komi-hd-softwide', softWide);
    slide.classList.toggle('komi-hd-poster', !wide && !softWide);
    slide.classList.toggle('komi-art-ready', true);
  }

  function bindImage(slide) {
    const img = slide.querySelector('img.komi-hub-hero-art');
    if (!img) return null;
    if (!img.dataset.komiHeroBound) {
      img.dataset.komiHeroBound = '1';
      img.addEventListener('load', () => {
        updateLayout(slide,img);
        if (slide.classList.contains('active')) scheduleScan();
      });
      if (img.complete && img.naturalWidth) updateLayout(slide, img);
    }
    return img;
  }

  function preflight(url) {
    return new Promise(resolve => {
      if (!url) return resolve(null);
      const picture = new Image();
      picture.decoding = 'async';
      picture.referrerPolicy = 'no-referrer';
      let settled = false;
      const finish = result => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        picture.onload = picture.onerror = null;
        resolve(result);
      };
      const timer = setTimeout(() => {
        finish(null);
        picture.removeAttribute('src');
      }, 3500);
      picture.onload = () => finish({
        url, width: picture.naturalWidth, height: picture.naturalHeight
      });
      picture.onerror = () => finish(null);
      picture.src = url;
    });
  }

  function applyArtwork(slide, entry) {
    const img = bindImage(slide);
    if (!img || !slide.classList.contains('active')) return Promise.resolve(null);
    const firstUnselected = !userSelectedSlide && String(slide.dataset.komiAnimeId||'') === firstVisibleId;
    const banner = safeStill(slide.dataset.komiHeroBanner);
    const still = safeStill(slide.dataset.komiHeroStill);
    const externalBanner = trustedAniListImage(entry?.banner);
    const cover = trustedAniListImage(entry?.cover);
    const originalPoster = safeStill(img.dataset.posterDirect);
    const signature = [banner,still,externalBanner,cover,originalPoster,firstUnselected].join('|');
    const previous = artworkJobs.get(img);
    if (previous?.signature === signature && img.dataset.komiHeroChecked === signature) return previous.promise;
    img.dataset.komiHeroChecked = signature;
    const stillActive = () => {
      if (img.isConnected === false || img.dataset.komiHeroChecked !== signature) return false;
      if (slide.classList.contains('active') && !document.hidden && sliderStates.get(sliderFor(slide))?.visible !== false) return true;
      delete img.dataset.komiHeroChecked;
      return false;
    };
    const task = (async () => {
      // An administrator's artwork wins even if an external banner is larger
      // or was decoded earlier. Stop as soon as the first usable source loads.
      for (const url of new Set([banner,still,externalBanner].filter(Boolean))) {
        const result = img.src === url && img.complete && img.naturalWidth
          ? {url,width:img.naturalWidth,height:img.naturalHeight} : await preflight(url);
        if (!stillActive()) return null;
        if (result && result.width >= 900 && result.height > 0 && result.width/result.height >= 1.55) {
          if (img.src !== result.url) img.src = result.url;
          return true;
        }
      }
      // A missing landscape must not cause another portrait download at first paint.
      if (firstUnselected) return false;
      for (const url of new Set([cover,originalPoster].filter(Boolean))) {
        const result = await preflight(url);
        if (!stillActive()) return null;
        if (result && result.width >= 480 && result.height > result.width*1.05 &&
            result.width > (img.naturalWidth || 0)+90) {
          if (img.src !== result.url) img.src = result.url;
          break;
        }
      }
      return false;
    })();
    artworkJobs.set(img,{signature,promise:task});
    return task;
  }

  function apply(id, entry) {
    document.querySelectorAll(SELECTOR).forEach(slide => {
      if (slide.dataset.komiAnimeId === id &&
          (!root.matchMedia?.('(max-width: 767px)').matches ||
            slide.classList.contains('active'))) void applyArtwork(slide, entry);
    });
  }

  async function fetchPending() {
    if (fetching || !pending.size) return;
    fetching = true;
    try {
      while (pending.size) {
        const batch = Array.from(pending).slice(0, 5);
        batch.forEach(id => { pending.delete(id); fetchingIds.add(id); });

        // A Page filter skips missing titles instead of failing a query when
        // any single MAL entry has no matching AniList media record.
        const query = 'query KomiHeroArtwork($ids:[Int]) {' +
          ' Page(page:1,perPage:5) {' +
          ' media(type:ANIME,idMal_in:$ids) {' +
          ' idMal isAdult bannerImage coverImage { extraLarge } } } }';
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 6000);
        try {
          const response = await fetch(API, {
            method: 'POST',
            headers: {'Content-Type':'application/json', Accept:'application/json'},
            body: JSON.stringify({query, variables:{ids:batch.map(Number)}}),
            credentials: 'omit',
            signal: controller.signal
          });
          if (!response.ok) throw new Error('Hero artwork unavailable');
          const payload = await response.json();
          const results = payload?.data?.Page?.media;
          if (!Array.isArray(results)) throw new Error('Invalid artwork metadata');
          const byId = new Map(results.filter(item => item && !item.isAdult)
            .map(item => [String(item.idMal), item]));
          for (const id of batch) {
            retryAfter.delete(id);
            apply(id, saveCached(id, byId.get(id)));
          }
        } catch {
          // Keep existing artwork and avoid repeat requests during provider outages.
          for (const id of batch) retryAfter.set(id, Date.now() + 60000);
        } finally {
          batch.forEach(id => fetchingIds.delete(id));
          clearTimeout(timer);
        }
      }
    } finally {
      fetching = false;
    }
  }

  function bindVisible() {
    document.querySelectorAll(SELECTOR+'.active').forEach(slide=>{
      const id=String(slide.dataset.komiAnimeId||'');
      if (!firstVisibleId) firstVisibleId=id;
      bindImage(slide);
    });
  }
  function applyMetadata(slide, item) {
    if (!slide.classList.contains('active') || slide.isConnected === false) return;
    for (const [key,field,validate] of [
      ['still','komiHeroStill',safeStill], ['banner','komiHeroBanner',safeStill], ['video','komiHeroVideo',safeVideo]
    ]) {
      if (!Object.prototype.hasOwnProperty.call(item || {},key)) continue;
      const value = validate(item[key]);
      if (value) slide.dataset[field] = value;
      else delete slide.dataset[field];
    }
    const content = slide.querySelector('.komi-home-hero-content');
    if (content && typeof item?.description === 'string' && item.description) {
      let description = content.querySelector('p');
      if (!description) {
        description = document.createElement('p');
        description.className = 'komi-hub-description';
        content.insertBefore(description,content.querySelector('.hero-buttons') || null);
      }
      if (description.textContent !== item.description) description.textContent = item.description;
    }
    void applyArtwork(slide,getCached(slide.dataset.komiAnimeId) || {});
    syncVideos();
  }

  function loadMetadata(slide,id) {
    if (typeof root.komiFetchHeroMetadata !== 'function') return;
    if (metadata.has(id)) { applyMetadata(slide,metadata.get(id)); return; }
    if (metadataPending.has(id) || (metadataRetryAfter.get(id) || 0) > Date.now()) return;
    const version = metadataVersions.get(id) || 0;
    const task = Promise.resolve().then(() => root.komiFetchHeroMetadata(id)).then(item => {
      if ((metadataVersions.get(id) || 0) !== version) return;
      if (!item) { metadataRetryAfter.set(id,Date.now()+60000); return; }
      metadata.set(id,item);
      metadataRetryAfter.delete(id);
      if (metadata.size > 20) metadata.delete(metadata.keys().next().value);
      document.querySelectorAll(SELECTOR+'.active').forEach(current => {
        if (current.dataset.komiAnimeId === id) applyMetadata(current,item);
      });
    }).catch(() => { if ((metadataVersions.get(id) || 0) === version) metadataRetryAfter.set(id,Date.now()+60000); })
      .finally(() => { if (metadataPending.get(id) === task) metadataPending.delete(id); });
    metadataPending.set(id,task);
  }

  function videoMayPlay(slide,url) {
    return slide.isConnected !== false && slide.classList.contains('active') &&
      safeVideo(slide.dataset.komiHeroVideo) === url && mediaReady.has(slide) && !isPaused(sliderFor(slide));
  }

  function syncVideos() {
    cleanupSliders();
    const slider = document.getElementById('heroSlider');
    if (slider) isPaused(slider);
    document.querySelectorAll(SELECTOR).forEach(slide => {
      let video = slide.querySelector('video.komi-hero-video');
      const url = safeVideo(slide.dataset.komiHeroVideo);
      const record = video && videoRecords.get(video);
      if (video && record?.url !== url) { disposeVideo(video); video = null; }
      if (!url || !videoMayPlay(slide,url)) { if (video) pauseVideo(video); return; }
      if (slide.dataset.komiHeroVideoFailed === url) return;
      if (!video) {
        const image = slide.querySelector('img.komi-hub-hero-art');
        if (!image?.complete || !image.naturalWidth || image.dataset.komiHeroDeferredSrc) return;
        video = document.createElement('video');
        video.className = 'komi-hero-video';
        video.muted = true; video.defaultMuted = true; video.loop = true;
        video.playsInline = true; video.preload = 'none';
        video.setAttribute('aria-hidden','true');
        const state = {url,pending:false,blocked:false,attempt:0};
        videoRecords.set(video,state);
        video.addEventListener('playing', () => {
          if (videoMayPlay(slide,url)) video.classList.add('is-playing');
          else pauseVideo(video);
        });
        video.addEventListener('error', () => {
          slide.dataset.komiHeroVideoFailed = url;
          state.blocked = true;
          pauseVideo(video);
        });
        image.after(video);
        video.src = url;
        runningVideos.add(video);
      }
      const state = videoRecords.get(video);
      if (!video.paused || state.pending || state.blocked) return;
      const attempt = ++state.attempt;
      state.pending = true;
      let play;
      try { play = video.play(); } catch (error) { play = Promise.reject(error); }
      Promise.resolve(play).then(() => {
        if (state.attempt !== attempt) return;
        if (!videoMayPlay(slide,url)) pauseVideo(video);
      }).catch(error => {
        if (state.attempt === attempt) {
          state.blocked = error?.name !== 'AbortError';
          video.classList.remove('is-playing');
        }
      }).finally(() => { if (state.attempt === attempt) state.pending = false; });
    });
  }

  function scan() {
    bindVisible();
    const slider = document.getElementById('heroSlider');
    const state = mountSlider(slider);
    if (constrainedConnection() || document.hidden || state?.visible === false) { syncVideos(); return; }
    document.querySelectorAll(SELECTOR+'.active').forEach(slide => {
      const img = bindImage(slide);
      if (!img?.complete || !img.naturalWidth || img.dataset.komiHeroDeferredSrc) return;
      mediaReady.add(slide);
      const id = String(slide.dataset.komiAnimeId || '');
      if (!/^[1-9]\d{0,11}$/.test(id)) return;
      loadMetadata(slide,id);
      const cached = getCached(id);
      void applyArtwork(slide,cached || {}).then(hasLandscape => {
        if (hasLandscape !== false || cached || getCached(id) || fetchingIds.has(id) || !slide.classList.contains('active') || slide.isConnected === false ||
            constrainedConnection() || document.hidden || state?.visible === false || (retryAfter.get(id) || 0) > Date.now()) return;
        pending.add(id);
        void fetchPending();
      });
    });
    syncVideos();
  }

  function scheduleScan() {
    // The existing low-resolution picture must be visible immediately;
    // HD metadata and network upgrades are deliberately deferred.
    bindVisible();
    if (scanTimer !== null) return;
    scanTimer = setTimeout(() => {
      scanTimer = null;
      const connection = root.navigator?.connection;
      if (connection?.saveData || /(^|-)2g$/.test(connection?.effectiveType || '')) return;
      if (document.hidden) return;
      if (typeof root.requestIdleCallback === 'function') root.requestIdleCallback(scan,{timeout:5000});
      else scan();
    }, 1800);
  }

  function selectedSlide() {
    userSelectedSlide = true;
    scan();
  }

  function invalidateMetadata(id) {
    id = String(id || '');
    metadata.delete(id);
    metadataPending.delete(id);
    metadataVersions.set(id,(metadataVersions.get(id) || 0)+1);
    metadataRetryAfter.delete(id);
    document.querySelectorAll(SELECTOR).forEach(slide => {
      if (slide.dataset.komiAnimeId !== id) return;
      delete slide.dataset.komiHeroVideoFailed;
      const img = slide.querySelector('img.komi-hub-hero-art');
      if (img) { delete img.dataset.komiHeroChecked; artworkJobs.delete(img); }
    });
    scan();
  }

  document.addEventListener('click', event => {
    const button = event.target?.closest?.('[data-komi-hero-toggle]');
    const slider = button?.closest?.('#heroSlider');
    if (!button || !slider || button.disabled) return;
    const state = mountSlider(slider);
    if (!state) return;
    if (isPaused(slider)) {
      state.userPaused = false;
      state.resumeFocus = true;
      state.ignoreHover = finePointer.matches && matches(slider,':hover');
      for (const video of runningVideos) {
        const record = videoRecords.get(video);
        if (record && slider.contains?.(video)) record.blocked = false;
      }
    } else {
      state.userPaused = true;
      state.resumeFocus = false;
      state.ignoreHover = false;
    }
    syncVideos();
    scheduleScan();
  });
  document.addEventListener('visibilitychange', () => {
    syncVideos();
    if (!document.hidden) scheduleScan();
  });
  root.addEventListener?.('pagehide', () => { for (const video of runningVideos) pauseVideo(video); });

  const clearParallax = () => {
    if (pointerFrame !== null) root.cancelAnimationFrame?.(pointerFrame);
    pointerFrame = null;
    pointerPosition = null;
    for (const slider of mountedSliders) {
      slider.style?.removeProperty('--komi-hero-x');
      slider.style?.removeProperty('--komi-hero-y');
    }
  };
  const preferencesChanged = () => { clearParallax(); syncVideos(); scheduleScan(); };
  for (const media of [reducedMotion,finePointer]) {
    if (media.addEventListener) media.addEventListener('change',preferencesChanged);
    else media.addListener?.(preferencesChanged);
  }
  root.navigator?.connection?.addEventListener?.('change',preferencesChanged);
  document.addEventListener('pointermove', event => {
    if (!finePointer.matches || reducedMotion.matches || constrainedConnection() || document.hidden) return;
    const slider = event.target?.closest?.('#heroSlider');
    if (!slider?.closest?.('.komi-home-hero') || typeof root.requestAnimationFrame !== 'function') return;
    const state = mountSlider(slider);
    if (state?.userPaused || state?.visible === false) return;
    pointerPosition = {slider,x:event.clientX,y:event.clientY};
    if (pointerFrame !== null) return;
    pointerFrame = root.requestAnimationFrame(() => {
      pointerFrame = null;
      if (!pointerPosition || reducedMotion.matches || !finePointer.matches) return;
      const {slider,x,y} = pointerPosition;
      const rect = slider.getBoundingClientRect();
      if (!rect.width || !rect.height || slider.isConnected === false) return;
      slider.style.setProperty('--komi-hero-x',((x-rect.left)/rect.width-.5)*-10+'px');
      slider.style.setProperty('--komi-hero-y',((y-rect.top)/rect.height-.5)*-6+'px');
    });
  }, {passive:true});
  document.addEventListener('pointerout', event => {
    const slider = event.target?.closest?.('#heroSlider');
    if (slider && !slider.contains(event.relatedTarget)) clearParallax();
  }, {passive:true});

  root.KomiHeroArt = {scan,selectedSlide,syncVideos,isPaused,invalidateMetadata};
  const container = document.getElementById('mainContainer');
  if (container) {
    new MutationObserver(() => { syncVideos(); scheduleScan(); }).observe(container,{childList:true,subtree:true});
    mountSlider(document.getElementById('heroSlider'));
    scheduleScan();
  }
  // The player is outside mainContainer; opening it leaves the hero mounted
  // and geometrically visible. Observe only the known dialog's class state.
  if (watchModal?.classList) new MutationObserver(() => {
    syncVideos();
    if (!watchModal.classList.contains('active')) scheduleScan();
  }).observe(watchModal,{attributes:true,attributeFilter:['class']});
})(window);
